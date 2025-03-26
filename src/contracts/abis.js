// Contract ABIs for interacting with the blockchain

export const RealEstateRegistryABI = [
  // Admin functions
  "function setTokenForAnotherChain(address baseAcceptedToken, uint256 chainId, address tokenOnChain) external",
  "function addCollateralToken(address newToken, address dataFeed) external",
  "function updateVOVImplementation(address newImplementation) external",
  "function setSwapRouter(address newRouter) external",
  "function approveOperatorVault(string calldata operatorVaultEns) external",
  "function forceUpdateOperatorVault(string calldata operatorVaultEns) external",
  "function slashOperatorVault(string calldata operatorVaultEns, uint256 amount) external",
  "function emergencyWithdrawToken(address token) external",
  
  // Node Operator functions
  "function registerOperatorVault(string calldata ensName) external payable",
  "function verifyEstateOwner(address estateOwner, bytes32 realEstateId, uint256 realEstateValue, uint256 tokenizationPercentage) external",
  "function getOperatorVault(string calldata ensName) external view returns (address vaultAddress, address collateralToken, uint256 collateralAmount, bool isApproved, bool autoUpdateEnabled)",
  "function getOperatorVaultImplementation() external view returns (address)",
  "function toggleAutoUpdate(address implementation) external",
  "function upgradeToAndCall(address implementation) external",
  "function getAllOperators() external view returns (string[] memory)",
  
  // Estate Owner functions
  "function tokenizeEstate(string calldata tokenName, string calldata tokenSymbol, uint256 tokenSupply, uint256 tokenPrice, uint256 initialSalePercentage) external",
  "function withdrawFunds() external",
  "function getEstateIdByOwner(address owner) external view returns (bytes32)",
  "function getEstateDetails(bytes32 estateId) external view returns (address owner, string memory tokenName, string memory tokenSymbol, address tokenAddress, uint256 tokenSupply, uint256 tokenPrice, uint256 tokensSold, uint256 initialSalePercentage, uint256 fundsRaised, uint256 fundsWithdrawn, bool isTokenized)",
  
  // User functions
  "function buyTokens(bytes32 estateId, uint256 amount) external payable",
  "function sellTokens(bytes32 estateId, uint256 amount) external",
  "function getEstateCount() external view returns (uint256)",
  "function getEstateIdByIndex(uint256 index) external view returns (bytes32)",
  
  // Events
  "event OperatorVaultRegistered(string ensName, address vaultAddress, address collateralToken, uint256 collateralAmount)",
  "event OperatorVaultApproved(string ensName, address vaultAddress)",
  "event EstateOwnerVerified(address estateOwner, bytes32 realEstateId, uint256 realEstateValue, uint256 tokenizationPercentage)",
  "event EstateTokenized(bytes32 estateId, address owner, string tokenName, string tokenSymbol, address tokenAddress, uint256 tokenSupply, uint256 tokenPrice, uint256 initialSalePercentage)",
  "event TokensBought(bytes32 estateId, address buyer, uint256 amount, uint256 cost)",
  "event TokensSold(bytes32 estateId, address seller, uint256 amount, uint256 returnAmount)",
  "event FundsWithdrawn(bytes32 estateId, address owner, uint256 amount)"
];

export const AssetTokenizationManagerABI = [
  "function allowlistManager(uint64 chainSelector, address manager) external",
  "function isManagerAllowlisted(uint64 chainSelector, address manager) external view returns (bool)",
  "function sendMessageToChain(uint64 chainSelector, address receiver, bytes calldata data) external returns (bytes32)",
  "function receiveMessage(uint64 chainSelector, address sender, bytes calldata data) external",
  "event MessageSent(uint64 indexed chainSelector, address indexed receiver, bytes data)",
  "event MessageReceived(uint64 indexed chainSelector, address indexed sender, bytes data)"
];

export const TokenizedRealEstateABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount) returns (bool)",
  "function burn(uint256 amount) returns (bool)",
  "function burnFrom(address from, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 amount)"
];

export const VerifyingOperatorVaultABI = [
  "function initialize(address owner, address collateralToken, uint256 collateralAmount) external",
  "function verifyEstate(address estateOwner, bytes32 realEstateId, uint256 realEstateValue, uint256 tokenizationPercentage) external",
  "function withdrawCollateral() external",
  "function getCollateralInfo() external view returns (address token, uint256 amount)",
  "function isApproved() external view returns (bool)",
  "event EstateVerified(address estateOwner, bytes32 realEstateId, uint256 realEstateValue, uint256 tokenizationPercentage)"
];

export const EstateVerificationABI = [
  "function verifyEstate(address estateOwner, bytes32 realEstateId, uint256 realEstateValue, uint256 tokenizationPercentage) external",
  "function getVerificationStatus(address estateOwner, bytes32 realEstateId) external view returns (bool isVerified, uint256 realEstateValue, uint256 tokenizationPercentage)",
  "event EstateVerified(address estateOwner, bytes32 realEstateId, uint256 realEstateValue, uint256 tokenizationPercentage)"
];

// ERC20 Token ABI for interacting with tokenized assets
export const ERC20ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 amount)"
];
