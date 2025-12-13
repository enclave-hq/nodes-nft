import { NFTMinted } from "../generated/NFTManager/NFTManager";
import { NFTMint } from "../generated/schema";

export function handleNFTMinted(event: NFTMinted): void {
  // Create a new NFTMint entity
  let nftMint = new NFTMint(event.params.nftId.toString());

  // Set all fields from the event
  nftMint.nftId = event.params.nftId;
  nftMint.minter = event.params.minter;
  nftMint.batchId = event.params.batchId;
  nftMint.mintPrice = event.params.mintPrice;
  nftMint.timestamp = event.params.timestamp;
  nftMint.txHash = event.transaction.hash;
  nftMint.blockNumber = event.block.number;
  nftMint.blockTimestamp = event.block.timestamp;

  // Save the entity
  nftMint.save();
}





