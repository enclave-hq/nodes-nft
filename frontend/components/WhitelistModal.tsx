'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useWeb3Data } from '@/lib/stores/web3Store';
import { useInviteCode, validateInviteCode, createInviteCodeRequest } from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Shield, Gift, Loader2, CheckCircle2, Clock } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Connected Address */}
          {address && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{t('currentAddress')}</p>
              <p className="text-sm font-mono text-gray-900 break-all">{address}</p>
            </div>
          )}

          {/* Apply for Whitelist */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">{t('applyWhitelist')}</h3>
            </div>
            
            {isWhitelisted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-900">{t('whitelisted')}</p>
                    <p className="text-xs text-green-700 mt-1">
                      {t('whitelistedDescription')}
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-3">
                  {t('enterInviteCode')}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={t('inviteCodePlaceholder')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isRegistering}
                  />
                  <button
                    onClick={handleRegister}
                    disabled={isRegistering || !inviteCode.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[80px]"
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
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Gift className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">{t('myInviteCodes')}</h3>
            </div>
            
            {loadingInviteData ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">{t('loading')}</span>
              </div>
            ) : inviteCodeStatus === 'approved' ? (
              // Status: Has invite code (approved)
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-900">{t('approved')}</p>
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    {activeInviteCodes.map((code) => (
                      <div key={code.id} className="bg-white rounded-lg p-3 border border-blue-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-mono font-semibold text-blue-900">
                              {code.code}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">{t('activeDescription')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : inviteCodeStatus === 'pending' ? (
              // Status: Pending (waiting for review)
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-900">{t('pending')}</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {t('pendingDescription')}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
            ) : (
              // Status: No invite code
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-3">
                  {t('noInviteCode')}
                </p>
                <button
                  onClick={handleRequestInviteCode}
                  disabled={isRequesting}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
