"use client";

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { setupTotp, enableTotp, disableTotp, checkTotpStatus, getCurrentUser } from '@/lib/api/auth';
import { isAuthenticated } from '@/lib/api';

export default function TotpSettingsPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'setup' | 'verify' | 'enabled' | 'disable'>('setup');
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [isCheckingTotp, setIsCheckingTotp] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load current user info on mount
  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!isAuthenticated()) {
        setIsLoadingUser(false);
        return;
      }

      try {
        const user = await getCurrentUser();
        setUsername(user.username);
        console.log('Current user:', user.username);
      } catch (error) {
        console.error('Failed to load current user:', error);
        toast.error('无法获取当前用户信息');
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadCurrentUser();
  }, []);

  // Check TOTP status when username changes (with debounce)
  useEffect(() => {
    // Don't check if still loading user
    if (isLoadingUser) {
      return;
    }

    // Clear previous timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // If username is empty, reset TOTP status
    if (!username.trim()) {
      setTotpEnabled(null);
      return;
    }

    // Debounce: wait 500ms after user stops typing
    checkTimeoutRef.current = setTimeout(async () => {
      setIsCheckingTotp(true);
      try {
        const result = await checkTotpStatus(username.trim());
        setTotpEnabled(result.totpEnabled);
        console.log('TOTP status for', username, ':', result.totpEnabled);
      } catch (error) {
        console.error('Failed to check TOTP status:', error);
        setTotpEnabled(null);
      } finally {
        setIsCheckingTotp(false);
      }
    }, 500);

    // Cleanup function
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [username, isLoadingUser]);

  // Update TOTP status after enabling/disabling
  useEffect(() => {
    if (step === 'enabled') {
      setTotpEnabled(true);
    } else if (step === 'setup' && totpEnabled === false) {
      // After disabling, totpEnabled should be false
      // This is handled in handleDisable
    }
  }, [step]);

  // Setup TOTP - Generate secret and QR code
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const result = await setupTotp(username.trim(), password);
      setSecret(result.secret);
      setQrCode(result.qrCode);
      setOtpauthUrl(result.otpauthUrl);
      setStep('verify');
      toast.success('TOTP 密钥已生成，请扫描二维码');
    } catch (error: any) {
      console.error('Failed to setup TOTP:', error);
      toast.error(error?.response?.data?.message || error?.message || '设置 TOTP 失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Enable TOTP after verification
  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim() || !totpCode.trim() || !secret) {
      toast.error('请填写完整信息');
      return;
    }

    if (totpCode.trim().length !== 6) {
      toast.error('TOTP 验证码必须是 6 位数字');
      return;
    }

    setIsLoading(true);
    try {
      await enableTotp(username.trim(), password, totpCode.trim(), secret);
      setStep('enabled');
      toast.success('TOTP 已成功启用');
      // Clear sensitive data
      setPassword('');
      setTotpCode('');
      setSecret(null);
      setQrCode(null);
      setOtpauthUrl(null);
    } catch (error: any) {
      console.error('Failed to enable TOTP:', error);
      toast.error(error?.response?.data?.message || error?.message || '启用 TOTP 失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Disable TOTP
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('请输入用户名和密码');
      return;
    }

    if (!confirm('确定要禁用 TOTP 吗？禁用后登录将不再需要验证码。')) {
      return;
    }

    setIsLoading(true);
    try {
      await disableTotp(username.trim(), password);
      setTotpEnabled(false);
      setStep('setup');
      toast.success('TOTP 已成功禁用');
      // Clear form
      setPassword('');
      setTotpCode('');
      setSecret(null);
      setQrCode(null);
      setOtpauthUrl(null);
    } catch (error: any) {
      console.error('Failed to disable TOTP:', error);
      toast.error(error?.response?.data?.message || error?.message || '禁用 TOTP 失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('setup');
    setPassword('');
    setTotpCode('');
    setSecret(null);
    setQrCode(null);
    setOtpauthUrl(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">TOTP 密码设置</h1>

      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Setup Step */}
        {step === 'setup' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">设置 TOTP 双因素认证</h2>
            <p className="text-gray-600 mb-6">
              启用 TOTP 后，登录时需要输入用户名、密码和 6 位数字验证码，提高账户安全性。
            </p>
            
            <form onSubmit={handleSetup} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isLoadingUser ? "加载中..." : "请输入管理员用户名"}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  required
                  disabled={isLoadingUser || !!username}
                  readOnly={!!username}
                />
                {username && (
                  <p className="mt-1 text-xs text-gray-500">
                    当前登录用户：{username}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理员密码"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    生成中...
                  </span>
                ) : (
                  '生成 TOTP 密钥'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Verify Step */}
        {step === 'verify' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">扫描二维码并验证</h2>
            
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 font-medium mb-2">操作步骤：</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                  <li>使用身份验证器应用（如 Google Authenticator、Authy）扫描下方二维码</li>
                  <li>扫描后，应用会显示 6 位数字验证码</li>
                  <li>在下方输入验证码以完成设置</li>
                </ol>
              </div>

              {qrCode && (
                <div className="flex justify-center mb-6">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <img src={qrCode} alt="TOTP QR Code" className="w-64 h-64" />
                  </div>
                </div>
              )}

              {secret && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">手动输入密钥（如果无法扫描二维码）：</p>
                  <code className="text-sm font-mono text-gray-900 break-all">{secret}</code>
                </div>
              )}

              {otpauthUrl && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">OTPAuth URL：</p>
                  <code className="text-xs font-mono text-gray-600 break-all">{otpauthUrl}</code>
                </div>
              )}

              <form onSubmit={handleEnable} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TOTP 验证码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="输入 6 位数字验证码"
                    maxLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-500">请输入身份验证器应用中显示的 6 位数字</p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    返回
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        验证中...
                      </span>
                    ) : (
                      '启用 TOTP'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Enabled Step */}
        {step === 'enabled' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">TOTP 已成功启用</h2>
              <p className="text-gray-600">
                下次登录时，您需要输入用户名、密码和 TOTP 验证码。
              </p>
            </div>
            
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              返回设置
            </button>
          </div>
        )}

        {/* Disable Step */}
        {step === 'disable' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">禁用 TOTP</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>警告：</strong>禁用 TOTP 后，您的账户将仅使用密码保护，安全性会降低。
              </p>
            </div>
            
            <form onSubmit={handleDisable} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入管理员用户名"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理员密码"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      处理中...
                    </span>
                  ) : (
                    '确认禁用'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Action Buttons */}
        {step === 'setup' && totpEnabled === true && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800">
                <strong>✓ TOTP 已启用</strong> - 此账户已启用 TOTP 双因素认证
              </p>
            </div>
            <button
              onClick={() => {
                setStep('disable');
                setPassword('');
              }}
              className="w-full px-6 py-3 border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition-colors"
            >
              禁用 TOTP
            </button>
          </div>
        )}
        {step === 'setup' && totpEnabled === false && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>ℹ️ TOTP 未启用</strong> - 此账户尚未启用 TOTP 双因素认证
              </p>
            </div>
          </div>
        )}
        {step === 'setup' && totpEnabled === null && username.trim() && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            {isCheckingTotp ? (
              <div className="text-center text-sm text-gray-500">
                正在检查 TOTP 状态...
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ 无法检查 TOTP 状态</strong> - 请确认用户名是否正确
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

