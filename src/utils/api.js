import axios from 'axios';
import { ethers } from 'ethers';
import contractConfig from '../contracts/contractConfig';

// Use the deployed backend URL on Vercel
const API_URL = 'https://estate-backend-liart.vercel.app/api/v1';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Set withCredentials to true to allow CORS with credentials
  withCredentials: true
});

// Add authorization token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('API Request:', config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response ? {
      status: error.response.status,
      url: error.config.url,
      data: error.response.data
    } : 'Network Error');
    
    return Promise.reject(error.response ? error.response.data : {
      message: 'Network error. Please check your connection or the server may be down.',
      status: 'error'
    });
  }
);

// Admin API calls
export const adminLogin = async (email, password) => {
  try {
    const response = await api.post('/admin/login', { email, password });
    return response.data;
  } catch (error) {
    console.error('Admin login error:', error);
    throw error;
  }
};

export const registerAdmin = async (adminData) => {
  try {
    const response = await api.post('/admin/register', adminData);
    return response.data;
  } catch (error) {
    console.error('Admin registration error:', error);
    throw error;
  }
};

// Blockchain interaction functions
export const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  } catch (error) {
    throw new Error('Failed to connect wallet: ' + error.message);
  }
};

// Get provider and signer
export const getProviderAndSigner = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  return { provider, signer };
};

// Get contract instance
export const getContract = async (contractName) => {
  const { signer } = await getProviderAndSigner();
  const config = contractConfig[contractName];
  
  if (!config) {
    throw new Error(`Contract configuration for ${contractName} not found`);
  }
  
  return new ethers.Contract(config.address, config.abi, signer);
};

// Get TokenizedRealEstate contract instance by address
export const getTokenizedRealEstateContract = async (address) => {
  const { signer } = await getProviderAndSigner();
  return new ethers.Contract(address, contractConfig.USDC.abi, signer);
};

// Real Estate Registry functions
export const getOperatorInfo = async (operatorAddress) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const operatorInfo = await contract.getOperatorInfo(operatorAddress);
    return operatorInfo;
  } catch (error) {
    console.error('Failed to get operator info:', error);
    throw error;
  }
};

export const registerOperatorVault = async (ensName) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const tx = await contract.registerOperatorVault(ensName);
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to register operator vault:', error);
    throw error;
  }
};

export const verifyEstateOwner = async (estateOwner, realEstateId, realEstateValue, tokenizationPercentage) => {
  try {
    const contract = await getContract('EstateVerification');
    const tx = await contract.verifyEstate(estateOwner, realEstateId, realEstateValue, tokenizationPercentage);
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to verify estate owner:', error);
    throw error;
  }
};

// Get all tokenized real estates
export const getAllTokenizedRealEstates = async () => {
  try {
    const contract = await getContract('AssetTokenizationManager');
    const tokenCounter = await contract.getTokenCounter();
    
    // Current chain ID (Sepolia = 11155111)
    const chainId = 11155111;
    
    const tokenizedEstates = [];
    
    // Loop through all token IDs
    for (let tokenId = 0; tokenId < tokenCounter.toNumber(); tokenId++) {
      try {
        // Get the tokenized real estate contract address
        const tokenAddress = await contract.getTokenIdToChainIdToTokenizedRealEstate(tokenId, chainId);
        
        // Skip if address is zero (not deployed on this chain)
        if (tokenAddress === ethers.constants.AddressZero) {
          continue;
        }
        
        // Get the tokenized real estate contract
        const tokenContract = await getTokenizedRealEstateContract(tokenAddress);
        
        // Get token details
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const totalSupply = await tokenContract.totalSupply();
        
        tokenizedEstates.push({
          tokenId,
          address: tokenAddress,
          name,
          symbol,
          totalSupply: totalSupply.toString()
        });
      } catch (error) {
        console.error(`Error fetching token ID ${tokenId}:`, error);
        // Continue to next token ID even if this one fails
      }
    }
    
    return tokenizedEstates;
  } catch (error) {
    console.error('Failed to get tokenized real estates:', error);
    throw error;
  }
};

export const getEstateDetails = async (estateId) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const details = await contract.getEstateDetails(estateId);
    return details;
  } catch (error) {
    console.error('Failed to get estate details:', error);
    throw error;
  }
};

export const getEstateIdByOwner = async (ownerAddress) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const estateId = await contract.getEstateIdByOwner(ownerAddress);
    return estateId;
  } catch (error) {
    console.error('Failed to get estate ID:', error);
    throw error;
  }
};

export const tokenizeEstate = async (tokenName, tokenSymbol, tokenSupply, tokenPrice, initialSalePercentage) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const tx = await contract.tokenizeEstate(tokenName, tokenSymbol, tokenSupply, tokenPrice, initialSalePercentage);
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to tokenize estate:', error);
    throw error;
  }
};

