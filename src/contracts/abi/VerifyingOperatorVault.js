// Verifying Operator Vault ABI
const abi = [
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      { "name": "owner", "type": "address", "internalType": "address" },
      { "name": "collateralToken", "type": "address", "internalType": "address" },
      { "name": "collateralAmount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifyEstate",
    "inputs": [
      { "name": "estateOwner", "type": "address", "internalType": "address" },
      { "name": "realEstateId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "realEstateValue", "type": "uint256", "internalType": "uint256" },
      { "name": "tokenizationPercentage", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawCollateral",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getCollateralInfo",
    "inputs": [],
    "outputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isApproved",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "EstateVerified",
    "inputs": [
      { "name": "estateOwner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "realEstateId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "realEstateValue", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "tokenizationPercentage", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
];

export default abi;
