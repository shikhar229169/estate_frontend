// Estate Verification ABI
const abi = [
  {
    "type": "function",
    "name": "verifyEstate",
    "inputs": [
      { "name": "_estateOwner", "type": "address", "internalType": "address" },
      { "name": "_realEstateId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "_realEstateValue", "type": "uint256", "internalType": "uint256" },
      { "name": "_tokenizationPercentage", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getVerificationStatus",
    "inputs": [
      { "name": "_estateOwner", "type": "address", "internalType": "address" },
      { "name": "_realEstateId", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      { "name": "isVerified", "type": "bool", "internalType": "bool" },
      { "name": "realEstateValue", "type": "uint256", "internalType": "uint256" },
      { "name": "tokenizationPercentage", "type": "uint256", "internalType": "uint256" }
    ],
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
