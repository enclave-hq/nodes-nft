"use client";

import { WhitelistModal } from "./WhitelistModal";
import { useWeb3Data } from "@/lib/stores/web3Store";

export function GlobalWhitelistModal() {
  const { isWhitelistModalOpen, setWhitelistModalOpen } = useWeb3Data();

  return (
    <WhitelistModal 
      isOpen={isWhitelistModalOpen} 
      onClose={() => setWhitelistModalOpen(false)} 
    />
  );
}

