import { ethers } from 'ethers';
import getContractConfig from '../contracts/contractConfig';
import TokenizedRealEstateABI from '../contracts/abi/TokenizedRealEstate';
import ERC20ABI from '../contracts/abi/ERC20ABI';

// Connect to wallet
export const connectWallet = async () => {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        return {
          address: accounts[0],
          status: 'Connected to wallet',
        };
      } else {
        return {
          address: '',
          status: 'Connect to wallet',
        };
      }
    } catch (err) {
      return {
        address: '',
        status: `Error: ${err.message}`,
      };
    }
  } else {
    return {
      address: '',
      status: 'Please install MetaMask to use this application',
    };
  }
};

// Get current connected wallet
export const getCurrentWalletConnected = async () => {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      if (accounts.length > 0) {
        return {
          address: accounts[0],
          status: 'success',
        };
      } else {
        return {
          address: '',
          status: 'not-connected',
        };
      }
    } catch (err) {
      console.error("Error getting wallet connection:", err);
      return {
        address: '',
        status: 'error',
        error: err.message
      };
    }
  } else {
    return {
      address: '',
      status: 'no-wallet',
      message: 'Please install MetaMask to use this application'
    };
  }
};

// Get current chain ID
export const getChainId = async () => {
  if (window.ethereum) {
    try {
      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      });

      return parseInt(chainId, 16);
    } catch (err) {
      console.error('Error getting chain ID:', err);
      return null;
    }
  } else {
    return null;
  }
};

// Switch network
export const switchNetwork = async (chainId) => {
  if (!window.ethereum) {
    alert('Please install MetaMask to use this application');
    return;
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902 || switchError.message.toLowerCase().includes("unrecognized chain id")) {
      try {
        let params;

        if (chainId === 43113) {
          // Avalanche Fuji Testnet
          params = {
            chainId: '0xa869',
            chainName: 'Avalanche Fuji Testnet',
            nativeCurrency: {
              name: 'AVAX',
              symbol: 'AVAX',
              decimals: 18,
            },
            rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
            blockExplorerUrls: ['https://testnet.snowtrace.io/'],
          };
        } else if (chainId === 11155111) {
          // Ethereum Sepolia Testnet
          params = {
            chainId: '0xaa36a7',
            chainName: 'Ethereum Sepolia Testnet',
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.infura.io/v3/'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/'],
          };
        }

        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [params],
        });
      } catch (addError) {
        console.error('Error adding chain:', addError);
      }
    } else {
      console.error('Error switching chain:', switchError);
    }
  }
};

// Get chain name from chain ID
export const getChainName = (chainId) => {
  switch (chainId) {
    case 43113:
      return 'Avalanche Fuji';
    case 11155111:
      return 'Ethereum Sepolia';
    default:
      return 'Unknown Network';
  }
};

// Format address for display
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Get contract instances based on chain ID
export const getContracts = (chainId) => {
  if (!window.ethereum) {
    return { error: 'Please install MetaMask to use this application' };
  }

  // Default to Sepolia testnet if chain ID is not supported
  if (chainId !== 11155111 && chainId !== 43113) {
    return { error: 'Unsupported network. Please switch to Avalanche Fuji or Ethereum Sepolia' };
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    // Get contract configuration based on the current chain ID
    const contractConfig = getContractConfig(chainId);

    console.log(`Using contracts for chain ID: ${chainId}`);

    // Create contract instances
    const realEstateRegistry = new ethers.Contract(
      contractConfig.RealEstateRegistry.address,
      contractConfig.RealEstateRegistry.abi,
      signer
    );

    const assetTokenizationManager = new ethers.Contract(
      contractConfig.AssetTokenizationManager.address,
      contractConfig.AssetTokenizationManager.abi,
      signer
    );

    const estateVerification = new ethers.Contract(
      contractConfig.EstateVerification.address,
      contractConfig.EstateVerification.abi,
      signer
    );

    return {
      provider,
      signer,
      realEstateRegistry,
      assetTokenizationManager,
      estateVerification,
      chainId // Include the chainId in the returned object
    };
  } catch (error) {
    console.error('Error creating contract instances:', error);
    return { error: 'Error creating contract instances: ' + error.message };
  }
};

