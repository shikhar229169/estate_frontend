import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Spinner, Form, Row, Col, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork, getAllTokenizedRealEstates, getERC20Contract } from '../utils/interact';
import { getEstateOwnerByAddress, updateCollateral, upsertTokenizedPositionData, createTreLog } from '../utils/api';
import TokenizedRealEstateABI from '../contracts/abi/TokenizedRealEstate';
// Import FontAwesome icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingCart, faTags, faCoins, faMoneyBillTransfer, faDollarSign, faSnowflake, faMoneyCheckDollar, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

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
      <h2 className="mb-4">User Dashboard</h2>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {loading && (
        <div className="text-center mb-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      <h3>Available Real Estate Tokens</h3>

      {tokenizedEstates.length === 0 ? (
        <Alert variant="info">
          No tokenized estates available at the moment. Check back later!
        </Alert>
      ) : (
        <Row>
          {tokenizedEstates.map((estate, index) => (
            <Col md={6} lg={4} key={index} className="mb-4">
              <Card className="h-100 shadow-sm border-0 rounded-3">
                <Card.Body>
                  <Card.Title className="d-flex justify-content-between align-items-center">
                    <span>{estate.name} ({estate.symbol})</span>
                    <span className="badge bg-light text-dark">ID: {estate.tokenId}</span>
                  </Card.Title>
                  <Card.Title className="d-flex flex-column">
                    <div className="font-monospace badge text-dark">Estate Owner:</div>
                    <div className="font-monospace badge bg-light text-dark">{estate.estateOwner}</div>
                  </Card.Title>
                  <Table responsive bordered size="sm">
                    <tbody>
                      <tr>
                        <th>Total Supply</th>
                        <td>{formatTREAmount(estate.totalSupply)} TRE</td>
                      </tr>
                      <tr>
                        <th>Your Current Chain Balance</th>
                        <td>{formatTREAmount(estate.balance)} TRE</td>
                      </tr>
                      {estate.allChainsBalance && <tr>
                        <th>Your Aggregated Chains Balance</th>
                        <td>{formatTREAmount(estate.allChainsBalance)} TRE</td>
                      </tr>}
                      <tr>
                        <th>Token Price</th>
                        <td>{estate.formattedTokenPrice} {estate.paymentTokenSymbol}</td>
                      </tr>
                      <tr>
                        <th>Available</th>
                        <td>{formatTREAmount(estate.tokensAvailable)} TRE</td>
                      </tr>
                      <tr>
                        <th>Your Collateral</th>
                        <td>{estate.formattedCollateral || "0"} {estate.paymentTokenSymbol}</td>
                      </tr>
                      {chainId === 43113 &&
                        <>
                          <tr>
                            <th>Claimed Rewards</th>
                            <td>{estate.claimedRewards || "0"} {estate.paymentTokenSymbol}</td>
                          </tr>
                          <tr>
                            <th>Claimable Rewards</th>
                            <td>{estate.claimableRewards || "0"} {estate.paymentTokenSymbol}</td>
                          </tr>
                        </>
                      }
                    </tbody>
                  </Table>

                  <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
                    {/* Add View Details button */}
                    <Button
                      variant="outline-primary"
                      onClick={() => handleViewDetails(estate)}
                      className="btn-action"
                      size="md"
                    >
                      <FontAwesomeIcon icon={faInfoCircle} className="me-1" /> View Details
                    </Button>

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
                      <FontAwesomeIcon icon={faShoppingCart} className="me-1" /> Buy TRE Tokens
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
                      <FontAwesomeIcon icon={faTags} className="me-1" /> Sell TRE Tokens
                    </Button>

                    <Button
                      variant="outline-info"
                      onClick={() => {
                        setSelectedEstate(estate);
                        setShowDepositCollateralModal(true);
                      }}
                      className="btn-action"
                      size="md"
                    >
                      <FontAwesomeIcon icon={faCoins} className="me-1" /> Deposit Collateral
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
                      <FontAwesomeIcon icon={faMoneyBillTransfer} className="me-1" /> Withdraw Collateral
                    </Button>
                    {chainId === 43113 &&
                      <Button
                        variant="outline-primary"
                        onClick={() => {
                          setSelectedEstate(estate);
                          setShowRewardModal(true);
                        }}
                        // disabled={!estate.claimableRewards}
                        className="btn-action"
                        size="md"
                      >
                        <FontAwesomeIcon icon={faMoneyCheckDollar} className="me-1" /> Claim Rewards
                      </Button>
                    }
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center mt-5 mb-3">
        <h2>Network Switcher</h2>
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

      {/* Buy Modal */}
      <Modal show={showBuyModal} onHide={() => setShowBuyModal(false)} centered>
        <Modal.Header closeButton className="bg-light">
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
      <Modal show={showSellModal} onHide={() => setShowSellModal(false)} centered>
        <Modal.Header closeButton className="bg-light">
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
      <Modal show={showDepositCollateralModal} onHide={() => setShowDepositCollateralModal(false)} centered>
        <Modal.Header closeButton className="bg-light">
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
      <Modal show={showWithdrawCollateralModal} onHide={() => setShowWithdrawCollateralModal(false)} centered>
        <Modal.Header closeButton className="bg-light">
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
      <Modal show={showRewardModal} onHide={() => setShowRewardModal(false)} centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <FontAwesomeIcon icon={faMoneyBillTransfer} className="me-2 text-primary" />
            Claim Rewards
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleClaimReward}>
            <Form.Group className="mb-3">
              <Form.Label>Claimables - {selectedEstate?.paymentTokenSymbol}</Form.Label>
              <Form.Control
                type="number"
                value={selectedEstate?.claimableRewards || '0'}
                readOnly
                className="form-control-modern"
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-primary" onClick={() => setShowRewardModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading} className="px-4">
                {loading ? <Spinner animation="border" size="sm" /> : 'Claim Rewards'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Estate Owner Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} centered size="lg">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <FontAwesomeIcon icon={faInfoCircle} className="me-2 text-primary" />
            Estate Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetails ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading estate details...</span>
              </Spinner>
            </div>
          ) : estateOwnerDetails ? (
            <div className="estate-details">
              <h4 className="mb-3">{selectedEstate?.name} ({selectedEstate?.symbol})</h4>

              <Table responsive bordered hover>
                <tbody>
                  <tr>
                    <th>Estate Owner Name</th>
                    <td>{estateOwnerDetails.name}</td>
                  </tr>
                  <tr>
                    <th>ETH Address</th>
                    <td>{estateOwnerDetails.ethAddress}</td>
                  </tr>
                  <tr>
                    <th>Tokenized Real Estate Address</th>
                    <td>{selectedEstate?.address}</td>
                  </tr>
                  <tr>
                    <th>Country</th>
                    <td>{estateOwnerDetails.country}</td>
                  </tr>
                  <tr>
                    <th>State</th>
                    <td>{estateOwnerDetails.state}</td>
                  </tr>
                  <tr>
                    <th>Address</th>
                    <td>{estateOwnerDetails.address}</td>
                  </tr>
                  <tr>
                    <th>Real Estate Information</th>
                    <td>{estateOwnerDetails.realEstateInfo}</td>
                  </tr>
                  {chainId === 43113 &&
                    <tr>
                      <th>Estate Value</th>
                      <td>
                        {estateOwnerDetails.currentEstateCost} {selectedEstate?.paymentTokenSymbol}
                      </td>
                    </tr>
                  }
                  {chainId === 43113 &&
                    <tr>
                      <th>Rewards Streamed</th>
                      <td>
                        {estateOwnerDetails.rewards} {selectedEstate?.paymentTokenSymbol}
                      </td>
                    </tr>
                  }
                  <tr>
                    <th>Payment Token</th>
                    <td>{selectedEstate?.paymentTokenSymbol}
                      {estateOwnerDetails.token ? ` (${estateOwnerDetails.token})` : ''}
                    </td>
                  </tr>
                  <tr>
                    <th>Tokenization Percentage</th>
                    <td>{estateOwnerDetails.percentageToTokenize}%</td>
                  </tr>
                  <tr>
                    <th>Verification Status</th>
                    <td>
                      {estateOwnerDetails.isVerified ? (
                        <span className="text-success">Verified</span>
                      ) : (
                        <span className="text-warning">Pending Verification</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </div>
          ) : (
            <Alert variant="warning">Failed to load estate owner details.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <style jsx="true">{`
        .btn-action {
          min-width: 110px;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn-action:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .btn-network {
          min-width: 180px;
          border-radius: 20px;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        .btn-network.active {
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .btn-network:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .form-control-modern {
          border-radius: 8px;
          border: 1px solid #ced4da;
          padding: 10px 15px;
        }
        .network-switcher {
          margin-top: 10px;
        }
        .card {
          transition: all 0.3s ease;
        }
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }
        .estate-details {
          padding: 10px;
        }
        .estate-details h4 {
          color: #2c3e50;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default UserDashboard;
