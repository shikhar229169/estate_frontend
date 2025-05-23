// Import ABIs from the local abi directory
import RealEstateRegistryABI from './abi/RealEstateRegistry';
import ERC20ABI from './abi/ERC20ABI';
import EstateVerificationABI from './abi/EstateVerification';
import AssetTokenizationManagerABI from './abi/AssetTokenizationManager';
import VerifyingOperatorVaultABI from './abi/VerifyingOperatorVault';
import addresses from './abi/addresses';
import { ethers } from 'ethers';

// Function to get contract configuration based on chain ID
const getContractConfig = (chainId) => {
  // Default to Sepolia if chain ID is not supported
  const supportedChainId = addresses[chainId] ? chainId : 11155111;
  const networkAddresses = addresses[supportedChainId];

  return {
    RealEstateRegistry: {
      address: networkAddresses.realEstateRegistry,
      abi: RealEstateRegistryABI
    },
    EstateVerification: {
      address: networkAddresses.estateVerification,
      abi: EstateVerificationABI
    },
    AssetTokenizationManager: {
      address: networkAddresses.assetTokenizationManager,
      abi: AssetTokenizationManagerABI
    },
    VerifyingOperatorVault: {
      address: networkAddresses.verifyingOperatorVault,
      abi: VerifyingOperatorVaultABI
    },
    // USDC token for payments
    USDC: {
      address: networkAddresses.usdc,
      abi: ERC20ABI
    },
    TokenizedRealEstate: {
      MAX_TRE_MINTABLE: ethers.utils.parseEther("1000000")
    }
  };
};

export default getContractConfig;
