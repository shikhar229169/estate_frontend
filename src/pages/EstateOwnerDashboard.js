import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Spinner, Form, Tab, Tabs, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork } from '../utils/interact';
import { getEstateOwnerByAddress, updateEstateOwnerData, getAllUserParticularTreData, getParticularTreLog } from '../utils/api';
import TokenizedRealEstateABI from '../contracts/abi/TokenizedRealEstate';
import ERC20ABI from '../contracts/abi/ERC20ABI';
// Import FontAwesome icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faChartLine, faUsers, faExchangeAlt, faCalendarAlt, faPercentage } from '@fortawesome/free-solid-svg-icons';
// Import Excel export library
import * as XLSX from 'xlsx';
// Import Chart.js and related components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const EstateOwnerDashboard = ({ walletAddress, chainId }) => {
  const [activeTab, setActiveTab] = useState('estateDetails');
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [estateOwner, setEstateOwner] = useState(null);
  const [tokenizationDetails, setTokenizationDetails] = useState(null);
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenContractAddr, setTokenContractAddr] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [formattedEstateCost, setFormattedEstateCost] = useState('');
  const [formattedRewards, setFormattedRewards] = useState(''); // New state for formatted rewards

  // New state variables for estate cost update and rewards
  const [showUpdateCostModal, setShowUpdateCostModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [newEstateCost, setNewEstateCost] = useState('');
  const [estateRewards, setEstateRewards] = useState('');
  const [collateralCollected, setCollateralCollected] = useState(0);
  const [usersData, setUsersData] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [treLogData, setTreLogData] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // New state variables for analytics data
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('1m'); // Default 1 month
  const [analyticsChartData, setAnalyticsChartData] = useState({
    activityOverTime: null,
    transactionTypes: null,
    userHoldings: null,
    rewardDistribution: null,
    collateralGrowth: null
  });

  useEffect(() => {
    const loadContracts = async () => {
      if (walletAddress && chainId) {
        const contractInstances = getContracts(chainId);
        if (contractInstances && !contractInstances.error) {
          setContracts(contractInstances);

          // Try to get tokenization details if estate is already tokenized
          try {
            // Use the correct function from assetTokenizationManager instead of realEstateRegistry
            const tokenizedRealEstate = await contractInstances.assetTokenizationManager.getEstateOwnerToTokeinzedRealEstate(walletAddress);

            if (tokenizedRealEstate && tokenizedRealEstate !== ethers.constants.AddressZero) {
              // Get details from the tokenized real estate contract if available
              try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);

                // Create contract instance for the tokenized real estate
                const tokenContract = new ethers.Contract(
                  tokenizedRealEstate,
                  TokenizedRealEstateABI,
                  provider
                );

                // Get token details
                const tokenName = await tokenContract.name();
                const tokenSymbol = await tokenContract.symbol();
                const tokenSupply = await tokenContract.totalSupply();
                const tokenPrice = await tokenContract.getPerEstateTokenPrice();
                const decimals = await tokenContract.decimals();

                setTokenizationDetails({
                  tokenAddress: tokenizedRealEstate,
                  tokenName: tokenName,
                  tokenSymbol: tokenSymbol,
                  tokenSupply: tokenSupply,
                  tokenPrice: tokenPrice,
                  isTokenized: true,
                  decimals: decimals
                });
              } catch (error) {
                console.error('Error fetching token details:', error);
                setTokenizationDetails({
                  tokenAddress: tokenizedRealEstate,
                  isTokenized: true
                });
              }
            }
          } catch (error) {
            console.error('Error loading tokenization details:', error);
          }
        } else if (contractInstances && contractInstances.error) {
          setError(contractInstances.error);
        }
      }
    };

    const loadEstateOwner = async () => {
      if (walletAddress) {
        try {
          setLoading(true);
          const data = await getEstateOwnerByAddress(walletAddress);
          const estateOwner = data.data.user;
          setEstateOwner(estateOwner);

          // Get token information if available
          if (estateOwner && estateOwner.token) {
            try {
              const provider = new ethers.providers.Web3Provider(window.ethereum);

              // Check if token is native token (address 0)
              if (estateOwner.token === ethers.constants.AddressZero) {
                setTokenSymbol(chainId === 43114 ? 'AVAX' : 'ETH');
                setTokenContractAddr('');
                setTokenDecimals(18);
              } else {
                // Get token contract
                const tokenContract = new ethers.Contract(
                  estateOwner.token,
                  ERC20ABI,
                  provider
                );

                // Get token symbol and decimals
                const symbol = await tokenContract.symbol();
                const decimals = await tokenContract.decimals();

                setTokenSymbol(symbol);
                setTokenContractAddr(estateOwner.token);
                setTokenDecimals(decimals);
                setCollateralCollected(estateOwner.collateralDeposited);
              }

              // Format estate cost based on token decimals
              if (estateOwner.currentEstateCost) {
                try {
                  const formattedCost = ethers.utils.formatUnits(
                    estateOwner.currentEstateCost,
                    tokenDecimals
                  );
                  setFormattedEstateCost(formattedCost);
                } catch (error) {
                  console.error('Error formatting estate cost:', error);
                  setFormattedEstateCost(estateOwner.currentEstateCost);
                }
              }

              // Format rewards based on token decimals
              if (estateOwner.rewards) {
                try {
                  const formattedRewardsValue = ethers.utils.formatUnits(
                    estateOwner.rewards,
                    tokenDecimals
                  );
                  setFormattedRewards(formattedRewardsValue);
                } catch (error) {
                  console.error('Error formatting rewards:', error);
                  setFormattedRewards(estateOwner.rewards);
                }
              }
            } catch (error) {
              console.error('Error getting token details:', error);
              setTokenSymbol('');
              setTokenContractAddr('');
            }
          }
        } catch (error) {
          console.error('Error loading estate owner:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadContracts();
    loadEstateOwner();
  }, [walletAddress, chainId, tokenDecimals]);

  // New useEffect to fetch users data when tokenizationDetails is available
  useEffect(() => {
    const fetchUsersData = async () => {
      if (tokenizationDetails?.tokenAddress && (activeTab === 'usersData' || activeTab === 'analytics')) {
        try {
          setLoadingUsers(true);
          const userData = await getAllUserParticularTreData(tokenizationDetails.tokenAddress);
          setUsersData(userData);
        } catch (error) {
          console.error('Error fetching users data:', error);
          setError('Failed to load users data');
        } finally {
          setLoadingUsers(false);
        }
      }
    };

    // Load transaction logs when tab is activated
    const fetchTreLogs = async () => {
      if (tokenizationDetails?.tokenAddress && (activeTab === 'transactionLogs' || activeTab === 'analytics')) {
        try {
          setLoadingLogs(true);
          const logsData = await getParticularTreLog(tokenizationDetails.tokenAddress);
          setTreLogData(logsData);
        } catch (error) {
          console.error('Error fetching transaction logs:', error);
          setError('Failed to load transaction logs');
        } finally {
          setLoadingLogs(false);
        }
      }
    };

    fetchUsersData();
    fetchTreLogs();
  }, [tokenizationDetails, activeTab]);

  // New useEffect to prepare analytics data when tab is activated
  useEffect(() => {
    const prepareAnalyticsData = async () => {
      if (tokenizationDetails?.tokenAddress && activeTab === 'analytics') {
        try {
          setAnalyticsLoading(true);
          
          // Make sure we have the data we need before processing
          if (usersData.length === 0 || treLogData.length === 0) {
            console.log("Waiting for data to be loaded...");
            return; // Exit early if data isn't loaded yet
          }
          
          // Process data for analytics charts
          const processedData = processAnalyticsData(treLogData, usersData, analyticsTimeRange);
          
          setAnalyticsChartData(processedData);
        } catch (error) {
          console.error('Error preparing analytics data:', error);
          setError('Failed to prepare analytics data');
        } finally {
          setAnalyticsLoading(false);
        }
      }
    };
    
    prepareAnalyticsData();
  }, [tokenizationDetails, activeTab, usersData, treLogData, analyticsTimeRange]);

  // New function to handle estate cost update
  const handleUpdateEstateCost = async (e) => {
    e.preventDefault();
    if (!tokenizationDetails || !tokenizationDetails.isTokenized) {
      setError('Your estate is not tokenized yet');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Create contract instance for the tokenized real estate
      const tokenContract = new ethers.Contract(
        tokenizationDetails.tokenAddress,
        TokenizedRealEstateABI,
        signer
      );

      // Convert the cost to the correct format with decimals
      const newCostInWei = ethers.utils.parseUnits(newEstateCost, tokenizationDetails.decimals || 18);

      // Call the update estate cost function
      const tx = await tokenContract.updateEstateCost(newCostInWei);
      await tx.wait();

      await updateEstateOwnerData(estateOwner._id, { currentEstateCost: newCostInWei.toString() });
      const currTokenPrice = await tokenContract.getPerEstateTokenPrice()

      setFormattedEstateCost(newEstateCost);
      setTokenizationDetails({ ...tokenizationDetails, tokenPrice: currTokenPrice });

      setSuccess('Estate cost updated successfully!');
      setShowUpdateCostModal(false);
      setNewEstateCost('');
    } catch (error) {
      setError(`Error updating estate cost: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // New function to handle sending regular estate rewards
  const handleSendRewards = async (e) => {
    e.preventDefault();
    if (!tokenizationDetails || !tokenizationDetails.isTokenized) {
      setError('Your estate is not tokenized yet');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Create contract instance for the tokenized real estate
      const tokenContract = new ethers.Contract(
        tokenizationDetails.tokenAddress,
        TokenizedRealEstateABI,
        signer
      );

      // Convert the rewards to the correct format with decimals
      const prevRewardsInWei = ethers.utils.parseUnits(formattedRewards, tokenizationDetails.decimals || 18);
      const rewardsInWei = ethers.utils.parseUnits(estateRewards, tokenizationDetails.decimals || 18);

      const paymentToken = new ethers.Contract(estateOwner.token, ERC20ABI, signer);
      const allowance = await paymentToken.allowance(walletAddress, tokenizationDetails.tokenAddress);

      if (allowance.lt(rewardsInWei)) {
        const approveRewardTxn = await paymentToken.approve(tokenizationDetails.tokenAddress, rewardsInWei);
        await approveRewardTxn.wait();
      }

      // Call the send rewards function
      const tx = await tokenContract.sendRegularEstateRewardsAccumulated(rewardsInWei);
      await tx.wait();

      await updateEstateOwnerData(estateOwner._id, { rewards: (prevRewardsInWei.add(rewardsInWei)).toString() });
      setFormattedRewards((Number(formattedRewards) + Number(estateRewards)).toString());

      setSuccess('Estate rewards sent successfully!');
      setShowRewardsModal(false);
      setEstateRewards('');
    } catch (error) {
      console.log(error);
      setError(`Error sending rewards`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get the correct block explorer URL based on chainId
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
    switch (transactionType.toLowerCase()) {
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

  // Helper function to export users data to Excel file
  const exportUsersToExcel = () => {
    if (!usersData || usersData.length === 0 || !tokenizationDetails) return;

    // Create worksheet data
    const worksheetData = usersData.map(user => ({
      'User Address': user.userAddress,
      'TRE Minted': user.treMinted || 0,
      'Collateral Deposited': user.collateralDeposited || 0,
      'Payment Token': user.paymentTokenSymbol,
      'Rewards Collected': user.rewardsCollected || 0
    }));

    // Create a new workbook and add the data
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Generate file name using the requested format
    const shortTreAddress = tokenizationDetails.tokenAddress.slice(0, 10); // Shorten for file name
    const fileName = `tre-users-${shortTreAddress}.xlsx`;

    // Export to file
    XLSX.writeFile(workbook, fileName);
  };

  // Helper function to export transaction logs to Excel file
  const exportLogsToExcel = () => {
    if (!treLogData || treLogData.length === 0 || !tokenizationDetails) return;

    // Create worksheet data
    const worksheetData = treLogData.map(log => ({
      'Date': formatDate(log.createdAt),
      'User Address': log.userAddress,
      'Transaction Type': log.transactionType,
      'Amount': log.transactionAmount,
      'Token': log.transactionSymbol,
      'Transaction Hash': log.transactionHash
    }));

    // Create a new workbook and add the data
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    // Generate file name using the requested format
    const shortTreAddress = tokenizationDetails.tokenAddress.slice(0, 10); // Shorten for file name
    const fileName = `tre-logs-${shortTreAddress}.xlsx`;

    // Export to file
    XLSX.writeFile(workbook, fileName);
  };

  // Helper function to process analytics data
  const processAnalyticsData = (logData, userData, timeRange) => {
    // Early return if no data
    if (!logData.length || !userData.length) {
      console.log("No data available for analytics:", { logData: logData.length, userData: userData.length });
      return {
        activityOverTime: null,
        transactionTypes: null,
        userHoldings: null,
        rewardDistribution: null,
        collateralGrowth: null
      };
    }

    console.log("Processing analytics data with:", { logs: logData.length, users: userData.length });

    // Filter data based on time range
    const now = new Date();
    let cutoffDate = new Date();
    switch (timeRange) {
      case '1w': 
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '1m':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3m':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoffDate.setMonth(now.getMonth() - 1); // Default 1 month
    }
    
    const filteredLogData = logData.filter(log => new Date(log.createdAt) >= cutoffDate);
    console.log("Filtered logs for time range:", filteredLogData.length);
    
    // Group logs by date (for activity over time)
    const dateGroups = {};
    filteredLogData.forEach(log => {
      const date = new Date(log.createdAt).toISOString().split('T')[0];
      if (!dateGroups[date]) dateGroups[date] = [];
      dateGroups[date].push(log);
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateGroups).sort();
    
    // If no dates in the selected time range, provide some default data
    if (sortedDates.length === 0) {
      console.log("No data for the selected time range");
      // Return empty data structure with null values
      return {
        activityOverTime: null,
        transactionTypes: null,
        userHoldings: null,
        rewardDistribution: null,
        collateralGrowth: null
      };
    }
    
    // Activity over time data
    const activityData = {
      labels: sortedDates.map(date => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      datasets: [{
        label: 'Number of Transactions',
        data: sortedDates.map(date => dateGroups[date].length),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.4
      }]
    };
    
    // Transaction types distribution
    const transactionTypeCounts = {};
    filteredLogData.forEach(log => {
      // Make sure to check that transactionType exists
      const type = log.transactionType || "Unknown";
      if (!transactionTypeCounts[type]) transactionTypeCounts[type] = 0;
      transactionTypeCounts[type]++;
    });
    
    const transactionTypesData = {
      labels: Object.keys(transactionTypeCounts),
      datasets: [{
        data: Object.values(transactionTypeCounts),
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)'
        ],
        borderWidth: 1
      }]
    };
    
    // User holdings data
    const topUsers = [...userData]
      .sort((a, b) => (b.treMinted || 0) - (a.treMinted || 0))
      .slice(0, 10);
    
    const userHoldingsData = {
      labels: topUsers.map(user => `${user.userAddress?.substring(0, 6) || "Unknown"}...`),
      datasets: [{
        label: 'TRE Minted',
        data: topUsers.map(user => user.treMinted || 0),
        backgroundColor: 'rgba(54, 162, 235, 0.7)'
      }]
    };
    
    // Rewards distribution data
    const rewarded = userData.filter(user => user.rewardsCollected && user.rewardsCollected > 0);
    const notRewarded = userData.filter(user => !user.rewardsCollected || user.rewardsCollected === 0);
    
    const rewardDistributionData = {
      labels: ['Users Collected Rewards', 'Users Not Collected'],
      datasets: [{
        data: [rewarded.length, notRewarded.length],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 206, 86, 0.7)'
        ],
        hoverOffset: 4
      }]
    };
    
    // Collateral growth over time (cumulative)
    let cumulativeCollateral = 0;
    const collateralData = {
      labels: sortedDates.map(date => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      datasets: [{
        label: 'Cumulative Collateral',
        data: sortedDates.map(date => {
          const dailyDeposits = dateGroups[date]
            .filter(log => log.transactionType === 'COLLATERAL_DEPOSIT')
            .reduce((total, log) => {
              // Safely parse the transaction amount
              const amount = log.transactionAmount ? parseFloat(log.transactionAmount) : 0;
              return isNaN(amount) ? total : total + amount;
            }, 0);
          
          cumulativeCollateral += dailyDeposits;
          return cumulativeCollateral;
        }),
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        fill: true
      }]
    };
    
    console.log("Analytics data processed successfully");
    
    return {
      activityOverTime: activityData,
      transactionTypes: transactionTypesData,
      userHoldings: userHoldingsData,
      rewardDistribution: rewardDistributionData,
      collateralGrowth: collateralData
    };
  };

  // New function to export analytics data to Excel
  const exportAnalyticsToExcel = () => {
    if (!usersData || usersData.length === 0 || !treLogData || treLogData.length === 0) return;

    // Create worksheets
    const workbook = XLSX.utils.book_new();
    
    // Transaction types sheet
    const transactionTypeCounts = {};
    treLogData.forEach(log => {
      const type = log.transactionType;
      if (!transactionTypeCounts[type]) transactionTypeCounts[type] = 0;
      transactionTypeCounts[type]++;
    });
    
    const transactionTypesData = Object.keys(transactionTypeCounts).map(type => ({
      'Transaction Type': type,
      'Count': transactionTypeCounts[type]
    }));
    
    const transTypesSheet = XLSX.utils.json_to_sheet(transactionTypesData);
    XLSX.utils.book_append_sheet(workbook, transTypesSheet, 'Transaction Types');
    
    // User holdings sheet
    const userHoldingsData = usersData.map(user => ({
      'User Address': user.userAddress,
      'TRE Minted': user.treMinted || 0,
      'Collateral': user.collateralDeposited || 0,
      'Rewards': user.rewardsCollected || 0
    }));
    
    const userHoldingsSheet = XLSX.utils.json_to_sheet(userHoldingsData);
    XLSX.utils.book_append_sheet(workbook, userHoldingsSheet, 'User Holdings');
    
    // Generate file name
    const shortTreAddress = tokenizationDetails.tokenAddress.slice(0, 10);
    const fileName = `tre-analytics-${shortTreAddress}.xlsx`;

    // Export to file
    XLSX.writeFile(workbook, fileName);
  };

  if (!walletAddress) {
    return (
      <div className="text-center">
        <h2>Please connect your wallet to access the Estate Owner Dashboard</h2>
      </div>
    );
  }

  if (!chainId) {
    return (
      <div className="text-center">
        <h2>Please connect to a supported network</h2>
        <div className="mt-4">
          <Button
            variant="primary"
            className="me-2"
            onClick={() => switchNetwork(43113)}
          >
            Switch to Fuji
          </Button>
          <Button
            variant="primary"
            onClick={() => switchNetwork(11155111)}
          >
            Switch to Sepolia
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !estateOwner) {
    return (
      <div className="text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (!estateOwner) {
    return (
      <div className="text-center">
        <h2>You are not registered as an Estate Owner</h2>
        <p>Please register on the home page to access this dashboard.</p>
        <Button variant="primary" href="/">
          Go to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="estate-owner-dashboard">
      <h2 className="mb-4">Estate Owner Dashboard</h2>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {loading && (
        <div className="text-center mb-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="estateDetails" title="Estate Details">
          <Card>
            <Card.Body>
              <h4>Your Estate Information</h4>
              <Table responsive bordered>
                <tbody>
                  <tr>
                    <th>Name</th>
                    <td>{estateOwner.name}</td>
                  </tr>
                  <tr>
                    <th>ETH Address</th>
                    <td>{estateOwner.ethAddress}</td>
                  </tr>
                  <tr>
                    <th>Country</th>
                    <td>{estateOwner.country}</td>
                  </tr>
                  <tr>
                    <th>State</th>
                    <td>{estateOwner.state}</td>
                  </tr>
                  <tr>
                    <th>Address</th>
                    <td>{estateOwner.address}</td>
                  </tr>
                  <tr>
                    <th>Real Estate Information</th>
                    <td>{estateOwner.realEstateInfo}</td>
                  </tr>
                  <tr>
                    <th>Estate Value</th>
                    <td>
                      {formattedEstateCost ? (
                        <>
                          {formattedEstateCost} {tokenSymbol}
                        </>
                      ) : (
                        estateOwner.currentEstateCost
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Rewards Streamed</th>
                    <td>
                      {formattedRewards ? (
                        <>
                          {formattedRewards} {tokenSymbol}
                        </>
                      ) : (
                        estateOwner.rewards || '0'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Payment Token</th>
                    <td>{tokenSymbol || 'Not specified'} {`(${tokenContractAddr || ''})`}</td>
                  </tr>
                  <tr>
                    <th>Tokenization Percentage</th>
                    <td>{estateOwner.percentageToTokenize}%</td>
                  </tr>
                  <tr>
                    <th>Verification Status</th>
                    <td>
                      {estateOwner.isVerified ? (
                        <span className="text-success">Verified</span>
                      ) : (
                        <span className="text-warning">Pending Verification</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </Table>

              <div className="d-flex flex-wrap gap-2 mt-3">
                {estateOwner.isVerified && tokenizationDetails?.isTokenized && chainId === 43113 && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => setShowUpdateCostModal(true)}
                      disabled={loading}
                    >
                      Update Estate Cost
                    </Button>

                    <Button
                      variant="info"
                      onClick={() => setShowRewardsModal(true)}
                      disabled={loading}
                    >
                      Send Estate Rewards
                    </Button>
                  </>
                )}
              </div>

              {!estateOwner.isVerified && (
                <Alert variant="info">
                  Your estate needs to be verified by a node operator before you can tokenize it.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {tokenizationDetails?.isTokenized && (
          <Tab eventKey="tokenDetails" title="Token Details">
            <Card>
              <Card.Body>
                <h4>Tokenization Details</h4>
                <Table responsive bordered>
                  <tbody>
                    <tr>
                      <th>Token Name</th>
                      <td>{tokenizationDetails.tokenName}</td>
                    </tr>
                    <tr>
                      <th>Token Symbol</th>
                      <td>{tokenizationDetails.tokenSymbol}</td>
                    </tr>
                    <tr>
                      <th>Token Address</th>
                      <td>{tokenizationDetails.tokenAddress}</td>
                    </tr>
                    <tr>
                      <th>Token Mintable</th>
                      <td>
                        1000000 TRE
                      </td>
                    </tr>
                    <tr>
                      <th>Token Supply</th>
                      <td>
                        {tokenizationDetails.tokenSupply && tokenizationDetails.decimals ?
                          ethers.utils.formatUnits(tokenizationDetails.tokenSupply, tokenizationDetails.decimals) : 'N/A'} {tokenizationDetails.tokenSymbol.substr(0, 3) || ''}
                      </td>
                    </tr>
                    <tr>
                      <th>Token Price</th>
                      <td>
                        {tokenizationDetails.tokenPrice && tokenizationDetails.decimals ?
                          `$${ethers.utils.formatUnits(tokenizationDetails.tokenPrice, tokenizationDetails.decimals)}` : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <th>Total Collateral Collected</th>
                      <td>
                        {collateralCollected} {tokenSymbol}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Tab>
        )}

        {tokenizationDetails?.isTokenized && (
          <Tab eventKey="usersData" title="User Interactions">
            <Card>
              <Card.Body>
                <h4>Users Interacting with Your Tokenized Real Estate</h4>

                {loadingUsers ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading users data...</span>
                    </Spinner>
                  </div>
                ) : usersData && usersData.length > 0 ? (
                  <>
                    <div className="d-flex justify-content-end mb-3">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={exportUsersToExcel}
                        className="download-btn"
                      >
                        <FontAwesomeIcon icon={faDownload} className="me-2" />
                        Export Excel
                      </Button>
                    </div>
                    <Table responsive bordered hover>
                      <thead className="bg-light">
                        <tr>
                          <th>User Address</th>
                          <th>TRE Minted</th>
                          <th>Collateral Deposited</th>
                          <th>Rewards Collected</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersData.map((user, index) => (
                          <tr key={index}>
                            <td>
                              <span className="d-inline-block text-truncate" style={{ maxWidth: "150px" }}>
                                {user.userAddress}
                              </span>
                            </td>
                            <td>{user.treMinted || 0} TRE</td>
                            <td>{user.collateralDeposited || 0} {user.paymentTokenSymbol}</td>
                            <td>{user.rewardsCollected || 0} {user.paymentTokenSymbol}</td>
                            <td className="text-center">
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => window.open(getBlockExplorerUrl(user.userAddress), '_blank')}
                                title="View user details on blockchain explorer"
                              >
                                View User Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </>
                ) : (
                  <Alert variant="info">
                    No users have interacted with your tokenized real estate yet.
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Tab>
        )}

        {tokenizationDetails?.isTokenized && (
          <Tab eventKey="transactionLogs" title="Transaction Logs">
            <Card>
              <Card.Body>
                <h4>TRE Transaction Logs</h4>

                {loadingLogs ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading transaction logs...</span>
                    </Spinner>
                  </div>
                ) : treLogData && treLogData.length > 0 ? (
                  <>
                    <div className="d-flex justify-content-end mb-3">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={exportLogsToExcel}
                        className="download-btn"
                      >
                        <FontAwesomeIcon icon={faDownload} className="me-2" />
                        Export Excel
                      </Button>
                    </div>
                    <Table responsive bordered hover>
                      <thead className="bg-light">
                        <tr>
                          <th>Date</th>
                          <th>User Address</th>
                          <th>Transaction Type</th>
                          <th>Amount</th>
                          <th>Token</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treLogData.map((log, index) => (
                          <tr key={index}>
                            <td>{formatDate(log.createdAt)}</td>
                            <td>
                              <span className="d-inline-block text-truncate" style={{ maxWidth: "150px" }} title={log.userAddress}>
                                {log.userAddress}
                              </span>
                            </td>
                            <td>
                              <span className={`badge bg-${getTransactionBadgeColor(log.transactionType)}`}>
                                {log.transactionType}
                              </span>
                            </td>
                            <td>{log.transactionAmount}</td>
                            <td>{log.transactionSymbol}</td>
                            <td className="text-center">
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => window.open(getBlockExplorerUrl(log.transactionHash, true), '_blank')}
                                title="View transaction on blockchain explorer"
                              >
                                View Transaction
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </>
                ) : (
                  <Alert variant="info">
                    No transaction logs found for your tokenized real estate.
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Tab>
        )}

        {tokenizationDetails?.isTokenized && (
          <Tab eventKey="analytics" title={
            <span><FontAwesomeIcon icon={faChartLine} className="me-2" />Analytics</span>
          }>
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="analytics-title mb-0">
                    <FontAwesomeIcon icon={faChartLine} className="me-2 text-primary" />
                    TRE Analytics Dashboard
                  </h4>
                  <div>
                    <div className="btn-group me-2">
                      <Button 
                        variant={analyticsTimeRange === '1w' ? 'primary' : 'outline-primary'} 
                        size="sm" 
                        onClick={() => setAnalyticsTimeRange('1w')}
                      >
                        1W
                      </Button>
                      <Button 
                        variant={analyticsTimeRange === '1m' ? 'primary' : 'outline-primary'} 
                        size="sm" 
                        onClick={() => setAnalyticsTimeRange('1m')}
                      >
                        1M
                      </Button>
                      <Button 
                        variant={analyticsTimeRange === '3m' ? 'primary' : 'outline-primary'} 
                        size="sm" 
                        onClick={() => setAnalyticsTimeRange('3m')}
                      >
                        3M
                      </Button>
                      <Button 
                        variant={analyticsTimeRange === '6m' ? 'primary' : 'outline-primary'} 
                        size="sm" 
                        onClick={() => setAnalyticsTimeRange('6m')}
                      >
                        6M
                      </Button>
                      <Button 
                        variant={analyticsTimeRange === '1y' ? 'primary' : 'outline-primary'} 
                        size="sm" 
                        onClick={() => setAnalyticsTimeRange('1y')}
                      >
                        1Y
                      </Button>
                    </div>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={exportAnalyticsToExcel}
                      className="btn-group me-2"
                      title="Export analytics data to Excel"
                    >
                      <FontAwesomeIcon icon={faDownload} className="me-2" />
                      Export
                    </Button>
                  </div>
                </div>

                {analyticsLoading || loadingUsers || loadingLogs ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading analytics...</span>
                    </Spinner>
                  </div>
                ) : usersData.length === 0 || treLogData.length === 0 ? (
                  <Alert variant="info" className="text-center">
                    <h5>No transaction data available</h5>
                    <p>There is no user interaction or transaction data available for this real estate token yet.</p>
                  </Alert>
                ) : (
                  <div className="analytics-content">
                    {/* Analytics Overview Cards */}
                    <div className="row mb-4">
                      <div className="col-md-3 mb-3">
                        <div className="analytics-card bg-gradient-primary">
                          <div className="analytics-card-icon">
                            <FontAwesomeIcon icon={faUsers} />
                          </div>
                          <div className="analytics-card-content">
                            <h5>Total Users</h5>
                            <h3>{usersData.length}</h3>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 mb-3">
                        <div className="analytics-card bg-gradient-success">
                          <div className="analytics-card-icon">
                            <FontAwesomeIcon icon={faExchangeAlt} />
                          </div>
                          <div className="analytics-card-content">
                            <h5>Transactions</h5>
                            <h3>{treLogData.length}</h3>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 mb-3">
                        <div className="analytics-card bg-gradient-info">
                          <div className="analytics-card-icon">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                          </div>
                          <div className="analytics-card-content">
                            <h5>Days Active</h5>
                            <h3>{analyticsChartData.activityOverTime?.labels.length || 0}</h3>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3 mb-3">
                        <div className="analytics-card bg-gradient-warning">
                          <div className="analytics-card-icon">
                            <FontAwesomeIcon icon={faPercentage} />
                          </div>
                          <div className="analytics-card-content">
                            <h5>Utilization</h5>
                            <h3>
                              {(() => {
                                // Calculate the utilization percentage
                                const mintedTotal = usersData.reduce((sum, user) => sum + (user.treMinted || 0), 0);
                                const percentage = (mintedTotal / 1000000) * 100;
                                
                                // Format the percentage to 2 decimal places
                                return percentage < 0.01 && percentage > 0 
                                  ? '<0.01%'  // Show "<0.01%" for very small percentages
                                  : percentage.toFixed(2) + '%'; // Format normally for others
                              })()}
                            </h3>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 1: Activity Over Time and Transaction Types */}
                    <div className="row mb-4">
                      <div className="col-md-8 mb-3">
                        <div className="chart-container">
                          <h5 className="chart-title">Activity Over Time</h5>
                          {analyticsChartData.activityOverTime ? (
                            <Line 
                              data={analyticsChartData.activityOverTime} 
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                  title: {
                                    display: false,
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    ticks: {
                                      precision: 0
                                    }
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center py-5 text-muted">
                              <p>No activity data available for the selected time period.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-md-4 mb-3">
                        <div className="chart-container">
                          <h5 className="chart-title">Transaction Types</h5>
                          {analyticsChartData.transactionTypes ? (
                            <Doughnut 
                              data={analyticsChartData.transactionTypes}
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'bottom',
                                  },
                                  title: {
                                    display: false,
                                  },
                                },
                                cutout: '60%'
                              }}
                            />
                          ) : (
                            <div className="text-center py-5 text-muted">
                              <p>No transaction type data available.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: User Holdings and Reward Distribution */}
                    <div className="row mb-4">
                      <div className="col-md-8 mb-3">
                        <div className="chart-container">
                          <h5 className="chart-title">Top 10 Users by Holdings</h5>
                          {analyticsChartData.userHoldings ? (
                            <Bar 
                              data={analyticsChartData.userHoldings}
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    display: false,
                                  },
                                  title: {
                                    display: false,
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center py-5 text-muted">
                              <p>No user holdings data available.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-md-4 mb-3">
                        <div className="chart-container">
                          <h5 className="chart-title">Reward Distribution</h5>
                          {analyticsChartData.rewardDistribution ? (
                            <Pie
                              data={analyticsChartData.rewardDistribution}
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'bottom',
                                  },
                                  title: {
                                    display: false,
                                  },
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center py-5 text-muted">
                              <p>No reward distribution data available.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Collateral Growth */}
                    <div className="row mb-4">
                      <div className="col-12">
                        <div className="chart-container">
                          <h5 className="chart-title">Collateral Growth Over Time</h5>
                          {analyticsChartData.collateralGrowth ? (
                            <Line 
                              data={analyticsChartData.collateralGrowth}
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                  title: {
                                    display: false,
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center py-5 text-muted">
                              <p>No collateral growth data available for the selected time period.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Tab>
        )}
      </Tabs>

      {/* Update Estate Cost Modal */}
      <Modal show={showUpdateCostModal} onHide={() => setShowUpdateCostModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Estate Cost</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleUpdateEstateCost}>
            <Form.Group className="mb-3">
              <Form.Label>New Estate Cost</Form.Label>
              <Form.Control
                type="number"
                value={newEstateCost}
                onChange={(e) => setNewEstateCost(e.target.value)}
                placeholder="Enter new cost"
                required
              />
              <Form.Text className="text-muted">
                This will update the valuation of your estate (Enter amount in terms of your payment token)
              </Form.Text>
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Update Cost'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Send Estate Rewards Modal */}
      <Modal show={showRewardsModal} onHide={() => setShowRewardsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Send Estate Rewards</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSendRewards}>
            <Form.Group className="mb-3">
              <Form.Label>Reward Amount</Form.Label>
              <Form.Control
                type="number"
                value={estateRewards}
                onChange={(e) => setEstateRewards(e.target.value)}
                placeholder="Enter reward amount"
                required
              />
              <Form.Text className="text-muted">
                These rewards will be distributed to token holders proportionally
              </Form.Text>
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Send Rewards'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      <style jsx="true">{`
        /* ...existing styles... */
        .download-btn {
          border-radius: 6px;
          font-weight: 500;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        /* Analytics styling */
        .analytics-title {
          font-weight: 600;
          color: #344767;
        }
        
        .chart-container {
          background-color: #fff;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          height: 100%;
        }
        
        .chart-title {
          font-size: 1rem;
          font-weight: 600;
          color: #344767;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .analytics-card {
          border-radius: 10px;
          color: white;
          padding: 20px;
          height: 100%;
          display: flex;
          align-items: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }
        
        .analytics-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
        }
        
        .analytics-card-icon {
          font-size: 2.5rem;
          margin-right: 15px;
          opacity: 0.8;
        }
        
        .analytics-card-content h5 {
          font-size: 0.9rem;
          margin-bottom: 5px;
          opacity: 0.8;
        }
        
        .analytics-card-content h3 {
          font-size: 1.8rem;
          margin-bottom: 0;
          font-weight: 600;
        }
        
        .bg-gradient-primary {
          background: linear-gradient(45deg, #4e73df, #224abe);
        }
        
        .bg-gradient-success {
          background: linear-gradient(45deg, #1cc88a, #13855c);
        }
        
        .bg-gradient-info {
          background: linear-gradient(45deg, #36b9cc, #258391);
        }
        
        .bg-gradient-warning {
          background: linear-gradient(45deg, #f6c23e, #dda20a);
        }
      `}</style>
    </div>
  );
};

export default EstateOwnerDashboard;
