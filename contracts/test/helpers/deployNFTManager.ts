import { ethers } from "hardhat";
import { INFTManagerCut } from "../../typechain-types";

/**
 * Helper function to deploy NFTManager (Diamond Pattern) for testing
 */
export async function deployNFTManager(
  nodeNFTAddress: string,
  eclvTokenAddress: string,
  usdtTokenAddress: string,
  oracleAddress: string,
  treasuryAddress: string,
  deployer: any
) {
  // Deploy Core Facets
  const NFTManagerCutFacet = await ethers.getContractFactory("NFTManagerCutFacet");
  const nftManagerCutFacet = await NFTManagerCutFacet.deploy();
  await nftManagerCutFacet.waitForDeployment();
  const nftManagerCutFacetAddress = await nftManagerCutFacet.getAddress();

  const NFTManagerLoupeFacet = await ethers.getContractFactory("NFTManagerLoupeFacet");
  const nftManagerLoupeFacet = await NFTManagerLoupeFacet.deploy();
  await nftManagerLoupeFacet.waitForDeployment();
  const nftManagerLoupeFacetAddress = await nftManagerLoupeFacet.getAddress();

  // Deploy NFTManager
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await NFTManager.deploy(deployer.address, nftManagerCutFacetAddress);
  await nftManager.waitForDeployment();
  const nftManagerAddress = await nftManager.getAddress();

  // Deploy NFTManagerInit
  const NFTManagerInit = await ethers.getContractFactory("NFTManagerInit");
  const nftManagerInit = await NFTManagerInit.deploy();
  await nftManagerInit.waitForDeployment();
  const nftManagerInitAddress = await nftManagerInit.getAddress();

  // Deploy all Facets
  const facetFactories = [
    "NFTManagerFacet",
    "MarketplaceFacet",
    "RewardFacet",
    "AdminFacet",
  ];

  const facetAddresses: { [key: string]: string } = {};

  for (const facetName of facetFactories) {
    const FacetFactory = await ethers.getContractFactory(facetName);
    const facet = await FacetFactory.deploy();
    await facet.waitForDeployment();
    const facetAddress = await facet.getAddress();
    facetAddresses[facetName] = facetAddress;
  }

  // Get function selectors (excluding supportsInterface which is handled separately)
  const getSelectors = async (facetName: string) => {
    const FacetFactory = await ethers.getContractFactory(facetName);
    const iface = FacetFactory.interface;
    const selectors: string[] = [];
    
    // Get all functions from the interface
    const functions = iface.fragments.filter(f => f.type === "function");
    
    for (const fragment of functions) {
      if (fragment.type === "function" && fragment.name !== "supportsInterface") {
        try {
          const func = iface.getFunction(fragment.name);
          selectors.push(func.selector);
        } catch (e) {
          // Skip if function not found
        }
      }
    }
    
    return selectors;
  };
  
  // Helper to remove duplicate selectors
  const removeDuplicates = (selectors: string[]): string[] => {
    return [...new Set(selectors)];
  };

  // Build facet cuts
  const cuts: INFTManagerCut.FacetCutStruct[] = [];
  const allSelectors = new Set<string>();

  // Add NFTManagerLoupeFacet
  const loupeSelectors = await getSelectors("NFTManagerLoupeFacet");
  const uniqueLoupeSelectors = loupeSelectors.filter(s => !allSelectors.has(s));
  uniqueLoupeSelectors.forEach(s => allSelectors.add(s));
  
  if (uniqueLoupeSelectors.length > 0) {
    cuts.push({
      facetAddress: nftManagerLoupeFacetAddress,
      action: 0, // Add
      functionSelectors: uniqueLoupeSelectors,
    });
  }

  // Add all other facets
  for (const [facetName, facetAddress] of Object.entries(facetAddresses)) {
    const selectors = await getSelectors(facetName);
    const uniqueSelectors = selectors.filter(s => !allSelectors.has(s));
    uniqueSelectors.forEach(s => allSelectors.add(s));
    
    if (uniqueSelectors.length > 0) {
      cuts.push({
        facetAddress: facetAddress,
        action: 0, // Add
        functionSelectors: uniqueSelectors,
      });
    }
  }

  // Initialize NFTManager
  const initData = nftManagerInit.interface.encodeFunctionData("init", [
    nodeNFTAddress,
    eclvTokenAddress,
    usdtTokenAddress,
    oracleAddress,
    treasuryAddress,
  ]);

  // Execute NFTManagerCut
  const nftManagerCut = await ethers.getContractAt("INFTManagerCut", nftManagerAddress) as INFTManagerCut;
  const tx = await nftManagerCut.nftManagerCut(cuts, nftManagerInitAddress, initData);
  await tx.wait();

  // Return contract instances using Facet interfaces
  const nftManagerFacet = await ethers.getContractAt("NFTManagerFacet", nftManagerAddress);
  const marketplaceFacet = await ethers.getContractAt("MarketplaceFacet", nftManagerAddress);
  const rewardFacet = await ethers.getContractAt("RewardFacet", nftManagerAddress);
  const adminFacet = await ethers.getContractAt("AdminFacet", nftManagerAddress);

  return {
    nftManager, // Main contract
    nftManagerFacet,
    marketplaceFacet,
    rewardFacet,
    adminFacet,
    nftManagerAddress,
    facetAddresses,
  };
}

