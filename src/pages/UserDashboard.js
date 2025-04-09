import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Spinner, Form, Row, Col, Modal, Container, Badge } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork, getAllTokenizedRealEstates, getERC20Contract } from '../utils/interact';
import { getEstateOwnerByAddress, updateCollateral, upsertTokenizedPositionData, createTreLog, getUserTreLog } from '../utils/api';
import TokenizedRealEstateABI from '../contracts/abi/TokenizedRealEstate';
// Import FontAwesome icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingCart, faTags, faCoins, faMoneyBillTransfer, faDollarSign, faSnowflake, faMoneyCheckDollar, 
  faInfoCircle, faHistory, faDownload, faHome, faChartLine, faWallet, faBuilding, faLayerGroup, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
// Import Excel export library
import * as XLSX from 'xlsx';

const UserDashboard = ({ walletAddress, chainId }) => {
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenizedEstates, setTokenizedEstates] = useState([]);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedEstate, setSelectedEstate] = useState(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAmount, setSellAmount] = useState('');
  const [currentChainId, setCurrentChainId] = useState(null);
  const [showDepositCollateralModal, setShowDepositCollateralModal] = useState(false);
  const [showWithdrawCollateralModal, setShowWithdrawCollateralModal] = useState(false);
  const [depositCollateralAmount, setDepositCollateralAmount] = useState('');
  const [withdrawCollateralAmount, setWithdrawCollateralAmount] = useState('');
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [estateOwnerDetails, setEstateOwnerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showTransactionHistoryModal, setShowTransactionHistoryModal] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingTransactionHistory, setLoadingTransactionHistory] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        console.log(`Chain changed to: ${newChainId}`);
        setCurrentChainId(newChainId);
        window.location.reload();
      };

      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  useEffect(() => {
    const loadContracts = async () => {
      if (walletAddress && chainId) {
        setCurrentChainId(chainId);
        console.log(`Loading contracts for chain ID: ${chainId}`);
        const contractInstances = getContracts(chainId);
        if (contractInstances && !contractInstances.error) {
          setContracts(contractInstances);
          await loadTokenizedEstates(contractInstances);
        } else if (contractInstances && contractInstances.error) {
          setError(contractInstances.error);
        }
      }
    };

    loadContracts();
  }, [walletAddress, chainId]);

  const formatTREAmount = (amount) => {
    return ethers.utils.formatUnits(amount, 18);
  }

  const formatTokenAmount = async (amount, token, signer) => {
    let decimals;
    if (token === ethers.constants.AddressZero) {
      decimals = 18;
    }
    else {
      const tokenContract = getERC20Contract(token, contracts?.signer || signer);
      decimals = await tokenContract.decimals();
    }
    return ethers.utils.formatUnits(amount, decimals);
  }

  const loadTokenizedEstates = async (contractInstances) => {
    try {
      setLoading(true);
      setError('');

      console.log(`Loading tokenized estates for chain ID: ${contractInstances.chainId}`);

      const estates = await getAllTokenizedRealEstates(contractInstances.signer);

      for (const estate of estates) {
        try {
          const tokenContract = new ethers.Contract(
            estate.address,
            TokenizedRealEstateABI,
            contractInstances.signer
          );

          const balance = await tokenContract.getEstateTokensMintedBy(walletAddress);

          // Allowance
          const allowance = await tokenContract.allowance(walletAddress, contractInstances.realEstateRegistry.address);

          estate.balance = balance;
          estate.allowance = allowance;
          estate.tokenPrice = await tokenContract.getPerEstateTokenPrice();

          const totalSupplyBN = ethers.BigNumber.from(estate.totalSupply);
          estate.tokensAvailable = estate.maxTreMintable.sub(totalSupplyBN);

          const formattedTokenPrice = await formatTokenAmount(estate.tokenPrice, estate.paymentToken, contractInstances.signer);
          estate.formattedTokenPrice = formattedTokenPrice;

          // Load user's collateral for this estate
          try {
            const userCollateralAmount = await tokenContract.getCollateralDepositedBy(walletAddress);
            const userClaimedRewards = await tokenContract.getClaimedRewards();
            const userClaimableRewards = await tokenContract.getClaimableRewards();

            estate.userCollateral = userCollateralAmount;

            // Format user collateral based on payment token decimals
            const formattedCollateral = await formatTokenAmount(userCollateralAmount, estate.paymentToken, contractInstances.signer);
            const formattedClaimedRewards = await formatTokenAmount(userClaimedRewards, estate.paymentToken, contractInstances.signer);
            const formattedClaimableRewards = await formatTokenAmount(userClaimableRewards, estate.paymentToken, contractInstances.signer);

            if (chainId === 43113) {
              const allChainsBalance = await tokenContract.balanceOf(walletAddress);
              estate.allChainsBalance = allChainsBalance;
            }

            estate.formattedCollateral = formattedCollateral;
            estate.claimedRewards = formattedClaimedRewards;
            estate.claimableRewards = formattedClaimableRewards;
          } catch (error) {
            console.error(`Error fetching collateral for ${estate.address}:`, error);
            estate.userCollateral = ethers.BigNumber.from(0);
            estate.formattedCollateral = "0";
          }

        } catch (error) {
          console.error(`Error fetching balance for token ${estate.address}:`, error);
        }
      }

      setTokenizedEstates(estates);
    } catch (error) {
      console.error('Error loading tokenized estates:', error);
      setError(`Error loading tokenized estates: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyTokens = async (e) => {
    e.preventDefault();
    if (!contracts || !selectedEstate) {
      setError('Contracts not loaded or no estate selected');
      return;
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setError('Please enter a valid amount to buy');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const buyAmountWei = ethers.utils.parseEther(buyAmount);

      // Check if estate has enough tokens available
      if (buyAmountWei.gt(selectedEstate.tokensAvailable)) {
        setError(`Not enough tokens available. Maximum available: ${ethers.utils.formatEther(selectedEstate.tokensAvailable)}`);
        setLoading(false);
        return;
      }

      const tokenContract = new ethers.Contract(
        selectedEstate.address,
        TokenizedRealEstateABI,
        contracts.signer
      );

      const backendUpdateData = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        paymentToken: selectedEstate.paymentToken,
        paymentTokenSymbol: selectedEstate.paymentTokenSymbol,
        treMinted: Number(formatTREAmount(selectedEstate.balance)) + Number(buyAmount)
      }

      let tx;

      // Buy tokens
      if (chainId === 43113) {
        tx = await tokenContract.buyRealEstatePartialOwnershipWithCollateral(
          buyAmountWei
        );

        await tx.wait();
        setSuccess(`Successfully purchased ${buyAmount} ${selectedEstate.symbol} tokens!`);
      }
      else {
        tx = await tokenContract.buyRealEstatePartialOwnershipOnNonBaseChain(
          buyAmountWei,
          false, // mintIfLess
          500000 // gasLimit
        );

        await tx.wait();
        setSuccess(`Cross Chain Purchase Request Placed ${buyAmount} ${selectedEstate.symbol} tokens!`);
      }

      const treLog = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        transactionType: "TRE_BUY",
        transactionAmount: Number(buyAmount),
        transactionSymbol: "TRE",
        transactionHash: tx.hash,
      }

      await upsertTokenizedPositionData(backendUpdateData);
      await createTreLog(treLog);

      setShowBuyModal(false);
      setBuyAmount('');

      // Refresh data
      await loadTokenizedEstates(contracts);
    } catch (error) {
      console.error('Error buying tokens:', error);
      setError(`Error buying tokens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSellTokens = async (e) => {
    e.preventDefault();
    if (!contracts || !selectedEstate) {
      setError('Contracts not loaded or no estate selected');
      return;
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      setError('Please enter a valid amount to sell');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const sellAmountWei = ethers.utils.parseEther(sellAmount);

      // Check if user has enough tokens
      if (sellAmountWei.gt(selectedEstate.balance)) {
        setError(`Not enough tokens. Your balance: ${ethers.utils.formatEther(selectedEstate.balance)}`);
        setLoading(false);
        return;
      }

      console.log(`Selling tokens: ${sellAmountWei.toString()} of token ID ${selectedEstate.id}`);

      const tokenContract = new ethers.Contract(
        selectedEstate.address,
        TokenizedRealEstateABI,
        contracts.signer
      );

      const backendUpdateData = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        paymentToken: selectedEstate.paymentToken,
        paymentTokenSymbol: selectedEstate.paymentTokenSymbol,
        treMinted: Number(formatTREAmount(selectedEstate.balance)) - Number(sellAmount)
      }

      let tx;

      // Sell tokens
      if (chainId === 43113) {
        tx = await tokenContract.burnEstateOwnershipTokens(
          sellAmountWei
        );

        await tx.wait();
        setSuccess(`Successfully sold ${sellAmount} ${selectedEstate.symbol} tokens!`);
      }
      else {
        tx = await tokenContract.burnEstateOwnershipTokensOnNonBaseChain(
          sellAmountWei,
          500000 // gasLimit
        );

        await tx.wait();
        setSuccess(`Cross Chain Sell Request Placed ${sellAmount} ${selectedEstate.symbol} tokens!`);
      }

      const treLog = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        transactionType: "TRE_SELL",
        transactionAmount: Number(sellAmount),
        transactionSymbol: "TRE",
        transactionHash: tx.hash,
      }

      await upsertTokenizedPositionData(backendUpdateData);
      await createTreLog(treLog);

      setShowSellModal(false);
      setSellAmount('');

      // Refresh data
      await loadTokenizedEstates(contracts);
    } catch (error) {
      console.error('Error selling tokens:', error);
      setError(`Error selling tokens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositCollateral = async (e) => {
    e.preventDefault();
    if (!contracts || !selectedEstate) {
      setError('Contracts not loaded or no estate selected');
      return;
    }

    if (!depositCollateralAmount || parseFloat(depositCollateralAmount) <= 0) {
      setError('Please enter a valid amount to deposit');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create contract instances
      const tokenContract = new ethers.Contract(
        selectedEstate.address,
        TokenizedRealEstateABI,
        contracts.signer
      );

      // Get payment token contract
      const paymentToken = getERC20Contract(selectedEstate.paymentToken, contracts.signer);

      // Get decimals for the payment token
      let decimals = 18;
      if (selectedEstate.paymentToken !== ethers.constants.AddressZero) {
        decimals = await paymentToken.decimals();
      }

      // Format amount with proper decimals
      const collateralAmountWei = ethers.utils.parseUnits(depositCollateralAmount, decimals);

      // If not native token, check approval and approve if needed
      if (selectedEstate.paymentToken !== ethers.constants.AddressZero) {
        const allowance = await paymentToken.allowance(walletAddress, selectedEstate.address);

        if (allowance.lt(collateralAmountWei)) {
          console.log(`Approving collateral deposit: ${collateralAmountWei.toString()}`);
          const approveTx = await paymentToken.approve(
            selectedEstate.address,
            collateralAmountWei
          );
          await approveTx.wait();
          console.log('Approval transaction complete');
        }
      }

      const backendUpdateData = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        paymentToken: selectedEstate.paymentToken,
        paymentTokenSymbol: selectedEstate.paymentTokenSymbol,
        collateralDeposited: Number(depositCollateralAmount) + Number(selectedEstate.formattedCollateral)
      }

      // Call depositCollateral function
      let tx;
      if (selectedEstate.paymentToken === ethers.constants.AddressZero) {
        // For native token (ETH/AVAX), send value
        tx = await tokenContract.depositCollateral(collateralAmountWei, { value: collateralAmountWei });
      } else {
        tx = await tokenContract.depositCollateral(collateralAmountWei);
      }

      await tx.wait();

      const treLog = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        transactionType: "COLLATERAL_DEPOSIT",
        transactionAmount: Number(depositCollateralAmount),
        transactionSymbol: selectedEstate.paymentTokenSymbol,
        transactionHash: tx.hash,
      }

      await updateCollateral(selectedEstate.estateOwner, 'deposit', depositCollateralAmount);
      await upsertTokenizedPositionData(backendUpdateData);
      await createTreLog(treLog);

      setSuccess(`Successfully deposited ${depositCollateralAmount} ${selectedEstate.paymentTokenSymbol} as collateral!`);
      setShowDepositCollateralModal(false);
      setDepositCollateralAmount('');

      // Refresh data
      await loadTokenizedEstates(contracts);
    } catch (error) {
      console.error('Error depositing collateral:', error);
      setError(`Error depositing collateral: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawCollateral = async (e) => {
    e.preventDefault();
    if (!contracts || !selectedEstate) {
      setError('Contracts not loaded or no estate selected');
      return;
    }

    if (!withdrawCollateralAmount || parseFloat(withdrawCollateralAmount) <= 0) {
      setError('Please enter a valid amount to withdraw');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create contract instance for the tokenized real estate
      const tokenContract = new ethers.Contract(
        selectedEstate.address,
        TokenizedRealEstateABI,
        contracts.signer
      );

      // Get decimals for the payment token
      let decimals = 18;
      if (selectedEstate.paymentToken !== ethers.constants.AddressZero) {
        const paymentToken = getERC20Contract(selectedEstate.paymentToken, contracts.signer);
        decimals = await paymentToken.decimals();
      }

      // Format amount with proper decimals
      const collateralAmountWei = ethers.utils.parseUnits(withdrawCollateralAmount, decimals);

      const backendUpdateData = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        paymentToken: selectedEstate.paymentToken,
        paymentTokenSymbol: selectedEstate.paymentTokenSymbol,
        collateralDeposited: Number(selectedEstate.formattedCollateral) - Number(withdrawCollateralAmount)
      }

      // Call withdrawCollateral function
      const tx = await tokenContract.withdrawCollateral(collateralAmountWei);
      await tx.wait();

      const treLog = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        transactionType: "COLLATERAL_WITHDRAW",
        transactionAmount: Number(withdrawCollateralAmount),
        transactionSymbol: selectedEstate.paymentTokenSymbol,
        transactionHash: tx.hash,
      }

      await updateCollateral(selectedEstate.estateOwner, 'withdraw', withdrawCollateralAmount);
      await upsertTokenizedPositionData(backendUpdateData);
      await createTreLog(treLog);

      setSuccess(`Successfully withdrawn ${withdrawCollateralAmount} ${selectedEstate.paymentTokenSymbol} from collateral!`);
      setShowWithdrawCollateralModal(false);
      setWithdrawCollateralAmount('');

      // Refresh data
      await loadTokenizedEstates(contracts);
    } catch (error) {
      console.error('Error withdrawing collateral:', error);
      setError(`You can't withdraw more than your deposited collateral: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (e) => {
    e.preventDefault();
    if (!contracts || !selectedEstate) {
      setError('Contracts not loaded or no estate selected');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create contract instance for the tokenized real estate
      const tokenContract = new ethers.Contract(
        selectedEstate.address,
        TokenizedRealEstateABI,
        contracts.signer
      );

      // Call claim rewards function
      const tx = await tokenContract.claimRewardsForEstateOwnershipTokens();
      await tx.wait();

      const rewardsCollected = await tokenContract.getClaimedRewards();
      const formattedRewardsCollected = await formatTokenAmount(rewardsCollected, selectedEstate.paymentToken);

      const backendUpdateData = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        paymentToken: selectedEstate.paymentToken,
        paymentTokenSymbol: selectedEstate.paymentTokenSymbol,
        rewardsCollected: Number(formattedRewardsCollected)
      }

      const treLog = {
        userAddress: walletAddress,
        tokenizedRealEstateAddress: selectedEstate.address,
        transactionType: "REWARDS_COLLECT",
        transactionAmount: Number(formattedRewardsCollected),
        transactionSymbol: selectedEstate.paymentTokenSymbol,
        transactionHash: tx.hash,
      }

      await upsertTokenizedPositionData(backendUpdateData);
      await createTreLog(treLog);

      setSuccess(`Successfully Claimed Tokens`);
      setShowRewardModal(false);

      // Refresh data
      await loadTokenizedEstates(contracts);
    } catch (error) {
      console.error('Error Claiming Reward:', error);
      setError(`Error Claiming Reward: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // New function to fetch estate owner details
  const fetchEstateOwnerDetails = async (estateOwnerAddress) => {
    try {
      setLoadingDetails(true);
      const response = await getEstateOwnerByAddress(estateOwnerAddress);
      const estateDetails = response.data.user;

      const tre = new ethers.Contract(selectedEstate.address, TokenizedRealEstateABI, contracts.signer);
      const paymentToken = await tre.getPaymentToken();

      const estateCost = chainId === 43113 ? await formatTokenAmount(estateDetails.currentEstateCost, estateDetails.token, contracts.signer) : "";
      const rewards = chainId === 43113 ? await formatTokenAmount(estateDetails.rewards, estateDetails.token, contracts.signer) : "";
      setEstateOwnerDetails({ ...estateDetails, currentEstateCost: estateCost, rewards: rewards, token: paymentToken });
      setError('');
    } catch (error) {
      console.error('Error fetching estate owner details:', error);
      setError('Failed to load estate owner details. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (estate) => {
    setSelectedEstate(estate);
    await fetchEstateOwnerDetails(estate.estateOwner);
    setShowDetailsModal(true);
  };

  // New function: Helper function to get the correct block explorer URL based on chainId
  const getBlockExplorerUrl = (addressOrHash, isTransaction = false) => {
    const chainId = window.ethereum?.chainId ? parseInt(window.ethereum.chainId, 16) : 1;
    
    let baseUrl = 'https://etherscan.io';
    let pathPrefix = isTransaction ? 'tx' : 'address';
    
    if (chainId === 43113) {
      // Avalanche Fuji Testnet
      baseUrl = 'https://testnet.snowtrace.io';
    } else if (chainId === 11155111) {
      // Ethereum Sepolia Testnet
      baseUrl = 'https://sepolia.etherscan.io';
    } else if (chainId === 43114) {
      // Avalanche Mainnet
      baseUrl = 'https://snowtrace.io';
    }
    
    return `${baseUrl}/${pathPrefix}/${addressOrHash}`;
  };

  // Format date helper function
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Helper function to get transaction type badge color
  const getTransactionBadgeColor = (transactionType) => {
    switch(transactionType.toLowerCase()) {
      case 'collateral_deposit':
        return 'success';
      case 'collateral_withdraw':
        return 'warning';
      case 'tre_buy':
        return 'primary';
      case 'tre_sell':
        return 'danger';
      case 'rewards_collect':
        return 'info';
      default:
        return 'secondary';
    }
  };

  // Handle viewing transaction history
  const handleViewTransactionHistory = async (estate) => {
    setSelectedEstate(estate);
    setShowTransactionHistoryModal(true);
    await fetchTransactionHistory(estate);
  };

  // Fetch transaction history for a specific estate
  const fetchTransactionHistory = async (estate) => {
    try {
      setLoadingTransactionHistory(true);
      setError('');
      
      const response = await getUserTreLog(estate.address, walletAddress);
      setTransactionHistory(response);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      setError('Failed to load transaction history. Please try again.');
    } finally {
      setLoadingTransactionHistory(false);
    }
  };

  // Helper function to export transaction history to Excel file
  const exportToExcel = () => {
    if (!transactionHistory || transactionHistory.length === 0 || !selectedEstate || !walletAddress) return;

    // Create worksheet data
    const worksheetData = transactionHistory.map(transaction => ({
      'Date': formatDate(transaction.createdAt),
      'Transaction Type': transaction.transactionType,
      'Amount': transaction.transactionAmount,
      'Token': transaction.transactionSymbol,
      'Transaction Hash': transaction.transactionHash
    }));

    // Create a new workbook and add the data
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    // Generate file name using the requested format
    const shortTreAddress = selectedEstate.address.slice(0, 10); // Shorten for file name
    const shortUserAddress = walletAddress.slice(0, 10); // Shorten for file name
    const fileName = `tre-log-${shortTreAddress}-${shortUserAddress}.xlsx`;

    // Export to file
    XLSX.writeFile(workbook, fileName);
  };

  const handleNetworkSwitch = async (targetChainId) => {
    try {
      setLoading(true);
      await switchNetwork(targetChainId);
      window.location.reload();
    } catch (error) {
      setError(`Error switching network: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-title">
            <h2><FontAwesomeIcon icon={faHome} className="me-3" />Real Estate Investment Dashboard</h2>
            <p>Browse tokenized properties, invest in real estate tokens, and manage your portfolio</p>
          </div>
          <div className="dashboard-stats">
            <div className="stat-item">
              <div className="stat-icon">
                <FontAwesomeIcon icon={faBuilding} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{tokenizedEstates.length}</div>
                <div className="stat-label">Available Properties</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">
                <FontAwesomeIcon icon={faLayerGroup} />
              </div>
              <div className="stat-content">
                <div className="stat-value">
                  {tokenizedEstates.filter(estate => 
                    estate.balance && !estate.balance.isZero()).length}
                </div>
                <div className="stat-label">Your Investments</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">
                <FontAwesomeIcon icon={faWallet} />
              </div>
              <div className="stat-content">
                <div className="stat-value">
                  {currentChainId && (currentChainId === 43113 ? 'AVAX' : 'ETH')}
                </div>
                <div className="stat-label">Network</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <Alert variant="danger" className="dashboard-alert"><FontAwesomeIcon icon={faInfoCircle} className="me-2" />{error}</Alert>}
      {success && <Alert variant="success" className="dashboard-alert"><FontAwesomeIcon icon={faCheckCircle} className="me-2" />{success}</Alert>}

      {loading && (
        <div className="text-center my-5 py-5">
          <div className="custom-spinner"></div>
          <p className="loading-text mt-3">Loading your investments...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="network-switcher-section">
            <div className="d-flex flex-wrap justify-content-between align-items-center">
              <h3 className="section-title">Network Switcher</h3>
              <div className="network-switcher">
                <Button
                  variant={currentChainId === 11155111 ? "dark" : "outline-dark"}
                  className={`me-2 btn-network ${currentChainId === 11155111 ? 'active' : ''}`}
                  onClick={() => handleNetworkSwitch(11155111)}
                  disabled={loading || currentChainId === 11155111}
                >
                  <FontAwesomeIcon icon={faDollarSign} className="me-2" /> Ethereum Sepolia
                </Button>
                <Button
                  variant={currentChainId === 43113 ? "dark" : "outline-dark"}
                  className={`btn-network ${currentChainId === 43113 ? 'active' : ''}`}
                  onClick={() => handleNetworkSwitch(43113)}
                  disabled={loading || currentChainId === 43113}
                >
                  <FontAwesomeIcon icon={faSnowflake} className="me-2" /> Avalanche Fuji
                </Button>
              </div>
            </div>
            <p className="network-description">
              Switch between networks to view and manage your cross-chain real estate investments.
              <br />Base chain (Avalanche) provides full functionality, while other chains enable cross-chain ownership.
            </p>
          </div>

          <h3 className="section-title">Available Real Estate Tokens</h3>

          {tokenizedEstates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FontAwesomeIcon icon={faBuilding} />
              </div>
              <h4>No tokenized estates available</h4>
              <p>Check back later for new investment opportunities</p>
            </div>
          ) : (
            <Row className="properties-grid">
              {tokenizedEstates.map((estate, index) => (
                <Col md={6} lg={4} key={index} className="mb-4">
                  <Card className="property-card">
                    <div className="property-header">
                      <Badge bg="primary" className="property-id">ID: {estate.tokenId}</Badge>
                      <h4 className="property-name">{estate.name}</h4>
                      <div className="property-symbol">{estate.symbol}</div>
                      <div className="property-owner">
                        <span className="owner-label">Estate Owner:</span>
                        <span className="owner-address">{estate.estateOwner.substring(0, 6)}...{estate.estateOwner.substring(estate.estateOwner.length - 4)}</span>
                      </div>
                    </div>
                    <Card.Body>
                      <div className="property-stats">
                        <div className="stat-row">
                          <div className="stat-name">Total Supply</div>
                          <div className="stat-value">{formatTREAmount(estate.totalSupply)} TRE</div>
                        </div>
                        <div className="stat-row highlight">
                          <div className="stat-name">Your Balance</div>
                          <div className="stat-value">{formatTREAmount(estate.balance)} TRE</div>
                        </div>
                        {estate.allChainsBalance && <div className="stat-row">
                          <div className="stat-name">Cross-Chain Balance</div>
                          <div className="stat-value">{formatTREAmount(estate.allChainsBalance)} TRE</div>
                        </div>}
                        <div className="stat-row">
                          <div className="stat-name">Token Price</div>
                          <div className="stat-value">{estate.formattedTokenPrice} {estate.paymentTokenSymbol}</div>
                        </div>
                        <div className="stat-row">
                          <div className="stat-name">Available</div>
                          <div className="stat-value">{formatTREAmount(estate.tokensAvailable)} TRE</div>
                        </div>
                        <div className="stat-row">
                          <div className="stat-name">Your Collateral</div>
                          <div className="stat-value">{estate.formattedCollateral || "0"} {estate.paymentTokenSymbol}</div>
                        </div>
                        {chainId === 43113 && (
                          <>
                            <div className="stat-row">
                              <div className="stat-name">Claimed Rewards</div>
                              <div className="stat-value">{estate.claimedRewards || "0"} {estate.paymentTokenSymbol}</div>
                            </div>
                            <div className="stat-row highlight">
                              <div className="stat-name">Claimable Rewards</div>
                              <div className="stat-value">{estate.claimableRewards || "0"} {estate.paymentTokenSymbol}</div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="property-actions">
                        <div className="action-buttons">
                          <Button
                            variant="outline-primary"
                            onClick={() => handleViewDetails(estate)}
                            className="btn-action"
                            size="md"
                          >
                            <FontAwesomeIcon icon={faInfoCircle} className="me-1" /> Details
                          </Button>

                          <Button
                            variant="outline-dark"
                            onClick={() => handleViewTransactionHistory(estate)}
                            className="btn-action"
                            size="md"
                          >
                            <FontAwesomeIcon icon={faHistory} className="me-1" /> History
                          </Button>
                        </div>
                        
                        <div className="action-buttons mt-2">
                          <Button
                            variant="outline-success"
                            onClick={() => {
                              setSelectedEstate(estate);
                              setShowBuyModal(true);
                            }}
                            disabled={!estate.tokensAvailable || estate.tokensAvailable.isZero()}
                            className="btn-action"
                            size="md"
                          >
                            <FontAwesomeIcon icon={faShoppingCart} className="me-1" /> Buy
                          </Button>

                          <Button
                            variant="outline-warning"
                            onClick={() => {
                              setSelectedEstate(estate);
                              setShowSellModal(true);
                            }}
                            disabled={!estate.balance || estate.balance.isZero()}
                            className="btn-action"
                            size="md"
                          >
                            <FontAwesomeIcon icon={faTags} className="me-1" /> Sell
                          </Button>
                        </div>
                        
                        <div className="action-buttons mt-2">
                          <Button
                            variant="outline-info"
                            onClick={() => {
                              setSelectedEstate(estate);
                              setShowDepositCollateralModal(true);
                            }}
                            className="btn-action"
                            size="md"
                          >
                            <FontAwesomeIcon icon={faCoins} className="me-1" /> Deposit
                          </Button>

                          <Button
                            variant="outline-secondary"
                            onClick={() => {
                              setSelectedEstate(estate);
                              setShowWithdrawCollateralModal(true);
                            }}
                            disabled={!estate.userCollateral || estate.userCollateral.isZero()}
                            className="btn-action"
                            size="md"
                          >
                            <FontAwesomeIcon icon={faMoneyBillTransfer} className="me-1" /> Withdraw
                          </Button>
                        </div>
                        
                        {chainId === 43113 && (
                          <div className="text-center mt-2">
                            <Button
                              variant="outline-primary"
                              onClick={() => {
                                setSelectedEstate(estate);
                                setShowRewardModal(true);
                              }}
                              className="btn-action btn-claim"
                              size="md"
                              disabled={parseFloat(estate.claimableRewards || 0) <= 0}
                            >
                              <FontAwesomeIcon icon={faMoneyCheckDollar} className="me-1" /> Claim Rewards
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      {/* Buy Modal */}
      <Modal show={showBuyModal} onHide={() => setShowBuyModal(false)} centered className="user-dashboard-modal">
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title>
            <FontAwesomeIcon icon={faShoppingCart} className="me-2 text-success" />
            Buy {selectedEstate?.symbol?.substr(0, 3)} Tokens
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleBuyTokens}>
            <Form.Group className="mb-3">
              <Form.Label>Amount to Buy</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter amount"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                min="0.000000000000000001"
                step="0.000000000000000001"
                required
                className="form-control-modern"
              />
              <Form.Text className="text-muted">
                Available: {selectedEstate && selectedEstate.tokensAvailable ?
                  ethers.utils.formatEther(selectedEstate.tokensAvailable) : '0'} tokens
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => setShowBuyModal(false)}>
                Cancel
              </Button>
              <Button variant="success" type="submit" disabled={loading} className="px-4">
                {loading ? <Spinner animation="border" size="sm" /> : 'Buy Tokens'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Sell Modal */}
      <Modal show={showSellModal} onHide={() => setShowSellModal(false)} centered className="user-dashboard-modal">
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title>
            <FontAwesomeIcon icon={faTags} className="me-2 text-warning" />
            Sell {selectedEstate?.symbol?.substr(0, 3)} Tokens
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSellTokens}>
            <Form.Group className="mb-3">
              <Form.Label>Amount to Sell</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter amount"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                min="0.000000000000000001"
                step="0.000000000000000001"
                required
                className="form-control-modern"
              />
              <Form.Text className="text-muted">
                Your Balance: {selectedEstate && selectedEstate.balance ?
                  ethers.utils.formatEther(selectedEstate.balance) : '0'} tokens
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => setShowSellModal(false)}>
                Cancel
              </Button>
              <Button variant="warning" type="submit" disabled={loading} className="px-4">
                {loading ? <Spinner animation="border" size="sm" /> : 'Sell Tokens'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Deposit Collateral Modal */}
      <Modal show={showDepositCollateralModal} onHide={() => setShowDepositCollateralModal(false)} centered className="user-dashboard-modal">
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title>
            <FontAwesomeIcon icon={faCoins} className="me-2 text-info" />
            Deposit Collateral
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleDepositCollateral}>
            <Form.Group className="mb-3">
              <Form.Label>Amount to Deposit</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter amount"
                value={depositCollateralAmount}
                onChange={(e) => setDepositCollateralAmount(e.target.value)}
                min="0.000000000000000001"
                step="0.000000000000000001"
                required
                className="form-control-modern"
              />
              <Form.Text className="text-muted">
                Payment Token: {selectedEstate?.paymentTokenSymbol || ''}
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => setShowDepositCollateralModal(false)}>
                Cancel
              </Button>
              <Button variant="info" type="submit" disabled={loading} className="px-4 text-white">
                {loading ? <Spinner animation="border" size="sm" /> : 'Deposit Collateral'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Withdraw Collateral Modal */}
      <Modal show={showWithdrawCollateralModal} onHide={() => setShowWithdrawCollateralModal(false)} centered className="user-dashboard-modal">
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title>
            <FontAwesomeIcon icon={faMoneyBillTransfer} className="me-2 text-secondary" />
            Withdraw Collateral
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleWithdrawCollateral}>
            <Form.Group className="mb-3">
              <Form.Label>Amount to Withdraw</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter amount"
                value={withdrawCollateralAmount}
                onChange={(e) => setWithdrawCollateralAmount(e.target.value)}
                min="0.000000000000000001"
                step="0.000000000000000001"
                required
                className="form-control-modern"
              />
              <Form.Text className="text-muted">
                Your Collateral: {selectedEstate?.formattedCollateral || '0'} {selectedEstate?.paymentTokenSymbol || ''}
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => setShowWithdrawCollateralModal(false)}>
                Cancel
              </Button>
              <Button variant="secondary" type="submit" disabled={loading} className="px-4">
                {loading ? <Spinner animation="border" size="sm" /> : 'Withdraw Collateral'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Claim Rewards Modal */}
      <Modal show={showRewardModal} onHide={() => setShowRewardModal(false)} centered className="user-dashboard-modal">
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title>
            <FontAwesomeIcon icon={faMoneyCheckDollar} className="me-2 text-primary" />
            Claim Rewards
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="rewards-info-box mb-4">
            <div className="rewards-icon">
              <FontAwesomeIcon icon={faChartLine} />
            </div>
            <div className="rewards-details">
              <h5>Investment Rewards</h5>
              <p>You'll receive distributions based on your share of property ownership, paid in {selectedEstate?.paymentTokenSymbol}</p>
            </div>
          </div>

          <Form onSubmit={handleClaimReward}>
            <Form.Group className="mb-3">
              <Form.Label>Claimable Rewards - {selectedEstate?.paymentTokenSymbol}</Form.Label>
              <div className="rewards-amount">
                {selectedEstate?.claimableRewards || '0'}
              </div>
              <Form.Text className="text-muted text-center d-block">
                Claim your rewards earned from property rental income or appreciation
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-primary" onClick={() => setShowRewardModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={loading || parseFloat(selectedEstate?.claimableRewards || 0) <= 0} 
                className="px-4"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Claim Rewards'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Estate Owner Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} centered size="lg" className="details-modal">
        <Modal.Header closeButton className="details-modal-header">
          <Modal.Title>
            <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
            Estate Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="details-modal-body">
          {loadingDetails ? (
            <div className="text-center py-4">
              <div className="custom-spinner"></div>
              <p className="mt-3">Loading estate details...</p>
            </div>
          ) : estateOwnerDetails ? (
            <div className="estate-details-content">
              <div className="estate-title-section">
                <h3>{selectedEstate?.name} <span className="estate-symbol">({selectedEstate?.symbol})</span></h3>
                <div className="estate-location">
                  <FontAwesomeIcon icon={faBuilding} className="me-2" />
                  {estateOwnerDetails.city || estateOwnerDetails.state}, {estateOwnerDetails.country}
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-card owner-card">
                  <div className="detail-card-header">
                    <h5>Owner Information</h5>
                  </div>
                  <div className="detail-card-body">
                    <div className="detail-item">
                      <div className="detail-label">Owner Name</div>
                      <div className="detail-value">{estateOwnerDetails.name}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">ETH Address</div>
                      <div className="detail-value address-value">{estateOwnerDetails.ethAddress}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Verification</div>
                      <div className="detail-value">
                        {estateOwnerDetails.isVerified ? (
                          <Badge bg="success">Verified</Badge>
                        ) : (
                          <Badge bg="warning">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="detail-card property-card">
                  <div className="detail-card-header">
                    <h5>Property Information</h5>
                  </div>
                  <div className="detail-card-body">
                    <div className="detail-item">
                      <div className="detail-label">Address</div>
                      <div className="detail-value">{estateOwnerDetails.address}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Description</div>
                      <div className="detail-value">{estateOwnerDetails.realEstateInfo}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Contract Address</div>
                      <div className="detail-value address-value">{selectedEstate?.address}</div>
                    </div>
                  </div>
                </div>

                <div className="detail-card financials-card">
                  <div className="detail-card-header">
                    <h5>Financial Details</h5>
                  </div>
                  <div className="detail-card-body">
                    {chainId === 43113 &&
                      <div className="detail-item">
                        <div className="detail-label">Estate Value</div>
                        <div className="detail-value highlight">
                          {estateOwnerDetails.currentEstateCost} {selectedEstate?.paymentTokenSymbol}
                        </div>
                      </div>
                    }
                    <div className="detail-item">
                      <div className="detail-label">Payment Token</div>
                      <div className="detail-value">
                        {selectedEstate?.paymentTokenSymbol}
                        {estateOwnerDetails.token ? ` (${estateOwnerDetails.token.substring(0, 6)}...${estateOwnerDetails.token.substring(estateOwnerDetails.token.length - 4)})` : ''}
                      </div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Tokenization %</div>
                      <div className="detail-value">{estateOwnerDetails.percentageToTokenize}%</div>
                    </div>
                    {chainId === 43113 &&
                      <div className="detail-item">
                        <div className="detail-label">Rewards Streamed</div>
                        <div className="detail-value highlight">
                          {estateOwnerDetails.rewards} {selectedEstate?.paymentTokenSymbol}
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Alert variant="warning">Failed to load estate owner details.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowDetailsModal(false)} className="btn-close-modal">
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Transaction History Modal */}
      <Modal show={showTransactionHistoryModal} onHide={() => setShowTransactionHistoryModal(false)} centered size="lg" className="history-modal">
        <Modal.Header closeButton className="history-modal-header">
          <Modal.Title>
            <FontAwesomeIcon icon={faHistory} className="me-2" />
            Transaction History - {selectedEstate?.name} ({selectedEstate?.symbol})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="history-modal-body">
          {loadingTransactionHistory ? (
            <div className="text-center py-4">
              <div className="custom-spinner"></div>
              <p className="mt-3">Loading transaction history...</p>
            </div>
          ) : transactionHistory && transactionHistory.length > 0 ? (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="history-summary">
                  <span className="history-count">{transactionHistory.length}</span> transactions found
                </div>
                <Button
                  variant="success"
                  size="sm"
                  onClick={exportToExcel}
                  className="export-btn"
                >
                  <FontAwesomeIcon icon={faDownload} className="me-2" />
                  Export Excel
                </Button>
              </div>
              <div className="transaction-table-wrapper">
                <Table responsive bordered hover className="transaction-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Token</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionHistory.map((transaction, index) => (
                      <tr key={index}>
                        <td>{formatDate(transaction.createdAt)}</td>
                        <td>
                          <span className={`badge bg-${getTransactionBadgeColor(transaction.transactionType)}`}>
                            {transaction.transactionType}
                          </span>
                        </td>
                        <td>{transaction.transactionAmount}</td>
                        <td>{transaction.transactionSymbol}</td>
                        <td className="text-center">
                          <Button 
                            variant="outline-info" 
                            size="sm"
                            onClick={() => window.open(getBlockExplorerUrl(transaction.transactionHash, true), '_blank')}
                            title="View transaction on blockchain explorer"
                            className="transaction-view-btn"
                          >
                            View Transaction
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          ) : (
            <div className="empty-history">
              <div className="empty-history-icon">
                <FontAwesomeIcon icon={faHistory} />
              </div>
              <h4>No Transaction History</h4>
              <p>You haven't made any transactions with this property yet</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTransactionHistoryModal(false)} className="btn-close-modal">
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <style jsx="true">{`
        .user-dashboard {
          background-color: #f8fafc;
          border-radius: 12px;
          min-height: 100vh;
        }
        
        .dashboard-header {
          background: linear-gradient(135deg, #1a5276 0%, #3498db 100%);
          color: white;
          padding: 2.5rem 1rem;
          margin-bottom: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        .dashboard-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          z-index: 0;
        }
        
        .dashboard-header-content {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .dashboard-title h2 {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
          color: white;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          margin-left: -8px;
        }
        
        .dashboard-title p {
          font-size: 1.1rem;
          opacity: 0.9;
          margin-bottom: 0;
          max-width: 500px;
        }
        
        .dashboard-stats {
          display: flex;
          gap: 1.5rem;
        }
        
        .stat-item {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 1rem 1.5rem;
          border-radius: 12px;
          min-width: 130px;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
        }
        
        .stat-item:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.2);
        }
        
        .stat-icon {
          font-size: 2rem;
          margin-right: 1rem;
          opacity: 0.8;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1.1;
        }
        
        .stat-label {
          font-size: 0.8rem;
          opacity: 0.8;
        }
        
        .dashboard-alert {
          margin: 0 1rem 1.5rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
        }
        
        .network-switcher-section {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          margin: 0 1rem 2rem;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
        }
        
        .section-title {
          color: #2c3e50;
          font-weight: 700;
          font-size: 1.5rem;
          margin-bottom: 1rem;
          position: relative;
          display: inline-block;
        }
        
        .section-title::after {
          content: '';
          position: absolute;
          width: 50%;
          height: 3px;
          background: linear-gradient(to right, #3498db, transparent);
          bottom: -8px;
          left: 0;
          border-radius: 3px;
        }
        
        .network-description {
          color: #7f8c8d;
          font-size: 0.9rem;
          margin-top: 1rem;
        }
        
        .btn-network {
          border-radius: 30px;
          padding: 0.6rem 1.2rem;
          font-weight: 600;
          transition: all 0.3s ease;
          min-width: 180px;
        }
        
        .btn-network.active {
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        .btn-network:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        .properties-grid {
          padding: 0 0.5rem;
        }
        
        .property-card {
          border: none;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          height: 100%;
          background: white;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        
        .property-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 12px 25px rgba(0, 0, 0, 0.1);
        }
        
        .property-header {
          background: linear-gradient(45deg, #3498db, #1a5276);
          color: white;
          padding: 1.5rem;
          position: relative;
        }
        
        .property-id {
          position: absolute;
          top: 1rem;
          right: 1rem;
          font-weight: 500;
          font-size: 0.8rem;
        }
        
        .property-name {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .property-symbol {
          font-size: 0.9rem;
          opacity: 0.8;
          margin-bottom: 1rem;
        }
        
        .property-owner {
          font-size: 0.8rem;
          background: rgba(255, 255, 255, 0.2);
          display: inline-block;
          padding: 0.3rem 0.7rem;
          border-radius: 50px;
        }
        
        .owner-label {
          opacity: 0.9;
          margin-right: 0.5rem;
        }
        
        .owner-address {
          font-family: monospace;
          font-weight: 500;
        }
        
        .property-stats {
          margin-bottom: 1.5rem;
        }
        
        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 0.6rem 0;
          border-bottom: 1px solid #f1f3f5;
        }
        
        .stat-row:last-child {
          border-bottom: none;
        }
        
        .stat-row.highlight {
          background-color: rgba(52, 152, 219, 0.05);
          margin: 0 -1.25rem;
          padding: 0.6rem 1.25rem;
          font-weight: 600;
        }
        
        .stat-name {
          color: #7f8c8d;
          font-size: 0.9rem;
        }
        
        .stat-value {
          color: #2c3e50;
          font-weight: 500;
        }
        
        .property-actions {
          padding-top: 1rem;
          border-top: 1px solid #f1f3f5;
        }
        
        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        
        .btn-action {
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        
        .btn-action:hover:not(:disabled) {
          transform: translateY(-3px);
        }
        
        .btn-claim {
          width: 100%;
        }
        
        /* Modals styling */
        .user-dashboard-modal .modal-content {
          border-radius: 16px;
          overflow: hidden;
          border: none;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        
        .modal-header-custom {
          background: linear-gradient(45deg, #3498db, #2c3e50);
          color: white;
          border-bottom: none;
        }
        
        .modal-header-custom .modal-title {
          font-weight: 700;
        }
        
        .modal-header-custom .btn-close {
          color: white;
          box-shadow: none;
          filter: invert(1) grayscale(100%) brightness(200%);
        }
        
        .form-control-modern {
          border-radius: 10px;
          padding: 0.8rem 1rem;
          border: 2px solid #e9ecef;
          box-shadow: none;
          transition: all 0.3s ease;
        }
        
        .form-control-modern:focus {
          border-color: #3498db;
          box-shadow: 0 0 0 0.25rem rgba(52, 152, 219, 0.2);
        }
        
        /* Claim rewards modal */
        .rewards-info-box {
          background: rgba(52, 152, 219, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
        }
        
        .rewards-icon {
          font-size: 2.5rem;
          color: #3498db;
          margin-right: 1rem;
        }
        
        .rewards-details h5 {
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }
        
        .rewards-details p {
          margin-bottom: 0;
          font-size: 0.9rem;
          color: #7f8c8d;
        }
        
        .rewards-amount {
          text-align: center;
          font-size: 2rem;
          font-weight: 700;
          color: #2c3e50;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 10px;
          margin-bottom: 0.5rem;
        }
        
        /* Custom spinner */
        .custom-spinner {
          width: 50px;
          height: 50px;
          border: 5px solid rgba(52, 152, 219, 0.1);
          border-radius: 50%;
          border-top-color: #3498db;
          animation: spin 1s ease-in-out infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .loading-text {
          color: #7f8c8d;
          font-weight: 500;
        }
        
        /* Empty state */
        .empty-state {
          background: white;
          border-radius: 16px;
          padding: 3rem 2rem;
          text-align: center;
          margin: 2rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        
        .empty-icon {
          font-size: 4rem;
          color: #bdc3c7;
          margin-bottom: 1.5rem;
        }
        
        .empty-state h4 {
          color: #2c3e50;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        
        .empty-state p {
          color: #7f8c8d;
        }
        
        /* Details modal */
        .details-modal .modal-content {
          border-radius: 16px;
          border: none;
        }
        
        .details-modal-header {
          background: linear-gradient(45deg, #3498db, #2c3e50);
          color: white;
          padding: 1.5rem;
          border-bottom: none;
        }
        
        .details-modal-body {
          padding: 2rem;
        }
        
        .estate-title-section {
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #eee;
        }
        
        .estate-title-section h3 {
          color: #2c3e50;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        
        .estate-symbol {
          color: #7f8c8d;
          font-weight: normal;
        }
        
        .estate-location {
          color: #7f8c8d;
          font-size: 1rem;
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .detail-card {
          background: #f8f9fa;
          border-radius: 12px;
          overflow: hidden;
        }
        
        .detail-card-header {
          background: #f1f3f5;
          padding: 1rem 1.5rem;
        }
        
        .detail-card-header h5 {
          margin-bottom: 0;
          color: #2c3e50;
          font-weight: 600;
        }
        
        .detail-card-body {
          padding: 1.5rem;
        }
        
        .detail-item {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eee;
        }
        
        .detail-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        
        .detail-label {
          color: #7f8c8d;
          font-size: 0.8rem;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .detail-value {
          color: #2c3e50;
          font-weight: 500;
          word-break: break-word;
        }
        
        .detail-value.address-value {
          font-family: monospace;
          font-size: 0.9rem;
          background: #f1f3f5;
          padding: 0.5rem;
          border-radius: 6px;
        }
        
        .highlight {
          color: #3498db;
          font-weight: 700;
        }
        
        /* History modal */
        .history-modal .modal-content {
          border-radius: 16px;
          border: none;
        }
        
        .history-modal-header {
          background: linear-gradient(45deg, #34495e, #2c3e50);
          color: white;
          padding: 1.5rem;
          border-bottom: none;
        }
        
        .history-modal-body {
          padding: 2rem;
        }
        
        .history-summary {
          color: #7f8c8d;
          font-size: 0.9rem;
        }
        
        .history-count {
          color: #2c3e50;
          font-weight: 700;
          font-size: 1.1rem;
        }
        
        .export-btn {
          border-radius: 8px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .transaction-table-wrapper {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .transaction-table thead th {
          background: #f8f9fa;
          color: #2c3e50;
          font-weight: 600;
          border-top: none;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .transaction-view-btn {
          border-radius: 50px;
          padding: 0.25rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .empty-history {
          text-align: center;
          padding: 3rem 2rem;
        }
        
        .empty-history-icon {
          font-size: 4rem;
          color: #bdc3c7;
          margin-bottom: 1.5rem;
        }
        
        .empty-history h4 {
          color: #2c3e50;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        
        .empty-history p {
          color: #7f8c8d;
        }
        
        .btn-close-modal {
          border-radius: 8px;
          font-weight: 500;
          padding-left: 2rem;
          padding-right: 2rem;
        }
        
        /* Responsive adjustments */
        @media (max-width: 992px) {
          .dashboard-header-content {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .dashboard-stats {
            margin-top: 1.5rem;
            width: 100%;
            justify-content: space-between;
          }
          
          .stat-item {
            min-width: 100px;
          }
          
          .details-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .dashboard-title h2 {
            font-size: 2rem;
          }
          
          .dashboard-title p {
            font-size: 1rem;
          }
          
          .dashboard-stats {
            flex-wrap: wrap;
            gap: 1rem;
          }
          
          .stat-item {
            flex-basis: calc(50% - 0.5rem);
            padding: 0.75rem 1rem;
          }
          
          .stat-icon {
            font-size: 1.5rem;
          }
          
          .stat-value {
            font-size: 1.2rem;
          }
          
          .property-actions .action-buttons {
            grid-template-columns: 1fr;
          }
          
          .network-switcher {
            margin-top: 1rem;
          }
          
          .btn-network {
            width: 100%;
            margin-bottom: 0.5rem;
          }
        }
        
        @media (max-width: 576px) {
          .action-buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default UserDashboard;