// Create ERC20 token contract instance
export const getERC20Contract = (tokenAddress, signer) => {
  return new ethers.Contract(
    tokenAddress,
    ERC20ABI,
    signer
  );
};

// Approve tokens for spending
export const approveTokens = async (tokenAddress, spenderAddress, amount, signer) => {
  try {
    const tokenContract = getERC20Contract(tokenAddress, signer);
    const tx = await tokenContract.approve(spenderAddress, amount);
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    throw new Error('Failed to approve tokens: ' + error.message);
  }
};

export const getDecimalsFromTokenContract = async (tokenAddress, signer) => {
  try {
    const tokenContract = getERC20Contract(tokenAddress, signer);
    const decimals = await tokenContract.decimals();
    return decimals;
  }
  catch (error) {
    throw new Error('Failed to approve tokens: ' + error.message);
  }
}

// Get token balance
export const getTokenBalance = async (tokenAddress, ownerAddress, signer) => {
  try {
    const tokenContract = getERC20Contract(tokenAddress, signer);
    const balance = await tokenContract.balanceOf(ownerAddress);
    return balance;
  } catch (error) {
    throw new Error('Failed to get token balance: ' + error.message);
  }
};

// Get token allowance
export const getTokenAllowance = async (tokenAddress, ownerAddress, spenderAddress, signer) => {
  try {
    const tokenContract = getERC20Contract(tokenAddress, signer);
    const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
    return allowance;
  } catch (error) {
    throw new Error('Failed to get token allowance: ' + error.message);
  }
};

