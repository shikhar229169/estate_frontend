// Real Estate Registry ABI
const abi = [
  // Admin functions
  {
    "type": "function",
    "name": "setTokenForAnotherChain",
    "inputs": [
      { "name": "_tokenOnBaseChain", "type": "address", "internalType": "address" },
      { "name": "_chainId", "type": "uint256", "internalType": "uint256" },
      { "name": "_tokenOnAnotherChain", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setSwapRouter",
    "inputs": [
      { "name": "_swapRouter", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateVOVImplementation",
    "inputs": [
      { "name": "_newVerifyingOpVaultImplementation", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "slashOperatorVault",
    "inputs": [
      { "name": "_ensName", "type": "string", "internalType": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // Operator functions
  {
    "type": "function",
    "name": "getOperatorInfo",
    "inputs": [
      { "name": "_operator", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct RealEstateRegistry.OperatorInfo",
        "components": [
          { "name": "vault", "type": "address", "internalType": "address" },
          { "name": "ensName", "type": "string", "internalType": "string" },
          { "name": "stakedCollateralInFiat", "type": "uint256", "internalType": "uint256" },
          { "name": "stakedCollateralInToken", "type": "uint256", "internalType": "uint256" },
          { "name": "token", "type": "address", "internalType": "address" },
          { "name": "timestamp", "type": "uint256", "internalType": "uint256" },
          { "name": "isApproved", "type": "bool", "internalType": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOperatorVault",
    "inputs": [
      { "name": "_operator", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOperatorENSName",
    "inputs": [
      { "name": "_operator", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOperatorFromEns",
    "inputs": [
      { "name": "_ensName", "type": "string", "internalType": "string" }
    ],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  
  // Estate functions
  {
    "type": "function",
    "name": "tokenizeEstate",
    "inputs": [
      { "name": "_tokenName", "type": "string", "internalType": "string" },
      { "name": "_tokenSymbol", "type": "string", "internalType": "string" },
      { "name": "_tokenSupply", "type": "uint256", "internalType": "uint256" },
      { "name": "_tokenPrice", "type": "uint256", "internalType": "uint256" },
      { "name": "_initialSalePercentage", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "buyTokens",
    "inputs": [
      { "name": "_estateId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "_amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "sellTokens",
    "inputs": [
      { "name": "_estateId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "_amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawFunds",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getEstateIdByOwner",
    "inputs": [
      { "name": "_owner", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  
  // Events
  {
    "type": "event",
    "name": "OperatorVaultRegistered",
    "inputs": [
      { "name": "operator", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "vault", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OperatorVaultApproved",
    "inputs": [
      { "name": "approver", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "operator", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TokensBought",
    "inputs": [
      { "name": "buyer", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "estateId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "cost", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TokensSold",
    "inputs": [
      { "name": "seller", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "estateId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "returnAmount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FundsWithdrawn",
    "inputs": [
      { "name": "owner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "estateId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
];

export default abi;
