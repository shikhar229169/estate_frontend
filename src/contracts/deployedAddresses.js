// Deployed contract addresses for different networks

// Avalanche Fuji Testnet (Chain ID: 43113)
const FUJI_ADDRESSES = {
  RealEstateRegistry: '0x399eE27AA7cB7791e129A29D003665A8d3336Df7', // Replace with actual address
  AssetTokenizationManager: '0xa60814985219A288454467860a5FBa84f384A527', // Replace with actual address
  VerifyingOperatorVault: '0x8eff10d7aEd87a137A0a05D65f1afdF1062Aa442', // Replace with actual address
  USDC: '0xbf856058aD6CC34c3bdfA574e13C911BD215220e', // Testnet USDC on Fuji
  estateVerification: "0xDc4ea519B0c9435662586EdE14CFDe3f6fda4C33",
};

// Ethereum Sepolia Testnet (Chain ID: 11155111)
const SEPOLIA_ADDRESSES = {
  RealEstateRegistry: '0xe7B1cc3831ADE7e9ac133A0CB08aC74E047086C6', // Replace with actual address
  AssetTokenizationManager: '0x03887eF5E94C2cb1A4a1f62E8656BB1Adb485F07', // Replace with actual address
  VerifyingOperatorVault: '0x5E064E3C1b563e32f28980E68785a4967c298052', // Replace with actual address
  USDC: '0xd611ccF96d2b8445A8731F4792C8Cc3871f96AA3', // Testnet USDC on Sepolia
  estateVerification: "0x9A8084e6e9fA9616A9EE1CBf8d31d4aCD6B2467B",
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