export const buyTokens = async (estateId, amount, value) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const tx = await contract.buyTokens(estateId, amount, { value });
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to buy tokens:', error);
    throw error;
  }
};

export const sellTokens = async (estateId, amount) => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const tx = await contract.sellTokens(estateId, amount);
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to sell tokens:', error);
    throw error;
  }
};

export const withdrawFunds = async () => {
  try {
    const contract = await getContract('RealEstateRegistry');
    const tx = await contract.withdrawFunds();
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to withdraw funds:', error);
    throw error;
  }
};

// USDC token functions
export const approveUSDC = async (spender, amount) => {
  try {
    const contract = await getContract('USDC');
    const tx = await contract.approve(spender, amount);
    await tx.wait();
    return { success: true, transaction: tx.hash };
  } catch (error) {
    console.error('Failed to approve USDC:', error);
    throw error;
  }
};

export const getUSDCBalance = async (address) => {
  try {
    const contract = await getContract('USDC');
    const balance = await contract.balanceOf(address);
    return balance;
  } catch (error) {
    console.error('Failed to get USDC balance:', error);
    throw error;
  }
};

// Node Operator API calls
export const nodeOperatorLogin = async (email, password) => {
  try {
    const response = await api.post('/node/login', { email, password });
    return response.data;
  } catch (error) {
    console.error('Node operator login error:', error);
    throw error;
  }
};

export const registerNodeOperator = async (nodeData) => {
  try {
    const response = await api.post('/node/signup', nodeData);
    return response.data;
  } catch (error) {
    console.error('Node operator registration error:', error);
    throw error;
  }
};

export const updateNodeOperator = async (nodeId, nodeData) => {
  try {
    // const response = await api.put(`/node-operators/${nodeId}`, nodeData);
    const response = await api.patch(`/admin/nodes/${nodeId}`, nodeData);
    return response.data;
  } catch (error) {
    console.error('Update node operator error:', error);
    throw error;
  }
};

export const updateNodeOperatorAutoUpdate = async (nodeId, autoUpdateEnabled) => {
  try {
    const response = await api.patch(`/node/update-node/${nodeId}`, { autoUpdateEnabled });
    return response.data;
  } catch (error) {
    console.error('Update auto update status error:', error);
    throw error;
  }
};

export const updateNodeOperatorClaimedRewards = async (nodeId, claimedRewards) => {
  try {
    const response = await api.patch(`/node/update-node/${nodeId}`, { claimedRewards });
    return response.data;
  } catch (error) {
    console.error('Update claimed rewards error:', error);
    throw error;
  }
}

export const getAllNodeOperators = async () => {
  try {
    const response = await api.get('/admin/nodes');
    return response.data;
  } catch (error) {
    console.error('Failed to get all node operators:', error);
    throw error;
  }
};

export const registerNodeOperatorWithBlockchain = async (data) => {
  try {
    const response = await api.post('/node/blockchain-signup', {
      name: data.name,
      email: data.email,
      password: data.password,
      autoUpdateEnabled: data.autoUpdateEnabled,
      ensName: data.ensName,
      ethAddress: data.ethAddress,
      paymentToken: data.paymentToken,
      signature: data.signature,
      vaultAddress: data.vaultAddress,
      isApproved: false
    });
    return response.data;
  } catch (error) {
    console.error('Error registering node operator:', error);
    throw error;
  }
};

export const checkNodeOperatorExists = async (walletAddress) => {
  try {
    const response = await api.get(`/node/check/${walletAddress}`);
    return response.data;
  } catch (error) {
    console.error('Failed to check node operator existence:', error);
    throw error;
  }
};

export const getNodeOperatorByWalletAddress = async (walletAddress) => {
  try {
    const response = await api.get(`/node/check/${ethers.utils.getAddress(walletAddress)}`);
    if (response.data.exists === false) {
      const newResponse = await api.get(`/node/check/${walletAddress}`);
      return newResponse.data;
    }
    return response.data;
  } catch (error) {
    console.error('Failed to get node operator by wallet address:', error);
    throw error;
  }
};

export const getApprovedNodeOperators = async () => {
  try {
    const response = await api.get('/node/get-approved-nodes', { headers: { 'x-api-key': 123 } });
    return response.data;
  } catch (error) {
    console.error('Failed to get approved node operators:', error);
    throw error;
  }
};

// Estate Owner (User) API calls
export const registerEstateOwner = async (userData) => {
  try {
    const response = await api.post('/user/register', userData);
    return response.data;
  } catch (error) {
    console.error('Estate owner registration error:', error);
    throw error;
  }
};

export const getAllEstateOwners = async () => {
  try {
    const response = await api.get('/user');
    return response.data;
  } catch (error) {
    console.error('Failed to get all estate owners:', error);
    throw error;
  }
};

