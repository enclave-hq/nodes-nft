'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { login, isAuthenticated, checkTotpStatus } from '@/lib/api';

interface AdminLoginProps {
  onLoginSuccess?: () => void;
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [isCheckingTotp, setIsCheckingTotp] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check TOTP status when username changes (with debounce)
  useEffect(() => {
    // Clear previous timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // If username is empty, hide TOTP input
    if (!username.trim()) {
      setShowTotp(false);
      return;
    }

    // Debounce: wait 500ms after user stops typing
    checkTimeoutRef.current = setTimeout(async () => {
      setIsCheckingTotp(true);
      try {
        const result = await checkTotpStatus(username.trim());
        if (result.totpEnabled) {
          console.log('✅ TOTP is enabled for user:', username);
          setShowTotp(true);
        } else {
          console.log('ℹ️ TOTP is not enabled for user:', username);
          setShowTotp(false);
        }
      } catch (error) {
        console.error('Failed to check TOTP status:', error);
        // On error, don't show TOTP input (will be shown on login error if needed)
        setShowTotp(false);
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
  }, [username]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    // If TOTP input is shown, require TOTP code
    if (showTotp && !totpCode) {
      toast.error('请输入TOTP验证码');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password, totpCode || undefined);
      toast.success('登录成功');
      setShowTotp(false);
      setTotpCode('');
      onLoginSuccess?.();
    } catch (error: any) {
      console.error('Login failed:', error);
      console.error('Error details:', {
        message: error?.message,
        statusCode: error?.statusCode,
        error: error?.error,
        errorType: error?.constructor?.name,
        isApiError: error instanceof Error && error.name === 'ApiError',
      });
      
      // ApiError has statusCode and message directly
      // NestJS error format: { statusCode, message, error? }
      const errorMessage = error?.message || '登录失败';
      const statusCode = error?.statusCode;
      
      // Normalize error message to lowercase for comparison
      const errorMsgLower = String(errorMessage).toLowerCase();
      
      console.log('Parsed error:', { 
        errorMessage, 
        statusCode, 
        errorMsgLower,
        hasTotp: errorMsgLower.includes('totp'),
        hasRequired: errorMsgLower.includes('required'),
      });
      
      // If TOTP code is required (400 Bad Request), show TOTP input
      // Check both status code and message content
      if (statusCode === 400 && (errorMsgLower.includes('totp') || errorMsgLower.includes('required'))) {
        console.log('✅ TOTP required (400), showing input field');
        setShowTotp(true);
        toast.error('请输入TOTP验证码');
      } 
      // If TOTP code is invalid (401 Unauthorized), keep showing TOTP input and show error
      else if (statusCode === 401 && (errorMsgLower.includes('totp') || errorMsgLower.includes('invalid'))) {
        console.log('✅ TOTP invalid (401), keeping input field visible');
        setShowTotp(true);
        toast.error('TOTP验证码错误，请重新输入');
        setTotpCode(''); // Clear the invalid code
      } 
      // Fallback: if message contains TOTP-related keywords, show input (even if status code is unclear)
      else if (errorMsgLower.includes('totp') && errorMsgLower.includes('required')) {
        console.log('✅ TOTP required (fallback), showing input field');
        setShowTotp(true);
        toast.error('请输入TOTP验证码');
      }
      // Other errors (invalid username/password, etc.)
      else {
        // If it's an authentication error and TOTP is not shown, it might be password error
        // Don't show TOTP input for password errors
        console.log('❌ Other error, not showing TOTP input. Status:', statusCode, 'Message:', errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            管理员登录
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            请输入用户名和密码登录
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {showTotp && (
              <div>
                <label htmlFor="totp" className="sr-only">
                  TOTP验证码
                </label>
                <input
                  id="totp"
                  name="totp"
                  type="text"
                  maxLength={6}
                  required={showTotp}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="TOTP验证码 (6位数字)"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  autoFocus={showTotp}
                />
                <p className="mt-1 text-xs text-gray-500">
                  请输入您的身份验证器应用（如 Google Authenticator）中的6位验证码
                </p>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

