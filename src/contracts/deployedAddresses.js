// Deployed contract addresses for different networks

// Avalanche Fuji Testnet (Chain ID: 43113)
const FUJI_ADDRESSES = {
  RealEstateRegistry: '0x1234567890123456789012345678901234567890', // Replace with actual address
  AssetTokenizationManager: '0x2345678901234567890123456789012345678901', // Replace with actual address
  VerifyingOperatorVault: '0x3456789012345678901234567890123456789012', // Replace with actual address
  USDC: '0xAF82969ECF299c1f1Bb5e1D12dDAcc9027431160', // Testnet USDC on Fuji
  estateVerification: "0xAACA34E586ddebdd846a8C25c90A3CcC7670d77D",
};

// Ethereum Sepolia Testnet (Chain ID: 11155111)
const SEPOLIA_ADDRESSES = {
  RealEstateRegistry: '0x4567890123456789012345678901234567890123', // Replace with actual address
  AssetTokenizationManager: '0x5678901234567890123456789012345678901234', // Replace with actual address
  VerifyingOperatorVault: '0x6789012345678901234567890123456789012345', // Replace with actual address
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Testnet USDC on Sepolia
  estateVerification: "0x27d6bC526CFaa12b3975E56F78807d5Be792706E",
};

// Get addresses based on chain ID
export const getAddresses = (chainId) => {
  if (chainId === 43113) {
    return FUJI_ADDRESSES;
  } else if (chainId === 11155111) {
    return SEPOLIA_ADDRESSES;
  } else {
    return null;
  }
};

export default {
  FUJI_ADDRESSES,
  SEPOLIA_ADDRESSES,
  getAddresses
};