export const getEstateOwnerByAddress = async (ethAddress) => {
  try {
    const response = await api.get(`/user/eth/${ethAddress}`, { headers: { 'x-api-key': 123 } });
    return response.data;
  } catch (error) {
    console.error('Failed to get estate owner by address:', error);
    throw error;
  }
};

export const updateCollateral = async (ethAddress, updateType, collateralChange) => {
  try {
    if (updateType === 'deposit') {
      const bodyData = { collateralDeposited: Number(collateralChange) };
      const response = await api.patch(`/user/addCollateralOnEstateOwner/${ethAddress}`, bodyData, { headers: { 'x-api-key': 123 } });
      return response.data;
    }
    else {
      const bodyData = { collateralWithdrawn: Number(collateralChange) };
      const response = await api.patch(`/user/subtractCollateralOnEstateOwner/${ethAddress}`, bodyData, { headers: { 'x-api-key': 123 } });
      return response.data;
    }
  }
  catch (error) {
    console.error('Error updating collateral:', error);
    throw error;
  }
}

export const getEstateOwnersByNodeOperator = async (nodeOperatorEns) => {
  try {
    const response = await api.get(`/node/filtered-users?nodeOperatorAssigned=${nodeOperatorEns}`);
    const estateOwners = response.data.data.users;
    return estateOwners;
  } catch (error) {
    console.error('Failed to get estate owners by node operator:', error);
    throw error;
  }
};

// Currently used to update estate cost and estate rewards
export const updateEstateOwnerData = async(estateOwnerId, bodyData) => {
  try {
    const response = await api.patch(`/user/update/${estateOwnerId}`, bodyData, { headers: { 'x-api-key': 123 } });
    return response.data;
  }
  catch (error) {
    console.error('Estate owner update error:', error);
    throw error;
  }
}

export const upsertTokenizedPositionData = async(data) => {
  console.log(123);
  try {
    const response = await api.post('/user/upsert-tokenized-position', data, { headers: { 'x-api-key': 123 } });
    return response.data;
  }
  catch (error) {
    console.error('Tokenized Position Upsert Failed', error);
    throw error;
  }
}

export const getAllUserParticularTreData = async(tokenizedRealEstateAddr) => {
  try {
    const response = await api.get(`/user/get-all-user-tokenized-position?tokenizedRealEstateAddress=${tokenizedRealEstateAddr}`, { headers: { 'x-api-key': 123 } });
    return response.data.data.allUserTokenizedPosition;
  }
  catch (error) {
    console.error('Failed to get User TRE Position Data', error);
    throw error;
  }
}

export const createTreLog = async(data) => {
  try {
    const response = await api.post('/user/tre-log/add', data, { headers: { 'x-api-key': 123 } });
    return response.data;
  }
  catch (error) {
    console.error('Error Creating TRE log', error);
    throw error;
  }
}

export const getParticularTreLog = async(tokenizedRealEstateAddress) => {
  try {
    const response = await api.get(`/user/tre-log/detail?tokenizedRealEstateAddress=${tokenizedRealEstateAddress}`, { headers: { 'x-api-key': 123 } });
    return response.data.data.treLogs;
  }
  catch (error) {
    console.error('Error fetching TRE Log', error);
    throw error;
  }
}

export const getUserTreLog = async(tokenizedRealEstateAddress, userAddress) => {
  try {
    const response = await api.get(`/user/tre-log/detail?tokenizedRealEstateAddress=${tokenizedRealEstateAddress}&userAddress=${userAddress}`, { headers: { 'x-api-key': 123 } });
    return response.data.data.treLogs;
  }
  catch (error) {
    console.error('Error fetching User TRE Log', error);
    throw error;
  }
}

export const createCrossChainTxnLog = async(data) => {
  try {
    const response = await api.post('/user/cross-chain-txn/add', data, { headers: { 'x-api-key': 123 } });
    return response.data;
  }
  catch (error) {
    console.error('Error Creating Cross Chain Txn log', error);
    throw error;
  }
}

export const getUserCrossChainTxnLogs = async(tokenizedRealEstateAddress, userAddress) => {
  try {
    const response = await api.get(`/user/cross-chain-txn/detail?tokenizedRealEstateAddress=${tokenizedRealEstateAddress}&userAddress=${userAddress}`, { headers: { 'x-api-key': 123 } });
    return response.data.data.crossChainTxns;
  }
  catch (error) {
    console.error('Error fetching User Cross Chain Txn Log', error);
    throw error;
  }
}

export const updateEstateOwnerByNode = async (userId) => {
  try {
    const response = await api.patch(`/node/users/${userId}/verify`)
    return response.data;
  } catch (error) {
    console.error('Estate owner update error:', error);
    throw error;
  }
};

// Utility function to handle file uploads
export const uploadFile = async (file, type) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await axios.post(`${API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

export default api;
