import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Spinner, Form, Tab, Tabs, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork } from '../utils/interact';
import { getEstateOwnerByAddress, updateEstateOwnerData } from '../utils/api';
import TokenizedRealEstateABI from '../contracts/abi/TokenizedRealEstate';
import ERC20ABI from '../contracts/abi/ERC20ABI';

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
    </div>
  );
};

export default EstateOwnerDashboard;
