'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useWeb3Data } from '@/lib/stores/web3Store';
import { useInviteCode, validateInviteCode, createInviteCodeRequest } from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Shield, Gift, Loader2, CheckCircle2, Clock, Copy, Check } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/provider';

interface WhitelistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhitelistModal({ isOpen, onClose }: WhitelistModalProps) {
  const t = useTranslations('whitelist');
  const { address, isConnected } = useWallet();
  const web3Data = useWeb3Data();
  const isWhitelisted = web3Data.whitelist.isWhitelisted;
  const inviteCodes = web3Data.inviteCodes;
  const loadingInviteData = web3Data.loading.inviteCodes;
  
  const [inviteCode, setInviteCode] = useState('');
  const [note, setNote] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [copiedInviteCodeId, setCopiedInviteCodeId] = useState<number | null>(null);

  // Load user invite code data
  useEffect(() => {
    if (isOpen && isConnected && address) {
      web3Data.fetchInviteCodes();
    }
  }, [isOpen, isConnected, address]);

  const handleRegister = async () => {
    if (!isConnected || !address) {
      toast.error(t('connectWalletFirst'));
      return;
    }

    if (!inviteCode.trim()) {
      toast.error(t('enterInviteCodeError'));
      return;
    }

    setIsRegistering(true);
    try {
      // 1. Validate invite code
      const validation = await validateInviteCode(inviteCode);
      if (!validation.valid) {
        toast.error(t('invalidInviteCode'));
        setIsRegistering(false);
        return;
      }

      // 2. Use invite code
      await useInviteCode(inviteCode, address);
      toast.success(t('inviteCodeUsed'));

      // 3. Refresh whitelist status and invite code data
      await Promise.all([
        web3Data.fetchWhitelist(),
        web3Data.fetchInviteCodes(),
      ]);
      
      if (web3Data.whitelist.isWhitelisted) {
        toast.success(t('whitelistRegistered'));
        setInviteCode('');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || t('registerFailed'));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRequestInviteCode = async () => {
    if (!isConnected || !address) {
      toast.error(t('connectWalletFirst'));
      return;
    }

    setIsRequesting(true);
    try {
      await createInviteCodeRequest(address, undefined, note.trim() || undefined);
      toast.success(t('applicationSubmitted'));
      setNote(''); // Clear note after successful submission
      await web3Data.fetchInviteCodes();
    } catch (error: any) {
      console.error('Request invite code error:', error);
      toast.error(error.message || t('applicationFailed'));
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isOpen) return null;

  // Get invite code status (from Store)
  const inviteCodeStatus = inviteCodes.inviteCodeStatus;
  const activeInviteCodes = inviteCodes.ownedInviteCodes;
  const pendingInviteCodes = inviteCodes.pendingInviteCodes || [];

  return (
    <div className="fixed inset-0 z-[60] modal-backdrop pointer-events-none" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
      <div className="bg-[#FFFFFF] rounded-t-[28px] shadow-2xl w-full max-h-[90vh] overflow-y-auto modal-content pointer-events-auto" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        {/* Header */}
        <div className="pt-3 px-4 pb-3 relative">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 transition-colors p-1.5 absolute top-3 right-4 z-10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center justify-between mb-2 pr-10">
            {address && !isWhitelisted && (
              <p className="text-sm text-black">{t('currentAddress')}</p>
            )}
            {isWhitelisted && (
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-black">我的白名单地址</h3>
              </div>
            )}
          </div>
          {address && !isWhitelisted && (
            <p className="text-xs font-mono text-black break-all text-center">{address}</p>
          )}
        </div>

        {/* Address Section (for whitelisted users) */}
        {isWhitelisted && address && (
          <div className="px-4 pb-3 border-b border-gray-100">
            <p className="text-xs font-mono text-black break-all text-center">
              {address}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="px-4 pb-4 space-y-3.5">
          {!isWhitelisted && (
            <div className="border-b border-gray-100 pb-3"></div>
          )}

          {/* Apply for Whitelist */}
          <div className="space-y-2.5">
            {!isWhitelisted && (
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-black">{t('applyWhitelist')}</h3>
              </div>
            )}
            
            {!isWhitelisted && (
              <div className="rounded-lg">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={t('inviteCodePlaceholder')}
                    className="flex-1 px-3 py-2 text-sm text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)' }}
                    disabled={isRegistering}
                  />
                  <button
                    onClick={handleRegister}
                    disabled={isRegistering || !inviteCode.trim()}
                    className="px-4 py-2 bg-[#CEF248] text-black text-sm font-medium rounded-[20px] hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[70px]"
                  >
                    {isRegistering ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('register')
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* My Invite Codes */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-2">
              <Gift className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-black">{t('myInviteCodes')}</h3>
            </div>
            
            {loadingInviteData ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">{t('loading')}</span>
              </div>
            ) : inviteCodeStatus === 'approved' ? (
              // Status: Has invite code (approved) - only show code and copy button
              <div className="space-y-2">
                {activeInviteCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between">
                    <div className="flex-1 bg-gray-100 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-mono font-semibold text-black">
                        {code.code}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(code.code);
                          setCopiedInviteCodeId(code.id);
                          setTimeout(() => setCopiedInviteCodeId(null), 2000);
                          toast.success(t('copyInviteCode') || '邀请码已复制');
                        } catch (err) {
                          console.error('Failed to copy:', err);
                          toast.error('复制失败');
                        }
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors ml-2"
                      title={t('copyInviteCode')}
                    >
                      {copiedInviteCodeId === code.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : inviteCodeStatus === 'approved_pending_activation' ? (
              // Status: Approved but waiting for activation (NFT mint)
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-yellow-900">{t('waitingForActivation')}</p>
                    <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    {t('waitingForActivationDescription')}
                  </p>
                  <div className="space-y-2">
                    {pendingInviteCodes.map((code) => (
                      <div key={code.id} className="bg-gray-100 rounded-lg p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-mono font-semibold text-black">
                              {code.code}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">{t('pendingActivationDescription')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : inviteCodeStatus === 'pending' ? (
              // Status: Pending (waiting for review)
              <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(206, 242, 73, 0.15)', border: '1px solid rgba(206, 242, 73, 0.3)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-black">{t('pending')}</p>
                    <p className="text-xs text-black mt-1">
                      {t('pendingDescription')}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-black flex-shrink-0 ml-2" />
                </div>
              </div>
            ) : (
              // Status: No invite code - show apply button (regardless of whitelist status)
              <div>
                <button
                  onClick={handleRequestInviteCode}
                  disabled={isRequesting}
                  className="w-full px-4 py-2.5 bg-[#CEF248] text-black text-sm font-medium rounded-[20px] hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center mb-2"
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('applying')}
                    </>
                  ) : (
                    t('applyInviteCode')
                  )}
                </button>
                <p className="text-sm text-black text-center">
                  {t('noInviteCode')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
