import { useTranslations } from '@/lib/i18n/provider';

/**
 * Hook to simplify error messages for user-facing display
 * Automatically handles user rejection errors with i18n support
 */
export function useErrorHandler() {
  const tErrors = useTranslations('errors');

  const simplifyError = (error: unknown, defaultMessage?: string): string => {
    if (!(error instanceof Error)) {
      return defaultMessage || tErrors('transactionFailed');
    }

    const errMsg = error.message.toLowerCase();
    const errorCode = (error as any)?.code;
    
    // User rejection errors - return translated message
    if (
      errMsg.includes('user rejected') ||
      errMsg.includes('denied transaction') ||
      errMsg.includes('user denied') ||
      errMsg.includes('rejected the request') ||
      errorCode === 4001
    ) {
      return tErrors('userRejected');
    }

    // Return original message if not a user rejection
    return error.message || defaultMessage || tErrors('transactionFailed');
  };

  return { simplifyError };
}











































