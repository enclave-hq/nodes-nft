'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import { formatAddress } from '@/lib/utils';

interface AddressDisplayProps {
  address: string;
  className?: string;
  showFullOnClick?: boolean;
}

// Address Dialog Component
function AddressDialog({
  isOpen,
  onClose,
  address,
}: {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}) {
  const [copied, setCopied] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">完整地址</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">地址:</p>
            <div
              ref={addressRef}
              className="text-lg font-mono font-semibold text-gray-900 break-all"
            >
              {address}
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#E5F240] px-4 py-2.5 text-sm font-medium text-black hover:bg-[#D4E238] transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AddressDisplay({
  address,
  className = '',
  showFullOnClick = true,
}: AddressDisplayProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!address) {
    return <span className={className}>-</span>;
  }

  const formattedAddress = formatAddress(address);

  return (
    <>
      <button
        onClick={() => showFullOnClick && setIsDialogOpen(true)}
        className={`font-mono text-xs text-gray-600 hover:text-gray-900 transition-colors ${showFullOnClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
        title={showFullOnClick ? '点击查看完整地址' : address}
      >
        {formattedAddress}
      </button>
      {showFullOnClick && (
        <AddressDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          address={address}
        />
      )}
    </>
  );
}



