// Get all tokenized real estates
export const getAllTokenizedRealEstates = async (signer, walletAddress, realEstateRegistryAddr) => {
  try {
    console.log('Getting all tokenized estates...');

    // Get the current chain ID
    const provider = signer.provider;
    const { chainId } = await provider.getNetwork();

    console.log(`Current chain ID: ${chainId}`);

    // Get contract config for the current chain
    const contractConfig = getContractConfig(chainId);

    console.log(`Asset Tokenization Manager address: ${contractConfig.AssetTokenizationManager.address}`);

    const assetTokenizationManager = new ethers.Contract(
      contractConfig.AssetTokenizationManager.address,
      contractConfig.AssetTokenizationManager.abi,
      signer
    );

    const tokenCounter = await assetTokenizationManager.getTokenCounter();
    console.log(`Token counter: ${tokenCounter.toString()}`);

    const tokenizedEstates = [];

    const treAddrPromises = [];
    for (let tokenId = 0; tokenId < tokenCounter.toNumber(); tokenId++) {
      const tokenAddressPromise = assetTokenizationManager.getTokenIdToChainIdToTokenizedRealEstate(tokenId, chainId);
      treAddrPromises.push(tokenAddressPromise);
    }

    const treAddresses = await Promise.all(treAddrPromises);
    const treDataPromises = [];

    for (let tokenId = 0; tokenId < tokenCounter.toNumber(); tokenId++) {
      const tokenAddress = treAddresses[tokenId];

      const tokenContract = new ethers.Contract(
        tokenAddress,
        TokenizedRealEstateABI,
        signer
      );

      const nameWithAddr = tokenContract.name();
      const symbolWithAddr = tokenContract.symbol();
      const totalSupply = tokenContract.totalSupply();
      const paymentToken = tokenContract.getPaymentToken();
      const tokenPrice = tokenContract.getPerEstateTokenPrice();
      const balance = tokenContract.getEstateTokensMintedBy(walletAddress);
      const allowance = tokenContract.allowance(walletAddress, realEstateRegistryAddr);
      const userCollateralAmount = tokenContract.getCollateralDepositedBy(walletAddress);
      const userClaimedRewards = tokenContract.getClaimedRewards();
      const userClaimableRewards = tokenContract.getClaimableRewards();
      const allChainsBalance = tokenContract.balanceOf(walletAddress);

      treDataPromises.push({ nameWithAddr, symbolWithAddr, totalSupply, paymentToken, tokenPrice, balance, allowance, userCollateralAmount, userClaimedRewards, userClaimableRewards, allChainsBalance });
    }

    const treData = await Promise.all(
      treDataPromises.map(async (obj) => {
        const resolvedObj = {};

        for (const [key, value] of Object.entries(obj)) {
          resolvedObj[key] = await value;
        }

        return resolvedObj;
      })
    );

    const paymentTokenSymbolPromises = [];
    const paymentTokenDecimalsPromises = [];

    for (let tokenId = 0; tokenId < tokenCounter.toNumber(); tokenId++) {
      const { paymentToken } = treData[tokenId];

      if (paymentToken === ethers.constants.AddressZero) {
        paymentTokenSymbolPromises.push(chainId === 43113 ? 'AVAX' : 'ETH');
        paymentTokenDecimalsPromises.push(18);
      }
      else {
        const paymentTokenContract = getERC20Contract(paymentToken, signer);
        paymentTokenSymbolPromises.push(paymentTokenContract.symbol());
        paymentTokenDecimalsPromises.push(paymentTokenContract.decimals());
      }
    }

    const paymentTokenSymbols = await Promise.all(paymentTokenSymbolPromises);
    const paymentTokensDecimals = await Promise.all(paymentTokenDecimalsPromises);

    // Loop through all token IDs
    for (let tokenId = 0; tokenId < tokenCounter.toNumber(); tokenId++) {
      try {
        // Get the tokenized real estate contract address
        const tokenAddress = treAddresses[tokenId];

        // console.log(`Token ID ${tokenId} address: ${tokenAddress}`);

        // Skip if address is zero (not deployed on this chain)
        if (tokenAddress === ethers.constants.AddressZero) {
          // console.log(`Token ID ${tokenId} not deployed on chain ${chainId}`);
          continue;
        }
        const name = treData[tokenId].nameWithAddr.split(' - ')[0];
        const symbol = treData[tokenId].symbolWithAddr.split('-')[0];
        const estateOwner = treData[tokenId].nameWithAddr.split(' - ')[1];

        // console.log(`Token ID ${tokenId} details: ${name} (${symbol}), Total Supply: ${totalSupply.toString()}`);

        tokenizedEstates.push({
          tokenId,
          address: tokenAddress,
          name,
          symbol,
          estateOwner,
          totalSupply: treData[tokenId].totalSupply, // Store as BigNumber
          maxTreMintable: contractConfig.TokenizedRealEstate.MAX_TRE_MINTABLE,
          paymentToken: treData[tokenId].paymentToken,
          paymentTokenSymbol: paymentTokenSymbols[tokenId],
          tokenPrice: treData[tokenId].tokenPrice,
          formattedTokenPrice: ethers.utils.formatUnits(treData[tokenId].tokenPrice, paymentTokensDecimals[tokenId]),
          balance: treData[tokenId].balance,
          allowance: treData[tokenId].allowance,
          userCollateral: treData[tokenId].userCollateralAmount,
          allChainsBalance: chainId === 43113 ? treData[tokenId].allChainsBalance : undefined,
          formattedCollateral: ethers.utils.formatUnits(treData[tokenId].userCollateralAmount, paymentTokensDecimals[tokenId]),
          claimedRewards: ethers.utils.formatUnits(treData[tokenId].userClaimedRewards, paymentTokensDecimals[tokenId]),
          claimableRewards: ethers.utils.formatUnits(treData[tokenId].userClaimableRewards, paymentTokensDecimals[tokenId]),
          tokensAvailable: contractConfig.TokenizedRealEstate.MAX_TRE_MINTABLE.sub(ethers.BigNumber.from(treData[tokenId].totalSupply))
        });
      } catch (error) {
        console.error(`Error fetching token ID ${tokenId}:`, error);
        // Continue to next token ID even if this one fails
      }
    }
    console.log(tokenizedEstates);
    return tokenizedEstates;
  } catch (error) {
    console.error('Failed to get tokenized real estates:', error);
    throw new Error('Failed to get tokenized real estates: ' + error.message);
  }
};
