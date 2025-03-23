// Asset Tokenization Manager ABI
const abi = [
  {
    "type": "function",
    "name": "allowlistManager",
    "inputs": [
      { "name": "chainSelector", "type": "uint64", "internalType": "uint64" },
      { "name": "manager", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isManagerAllowlisted",
    "inputs": [
      { "name": "chainSelector", "type": "uint64", "internalType": "uint64" },
      { "name": "manager", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "sendMessageToChain",
    "inputs": [
      { "name": "chainSelector", "type": "uint64", "internalType": "uint64" },
      { "name": "receiver", "type": "address", "internalType": "address" },
      { "name": "data", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "receiveMessage",
    "inputs": [
      { "name": "chainSelector", "type": "uint64", "internalType": "uint64" },
      { "name": "sender", "type": "address", "internalType": "address" },
      { "name": "data", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getTokenCounter",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTokenIdToChainIdToTokenizedRealEstate",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" },
      { "name": "chainId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "MessageSent",
    "inputs": [
      { "name": "chainSelector", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "receiver", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "data", "type": "bytes", "indexed": false, "internalType": "bytes" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MessageReceived",
    "inputs": [
      { "name": "chainSelector", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "sender", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "data", "type": "bytes", "indexed": false, "internalType": "bytes" }
    ],
    "anonymous": false
  }
];

export default abi;
