import React, { useState, useEffect } from 'react';
import { Tab, Tabs, Card, Form, Button, Table, Alert, Spinner, Modal, Row, Col, Badge, ProgressBar } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork } from '../utils/interact';
import { getEstateOwnersByNodeOperator, updateEstateOwnerByNode, getNodeOperatorByWalletAddress, updateNodeOperatorAutoUpdate, updateNodeOperatorClaimedRewards } from '../utils/api';
import VerifyingOperatorVaultABI from '../contracts/abi/VerifyingOperatorVault';
// Import FontAwesome icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle, faInfoCircle, faClipboard, faCog, faChartLine, faUsers, 
  faCoins, faHome, faNetworkWired, faUserShield, faExclamationTriangle, faEye, faMoneyBillWave, 
  faToggleOn, faToggleOff, faArrowCircleUp, faArrowCircleDown, faCheck, faBalanceScale } from '@fortawesome/free-solid-svg-icons';

const NodeOperatorDashboard = ({ walletAddress, chainId }) => {
  const [activeTab, setActiveTab] = useState('verifyEstateOwners');
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [estateOwners, setEstateOwners] = useState([]);
  const [nodeOperatorEns, setNodeOperatorEns] = useState('');
  const [nodeOperatorInfo, setNodeOperatorInfo] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [tokenDecimals, setTokenDecimals] = useState(18); // Default to 18 for native token
  const [tokenSymbol, setTokenSymbol] = useState(''); // For storing the token symbol
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false); // New state for auto update
  const [nodeOperatorId, setNodeOperatorId] = useState(null); // Add state for node operator ID

  // Form states for various node operator functions
  const [registerVaultForm, setRegisterVaultForm] = useState({
    ensName: '',
    collateralAmount: '10',
    collateralToken: ''
  });

  const [verifyEstateOwnerForm, setVerifyEstateOwnerForm] = useState({
    estateOwnerId: '',
    estateOwnerAddress: '',
    realEstateValue: '',
    tokenizationPercentage: '',
    token: ''
  });

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEstateOwner, setSelectedEstateOwner] = useState(null);

  useEffect(() => {
    const loadContracts = async () => {
      try {
        setLoading(true);

        if (walletAddress) {
          // Get contracts
          const contractInstances = getContracts(chainId);
          setContracts(contractInstances);

          // Try to get node operator info
          try {
            const nodeInfo = await contractInstances.realEstateRegistry.getOperatorInfo(walletAddress);
            const operatorVaultAddress = await contractInstances.realEstateRegistry.getOperatorVault(walletAddress);
            const operatorVault = new ethers.Contract(operatorVaultAddress, VerifyingOperatorVaultABI, contractInstances.signer);
            const aue = await operatorVault.isAutoUpdateEnabled()
            const claimableRewards = await operatorVault.getRewards();
            let claimedRewards = "0";

            // If vault address is not zero, operator is registered
            if (nodeInfo && nodeInfo.vaultAddress !== ethers.constants.AddressZero) {
              setIsRegistered(true);
              setNodeOperatorEns(nodeInfo.ensName);
              setAutoUpdateEnabled(aue); // Set auto update status
              console.log('Node operator info:', nodeInfo);

              // Also fetch info from backend
              try {
                const backendInfo = await getNodeOperatorByWalletAddress(walletAddress);
                if (backendInfo && backendInfo.data) {
                  // Merge blockchain and backend info
                  // setNodeOperatorInfo({
                  //   ...nodeInfo,
                  //   ...backendInfo.data
                  // });
                  claimedRewards = backendInfo.data.claimedRewards || "0";
                  setNodeOperatorId(backendInfo.data.id); // Store the node operator ID
                }
              } catch (error) {
                console.error('Error fetching backend operator info:', error);
              }

              setNodeOperatorInfo({ ...nodeInfo, claimableRewards, claimedRewards });
            } else {
              setIsRegistered(false);
              console.log('Not registered as a node operator');
            }
          } catch (error) {
            console.error('Error loading node operator info:', error);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };

    loadContracts();
  }, [walletAddress, chainId]);

  useEffect(() => {
    // Load estate owners for this node operator
    const loadEstateOwners = async () => {
      if (nodeOperatorEns) {
        try {
          setLoading(true);
          const estateOwners = await getEstateOwnersByNodeOperator(nodeOperatorEns);
          // Here users conatins estate owners
          setEstateOwners(estateOwners || []);
        } catch (error) {
          console.error('Error loading estate owners:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadEstateOwners();
  }, [nodeOperatorEns]);

  useEffect(() => {
    const getTokenInfo = async () => {
      if (nodeOperatorInfo && nodeOperatorInfo.token) {
        if (nodeOperatorInfo.token === ethers.constants.AddressZero) {
          // For native token, get symbol based on chain
          setTokenSymbol(getNativeCurrencySymbol(chainId));
          setTokenDecimals(18);
        } else {
          try {
            const erc20 = new ethers.Contract(
              nodeOperatorInfo.token,
              [
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)'
              ],
              contracts.provider
            );
            const [decimals, symbol] = await Promise.all([
              erc20.decimals(),
              erc20.symbol()
            ]);
            setTokenDecimals(decimals);
            setTokenSymbol(symbol);
          } catch (error) {
            console.error('Error getting token info:', error);
            setTokenDecimals(18);
            setTokenSymbol('Tokens');
          }
        }
      }
    };

    getTokenInfo();
  }, [nodeOperatorInfo, contracts, chainId]);

  // Helper function to get native currency symbol based on chain ID
  const getNativeCurrencySymbol = (chainId) => {
    switch (chainId) {
      case 43113: // Avalanche Fuji
        return 'AVAX';
      case 11155111: // Ethereum Sepolia
        return 'ETH';
      default:
        return 'ETH';
    }
  };

  const formatTokenAmount = (amount) => {
    if (!amount) return '0';
    try {
      const ethersFormattedAmount = ethers.utils.formatUnits(amount, tokenDecimals);
      return ethersFormattedAmount.includes('.') ? ethersFormattedAmount.split('.')[0] + '.' + ethersFormattedAmount.split('.')[1].slice(0, 4) : ethersFormattedAmount;
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  };

  const handleInputChange = (e, formSetter) => {
    const { name, value } = e.target;
    formSetter(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterVault = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // First approve collateral token if needed
      if (registerVaultForm.collateralToken !== ethers.constants.AddressZero) {
        const erc20 = new ethers.Contract(
          registerVaultForm.collateralToken,
          ['function approve(address spender, uint256 amount) public returns (bool)'],
          contracts.signer
        );

        const approveTx = await erc20.approve(
          contracts.realEstateRegistry.address,
          ethers.utils.parseEther(registerVaultForm.collateralAmount)
        );

        await approveTx.wait();
      }

      // Register vault
      const tx = await contracts.realEstateRegistry.registerOperatorVault(
        registerVaultForm.ensName,
        {
          value: registerVaultForm.collateralToken === ethers.constants.AddressZero
            ? ethers.utils.parseEther(registerVaultForm.collateralAmount)
            : 0
        }
      );

      await tx.wait();
      setSuccess('Operator vault registered successfully!');
      setNodeOperatorEns(registerVaultForm.ensName);

      // Reset form
      setRegisterVaultForm({
        ensName: '',
        collateralAmount: '10',
        collateralToken: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyFromList = (estateOwner) => {
    console.log("Verity eo:", estateOwner)
    setVerifyEstateOwnerForm({
      estateOwnerId: estateOwner._id,
      estateOwnerAddress: estateOwner.ethAddress,
      realEstateValue: estateOwner.currentEstateCost.toString(),
      tokenizationPercentage: estateOwner.percentageToTokenize,
      token: estateOwner.token || ethers.constants.AddressZero
    });

    setActiveTab('verifyEstateOwner');
  };

  const handleVerifyEstateOwner = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.estateVerification) {
      setError('Estate Verification contract not loaded');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const _request = {
        estateOwner: verifyEstateOwnerForm.estateOwnerAddress,
        chainsToDeploy: [43113, 11155111],
        paymentToken: verifyEstateOwnerForm.token,
        estateOwnerAcrossChain: [verifyEstateOwnerForm.estateOwnerAddress, verifyEstateOwnerForm.estateOwnerAddress]
      };

      const _response = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'bool', 'bytes', 'address'],
        [
          verifyEstateOwnerForm.realEstateValue,
          ethers.utils.parseEther(verifyEstateOwnerForm.tokenizationPercentage.toString()),
          true,
          ethers.utils.toUtf8Bytes(verifyEstateOwnerForm.estateOwnerId),
          walletAddress
        ]
      );

      const tx = await contracts.estateVerification.createTestRequestIdResponse(
        _request,
        _response
      );

      await tx.wait();

      // Update estate owner status in backend using _id
      await updateEstateOwnerByNode(verifyEstateOwnerForm.estateOwnerId);

      setSuccess('Estate owner verified successfully!');

      // Reset form
      setVerifyEstateOwnerForm({
        estateOwnerId: '',
        estateOwnerAddress: '',
        realEstateValue: '',
        tokenizationPercentage: '',
        token: ''
      });

      // Refresh estate owners list
      const estateOwners = await getEstateOwnersByNodeOperator(nodeOperatorEns);
      setEstateOwners(estateOwners || []);
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (estateOwner) => {
    setSelectedEstateOwner(estateOwner);
    setShowDetailsModal(true);
  };

  const handleClaimRewards = async () => {
    try {
      setLoading(true);
      setError('');
      // Get the operator vault address
      const operatorVaultAddress = await contracts.realEstateRegistry.getOperatorVault(walletAddress);
      const operatorVault = new ethers.Contract(operatorVaultAddress, VerifyingOperatorVaultABI, contracts.signer);

      const latestClaimableRewards = await operatorVault.getRewards();

      // Claim Rewards
      const tx = await operatorVault.claimRewardFromStaking();
      await tx.wait();

      const claimedRewards = (ethers.BigNumber.from(nodeOperatorInfo.claimedRewards || "0")).add(latestClaimableRewards);
      const claimableRewards = ethers.BigNumber.from(0);

      // Update local state
      setNodeOperatorInfo({...nodeOperatorInfo, claimableRewards: claimableRewards, claimedRewards: claimedRewards.toString()});

      // Update backend state
      await updateNodeOperatorClaimedRewards(nodeOperatorId, claimedRewards.toString());

      setSuccess('Rewards Claimed successfully!');
    } catch (error) {
      console.error('Error claiming Rewards:', error);
      setError('');
      setSuccess('No Rewards to Claim.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleAutoUpdate = async () => {
    try {
      setLoading(true);
      setError('');
      // Get the operator vault address
      const operatorVaultAddress = await contracts.realEstateRegistry.getOperatorVault(walletAddress);
      const operatorVault = new ethers.Contract(operatorVaultAddress, VerifyingOperatorVaultABI, contracts.signer);

      // Toggle auto update on the vault
      const tx = await operatorVault.toggleAutoUpdate();
      await tx.wait();

      // Update local state
      const newAutoUpdateStatus = !autoUpdateEnabled;
      setAutoUpdateEnabled(newAutoUpdateStatus);

      // Update backend state
      await updateNodeOperatorAutoUpdate(nodeOperatorId, newAutoUpdateStatus);

      setSuccess('Auto update setting has been toggled successfully');
    } catch (error) {
      console.error('Error toggling auto update:', error);
      setError('Failed to toggle auto update: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleForceUpgrade = async () => {
    try {
      setLoading(true);
      setError('');
      
      const operatorVaultImplementation = await contracts.realEstateRegistry.getOperatorVaultImplementation();
      const operatorVaultAddress = await contracts.realEstateRegistry.getOperatorVault(walletAddress);
      const operatorVault = new ethers.Contract(operatorVaultAddress, VerifyingOperatorVaultABI, contracts.signer);
      await operatorVault.upgradeToAndCall(operatorVaultImplementation, []);
      
      setSuccess('Vault has been force upgraded successfully');
    } catch (error) {
      
      if (error.error.data.data === "0x3e924efb") {
        setSuccess('Vault is already up to date');
      }
      else {
        console.error('Error force upgrading vault:', error);
        setError('Failed to force upgrade vault: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="text-center">
        <h2>Please connect your wallet to access the Node Operator Dashboard</h2>
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

  if (!isRegistered) {
    return (
      <div className="text-center">
        <h2>You are not registered as a node operator.</h2>
        <p>Please sign up first.</p>
        <Button
          variant="primary"
          onClick={() => window.location.href = '/node-operator-signup'}
        >
          Sign Up as Node Operator
        </Button>
      </div>
    );
  }

  return (
    <div className="node-operator-dashboard">
      <h2 className="dashboard-title mb-4">
        <FontAwesomeIcon icon={faUserShield} className="me-2" />
        Node Operator Dashboard
      </h2>

      {error && <Alert variant="danger" className="animated-alert">
        <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
        {error}
      </Alert>}
      
      {success && <Alert variant="success" className="animated-alert">
        <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
        {success}
      </Alert>}

      {loading && (
        <div className="text-center mb-4 loader-container">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2 loading-text">Loading node operator data...</p>
        </div>
      )}

      {!walletAddress ? (
        <div className="text-center connect-wallet-card">
          <Card className="shadow-sm border-0">
            <Card.Body className="p-5">
              <div className="mb-4 connection-icon">
                <FontAwesomeIcon icon={faNetworkWired} size="3x" />
              </div>
              <h3>Please Connect Your Wallet</h3>
              <p className="text-muted">Connect your wallet to access the Node Operator Dashboard</p>
            </Card.Body>
          </Card>
        </div>
      ) : !chainId ? (
        <div className="text-center network-selection-card">
          <Card className="shadow-sm border-0">
            <Card.Body className="p-5">
              <div className="mb-4 network-icon">
                <FontAwesomeIcon icon={faNetworkWired} size="3x" />
              </div>
              <h3>Select a Network</h3>
              <p className="text-muted mb-4">Please connect to a supported network</p>
              <div className="d-flex justify-content-center">
                <Button
                  variant="outline-primary"
                  className="me-3 network-btn fuji-btn"
                  onClick={() => switchNetwork(43113)}
                >
                  <i className="network-icon fuji"></i>
                  Switch to Fuji
                </Button>
                <Button
                  variant="outline-primary"
                  className="network-btn sepolia-btn"
                  onClick={() => switchNetwork(11155111)}
                >
                  <i className="network-icon sepolia"></i>
                  Switch to Sepolia
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      ) : !isRegistered ? (
        <div className="text-center signup-card">
          <Card className="shadow-sm border-0">
            <Card.Body className="p-5">
              <div className="mb-4 signup-icon">
                <FontAwesomeIcon icon={faUserShield} size="3x" />
              </div>
              <h3>Not Registered</h3>
              <p className="text-muted mb-4">You are not registered as a node operator. Please sign up first.</p>
              <Button
                variant="primary"
                size="lg"
                className="signup-btn"
                onClick={() => window.location.href = '/node-operator-signup'}
              >
                Sign Up as Node Operator
              </Button>
            </Card.Body>
          </Card>
        </div>
      ) : (
        <>
          {!nodeOperatorInfo ? (
            <Card className="mb-4 shadow-sm border-0 register-vault-card">
              <Card.Header className="bg-transparent border-bottom-0 pt-4">
                <h4>
                  <FontAwesomeIcon icon={faHome} className="me-2" />
                  Register Operator Vault
                </h4>
              </Card.Header>
              <Card.Body className="p-4">
                <Form onSubmit={handleRegisterVault}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>ENS Name</Form.Label>
                        <div className="input-with-icon">
                          <FontAwesomeIcon icon={faClipboard} className="input-icon" />
                          <Form.Control
                            type="text"
                            name="ensName"
                            value={registerVaultForm.ensName}
                            onChange={(e) => handleInputChange(e, setRegisterVaultForm)}
                            placeholder="your-ens-name.eth"
                            required
                            className="ps-4"
                          />
                        </div>
                      </Form.Group>
                    </Col>
                    
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Collateral Amount</Form.Label>
                        <div className="input-with-icon">
                          <FontAwesomeIcon icon={faCoins} className="input-icon" />
                          <Form.Control
                            type="number"
                            name="collateralAmount"
                            value={registerVaultForm.collateralAmount}
                            onChange={(e) => handleInputChange(e, setRegisterVaultForm)}
                            min="1"
                            required
                            className="ps-4"
                          />
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label>Collateral Token</Form.Label>
                    <div className="input-with-icon">
                      <FontAwesomeIcon icon={faCoins} className="input-icon" />
                      <Form.Control
                        type="text"
                        name="collateralToken"
                        value={registerVaultForm.collateralToken}
                        onChange={(e) => handleInputChange(e, setRegisterVaultForm)}
                        placeholder="0x... (leave empty for native token)"
                        className="ps-4"
                      />
                    </div>
                    <Form.Text className="text-muted">
                      Leave empty to use native token (ETH/AVAX)
                    </Form.Text>
                  </Form.Group>

                  <div className="text-center mt-4">
                    <Button variant="primary" type="submit" disabled={loading} className="px-5 py-2">
                      {loading ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Registering...
                        </>
                      ) : (
                        <>Register Vault</>
                      )}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          ) : (
            <>
              <Row className="mb-4">
                <Col lg={8}>
                  <Card className="shadow-sm border-0 h-100 vault-info-card">
                    <Card.Header className="bg-transparent pt-4 pb-2 border-0">
                      <h4 className="mb-0">
                        <FontAwesomeIcon icon={faHome} className="me-2" />
                        Operator Vault Information
                      </h4>
                    </Card.Header>
                    <Card.Body className="pb-4">
                      <Table responsive bordered className="mb-0 custom-table">
                        <tbody>
                          <tr>
                            <th className="bg-light"><FontAwesomeIcon icon={faClipboard} className="me-2" />ENS Name</th>
                            <td>
                              <div className="d-flex align-items-center">
                                <span className="ens-badge me-2"></span>
                                {nodeOperatorInfo.ensName}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-light"><FontAwesomeIcon icon={faHome} className="me-2" />Vault Address</th>
                            <td className="font-monospace small">{nodeOperatorInfo.vault}</td>
                          </tr>
                          <tr>
                            <th className="bg-light"><FontAwesomeIcon icon={faCoins} className="me-2" />Collateral Token</th>
                            <td>
                              <Badge bg="light" text="dark" className="token-badge">
                                {nodeOperatorInfo.token === ethers.constants.AddressZero ?
                                  `Native ${tokenSymbol}` :
                                  `${tokenSymbol} (${nodeOperatorInfo.token})`
                                }
                              </Badge>
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-light"><FontAwesomeIcon icon={faBalanceScale} className="me-2" />Collateral Amount</th>
                            <td>
                              <div className="d-flex align-items-center">
                                {nodeOperatorInfo.stakedCollateralInToken ?
                                  `${formatTokenAmount(nodeOperatorInfo.stakedCollateralInToken)} ${tokenSymbol}`
                                  : 'Loading...'
                                }
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <th className="bg-light"><FontAwesomeIcon icon={faCheckCircle} className="me-2" />Status</th>
                            <td>
                              {nodeOperatorInfo.isApproved ? (
                                <Badge bg="success" className="status-badge approved">
                                  <FontAwesomeIcon icon={faCheckCircle} className="me-1" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge bg="warning" text="dark" className="status-badge pending">
                                  <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
                                  Pending Approval
                                </Badge>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
                <Col lg={4}>
                  <Card className="mb-3 shadow-sm border-0 rewards-card">
                    <Card.Body className="p-4">
                      <h5 className="card-subtitle">
                        <FontAwesomeIcon icon={faMoneyBillWave} className="me-2" />
                        Node Rewards
                      </h5>
                      <div className="rewards-section mt-3">
                        <div className="mb-3">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Claimable Rewards</span>
                            <span className="fw-bold">{formatTokenAmount(nodeOperatorInfo.claimableRewards)} {tokenSymbol}</span>
                          </div>
                          <ProgressBar 
                            now={nodeOperatorInfo.claimableRewards ? 
                              (parseFloat(formatTokenAmount(nodeOperatorInfo.claimableRewards)) / 
                              (parseFloat(formatTokenAmount(nodeOperatorInfo.claimableRewards)) + 
                               parseFloat(formatTokenAmount(nodeOperatorInfo.claimedRewards)) || 1)) * 100 : 0} 
                            variant="success" 
                            className="rewards-progress"
                          />
                        </div>
                        
                        <div>
                          <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Total Claimed</span>
                            <span className="fw-bold">{formatTokenAmount(nodeOperatorInfo.claimedRewards)} {tokenSymbol}</span>
                          </div>
                        </div>
                        
                        <Button
                          variant={nodeOperatorInfo.claimableRewards && !nodeOperatorInfo.claimableRewards.isZero() ? "success" : "outline-secondary"}
                          className="w-100 mt-3 claim-btn"
                          onClick={handleClaimRewards}
                          disabled={loading}
                        >
                          {loading ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faCoins} className="me-2" />
                              {nodeOperatorInfo.claimableRewards && !nodeOperatorInfo.claimableRewards.isZero() ? 'Claim Rewards' : 'No Rewards to Claim'}
                            </>
                          )}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                  
                  <Card className="shadow-sm border-0 auto-update-card">
                    <Card.Body className="p-4">
                      <h5 className="card-subtitle">
                        <FontAwesomeIcon icon={faCog} className="me-2" />
                        Auto Update
                      </h5>
                      
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <span className="status-text">
                          {autoUpdateEnabled ? (
                            <>
                              <FontAwesomeIcon icon={faToggleOn} className="me-2 text-success" />
                              Enabled
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faToggleOff} className="me-2 text-secondary" />
                              Disabled
                            </>
                          )}
                        </span>
                        
                        <div>
                          <Button
                            variant={autoUpdateEnabled ? "warning" : "success"}
                            size="sm"
                            onClick={handleToggleAutoUpdate}
                            disabled={loading}
                            className="auto-update-btn"
                          >
                            {autoUpdateEnabled ? (
                              <>
                                <FontAwesomeIcon icon={faArrowCircleDown} className="me-1" />
                                Disable
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faArrowCircleUp} className="me-1" />
                                Enable
                              </>
                            )}
                          </Button>
                          
                          {!autoUpdateEnabled && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleForceUpgrade}
                              disabled={loading}
                              className="ms-2 upgrade-btn"
                            >
                              <FontAwesomeIcon icon={faArrowCircleUp} className="me-1" />
                              Upgrade
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-4 custom-tabs"
              >
                <Tab 
                  eventKey="verifyEstateOwners" 
                  title={
                    <span>
                      <FontAwesomeIcon icon={faUsers} className="me-2" />
                      Estate Owners
                    </span>
                  }
                >
                  <Card className="shadow-sm border-0">
                    <Card.Body className="p-4">
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4 className="mb-0">
                          <FontAwesomeIcon icon={faUsers} className="me-2" />
                          Estate Owners
                        </h4>
                        <Badge bg="primary" pill className="owner-count">
                          {estateOwners.length} {estateOwners.length === 1 ? 'Owner' : 'Owners'}
                        </Badge>
                      </div>
                      
                      <div className="table-responsive owners-table">
                        <Table responsive striped hover className="custom-table">
                          <thead className="table-header">
                            <tr>
                              <th>Name</th>
                              <th>ETH Address</th>
                              <th>Country</th>
                              <th>Estate Value</th>
                              <th>Tokenization %</th>
                              <th>Status</th>
                              <th className="text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estateOwners.map((owner, index) => (
                              <tr key={index} className="owner-row">
                                <td>{owner.name}</td>
                                <td className="font-monospace small">{owner.ethAddress}</td>
                                <td>{owner.country}</td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <span>{formatTokenAmount(owner.currentEstateCost)} {tokenSymbol}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="tokenization-percent">
                                    <div className="progress" style={{ height: '6px' }}>
                                      <div 
                                        className="progress-bar bg-primary" 
                                        role="progressbar" 
                                        style={{ width: `${owner.percentageToTokenize}%` }}
                                        aria-valuenow={owner.percentageToTokenize}
                                        aria-valuemin="0" 
                                        aria-valuemax="100">
                                      </div>
                                    </div>
                                    <small>{owner.percentageToTokenize}%</small>
                                  </div>
                                </td>
                                <td>
                                  {owner.isVerified ? (
                                    <Badge bg="success" className="status-badge">
                                      <FontAwesomeIcon icon={faCheckCircle} className="me-1" />
                                      Verified
                                    </Badge>
                                  ) : owner.isRejected ? (
                                    <Badge bg="danger" className="status-badge">
                                      <FontAwesomeIcon icon={faTimesCircle} className="me-1" />
                                      Rejected
                                    </Badge>
                                  ) : (
                                    <Badge bg="warning" text="dark" className="status-badge">
                                      <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
                                      Pending
                                    </Badge>
                                  )}
                                </td>
                                <td className="text-center">
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    className="action-btn me-2"
                                    onClick={() => handleViewDetails(owner)}
                                  >
                                    <FontAwesomeIcon icon={faEye} className="me-1" />
                                    Details
                                  </Button>

                                  {!owner.isVerified && (
                                    <Button
                                      variant="outline-success"
                                      size="sm"
                                      className="action-btn"
                                      onClick={() => handleVerifyFromList(owner)}
                                    >
                                      <FontAwesomeIcon icon={faCheck} className="me-1" />
                                      Verify
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {estateOwners.length === 0 && (
                              <tr>
                                <td colSpan="7" className="text-center py-5 text-muted">
                                  <FontAwesomeIcon icon={faInfoCircle} size="2x" className="mb-3 d-block mx-auto" />
                                  No estate owners found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                      </div>
                    </Card.Body>
                  </Card>
                </Tab>

                <Tab 
                  eventKey="verifyEstateOwner" 
                  title={
                    <span>
                      <FontAwesomeIcon icon={faCheck} className="me-2" />
                      Verify Estate Owner
                    </span>
                  }
                >
                  <Card className="shadow-sm border-0 verification-card">
                    <Card.Body className="p-4">
                      <div className="verification-header mb-4">
                        <h4>
                          <FontAwesomeIcon icon={faCheck} className="me-2" />
                          Verify Estate Owner
                        </h4>
                        <p className="text-muted">Complete the verification process for the selected estate owner</p>
                      </div>
                      
                      <Form
                        onSubmit={(e) => {
                          handleVerifyEstateOwner(e);
                        }}
                      >
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Estate Owner Address</Form.Label>
                              <div className="input-with-icon">
                                <FontAwesomeIcon icon={faHome} className="input-icon" />
                                <Form.Control
                                  type="text"
                                  name="estateOwnerAddress"
                                  value={verifyEstateOwnerForm.estateOwnerAddress}
                                  onChange={(e) => handleInputChange(e, setVerifyEstateOwnerForm)}
                                  placeholder="0x..."
                                  required
                                  className="ps-4"
                                  readOnly={!!verifyEstateOwnerForm.estateOwnerId}
                                />
                              </div>
                            </Form.Group>
                          </Col>
                          
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Tokenization Percentage</Form.Label>
                              <div className="input-with-icon">
                                <FontAwesomeIcon icon={faChartLine} className="input-icon" />
                                <Form.Control
                                  type="number"
                                  name="tokenizationPercentage"
                                  value={verifyEstateOwnerForm.tokenizationPercentage}
                                  onChange={(e) => handleInputChange(e, setVerifyEstateOwnerForm)}
                                  min="1"
                                  max="100"
                                  required
                                  className="ps-4"
                                />
                              </div>
                            </Form.Group>
                          </Col>
                        </Row>
                        
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Estate Value</Form.Label>
                              <div className="input-with-icon">
                                <FontAwesomeIcon icon={faCoins} className="input-icon" />
                                <Form.Control
                                  type="text"
                                  name="realEstateValue"
                                  value={verifyEstateOwnerForm.realEstateValue}
                                  onChange={(e) => {
                                    if (/^\d*\.?\d*$/.test(e.target.value)) {
                                      handleInputChange(e, setVerifyEstateOwnerForm);
                                    }
                                  }}
                                  placeholder="Enter estate value"
                                  required
                                  className="ps-4"
                                />
                              </div>
                              <Form.Text className="text-muted">
                                Value in {tokenSymbol}
                              </Form.Text>
                            </Form.Group>
                          </Col>
                          
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Token</Form.Label>
                              <div className="input-with-icon">
                                <FontAwesomeIcon icon={faCoins} className="input-icon" />
                                <Form.Control
                                  type="text"
                                  name="token"
                                  value={verifyEstateOwnerForm.token}
                                  onChange={(e) => handleInputChange(e, setVerifyEstateOwnerForm)}
                                  placeholder="0x..."
                                  required
                                  className="ps-4"
                                />
                              </div>
                            </Form.Group>
                          </Col>
                        </Row>

                        <div className="text-center mt-4">
                          <Button 
                            variant="primary" 
                            type="submit" 
                            disabled={loading || !nodeOperatorInfo?.isApproved}
                            className="px-5 py-2 verify-btn"
                          >
                            {loading ? (
                              <>
                                <Spinner size="sm" animation="border" className="me-2" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faCheck} className="me-2" />
                                Verify Estate Owner
                              </>
                            )}
                          </Button>

                          {!nodeOperatorInfo?.isApproved && (
                            <div className="text-danger mt-3">
                              <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                              Your operator vault must be approved by an admin before you can verify estate owners.
                            </div>
                          )}
                        </div>
                      </Form>
                    </Card.Body>
                  </Card>
                </Tab>
              </Tabs>
            </>
          )}
          
          {/* Estate Owner Details Modal */}
          <Modal 
            show={showDetailsModal} 
            onHide={() => setShowDetailsModal(false)} 
            size="xl" 
            centered 
            dialogClassName="estate-details-modal"
          >
            <Modal.Header closeButton className="estate-details-header">
              <Modal.Title className="estate-details-title">
                <FontAwesomeIcon icon={faHome} className="me-2 estate-icon pulse-animation" />
                Estate Owner Profile
              </Modal.Title>
            </Modal.Header>
            
            <Modal.Body className="p-0">
              {selectedEstateOwner && (
                <div className="estate-details-container">
                  {/* Owner Banner */}
                  <div className="estate-owner-banner">
                    <div className="banner-overlay"></div>
                    <div className="owner-profile-section">
                      <div className="owner-avatar">
                        {selectedEstateOwner.name?.charAt(0) || "E"}
                      </div>
                      <div className="owner-main-info">
                        <h3 className="owner-name">{selectedEstateOwner.name}</h3>
                        <div className="d-flex align-items-center mb-2">
                          <div className="eth-address-pill">
                            <FontAwesomeIcon icon={faClipboard} className="me-2" />
                            <span className="address-text">{selectedEstateOwner.ethAddress}</span>
                          </div>
                        </div>
                        <div className="verification-status">
                          {selectedEstateOwner.isVerified ? (
                            <Badge bg="success" pill className="verification-badge">
                              <FontAwesomeIcon icon={faCheckCircle} className="me-1" />
                              Verified
                            </Badge>
                          ) : selectedEstateOwner.isRejected ? (
                            <Badge bg="danger" pill className="verification-badge">
                              <FontAwesomeIcon icon={faTimesCircle} className="me-1" />
                              Rejected
                            </Badge>
                          ) : (
                            <Badge bg="warning" text="dark" pill className="verification-badge">
                              <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
                              Pending Verification
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Main Content */}
                  <div className="details-content-wrapper">
                    {/* Estate Value Card */}
                    <div className="estate-value-card">
                      <div className="estate-value-content">
                        <div className="estate-value-amount">
                          <span className="currency-symbol">{tokenSymbol}</span>
                          <span className="value-amount">{formatTokenAmount(selectedEstateOwner.currentEstateCost)}</span>
                        </div>
                        <div className="estate-value-label">Estate Value</div>
                        <div className="tokenization-wrapper">
                          <div className="tokenization-label">
                            <span>Tokenization</span>
                            <span className="tokenization-percentage">{selectedEstateOwner.percentageToTokenize}%</span>
                          </div>
                          <ProgressBar 
                            now={selectedEstateOwner.percentageToTokenize} 
                            variant="primary" 
                            className="tokenization-progress" 
                          />
                        </div>
                      </div>
                    </div>
                              
                    {/* Information Cards */}
                    <div className="details-cards-container">
                      {/* Personal Information Card */}
                      <div className="detail-card">
                        <div className="detail-card-header">
                          <FontAwesomeIcon icon={faUserShield} className="detail-card-icon" />
                          <h4>Personal Information</h4>
                        </div>
                        <div className="detail-card-body">
                          <div className="info-row">
                            <div className="info-label">Country</div>
                            <div className="info-value">{selectedEstateOwner.country || 'Not specified'}</div>
                          </div>
                          <div className="info-row">
                            <div className="info-label">State/Region</div>
                            <div className="info-value">{selectedEstateOwner.state || 'Not specified'}</div>
                          </div>
                          <div className="info-row">
                            <div className="info-label">Address</div>
                            <div className="info-value">{selectedEstateOwner.address || 'Not specified'}</div>
                          </div>
                          <div className="info-row">
                            <div className="info-label">KYC Type</div>
                            <div className="info-value">
                              <Badge bg="light" text="dark" className="kyc-badge">{selectedEstateOwner.kycType || 'Not specified'}</Badge>
                            </div>
                          </div>
                          <div className="info-row">
                            <div className="info-label">KYC ID</div>
                            <div className="info-value">{selectedEstateOwner.kycId || 'Not specified'}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Estate Information Card */}
                      <div className="detail-card">
                        <div className="detail-card-header">
                          <FontAwesomeIcon icon={faHome} className="detail-card-icon" />
                          <h4>Estate Information</h4>
                        </div>
                        <div className="detail-card-body">
                          <div className="info-row">
                            <div className="info-label">Estate Details</div>
                            <div className="info-value estate-description">{selectedEstateOwner.realEstateInfo || 'No information provided'}</div>
                          </div>
                          <div className="info-row">
                            <div className="info-label">Registration Date</div>
                            <div className="info-value">
                              {selectedEstateOwner.createdAt ? new Date(selectedEstateOwner.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'Not available'}
                            </div>
                          </div>
                          <div className="info-row">
                            <div className="info-label">Status</div>
                            <div className="info-value">
                              {selectedEstateOwner.isVerified ? (
                                <span className="status-text success">
                                  <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
                                  Verified
                                </span>
                              ) : selectedEstateOwner.isRejected ? (
                                <span className="status-text danger">
                                  <FontAwesomeIcon icon={faTimesCircle} className="me-2" />
                                  Rejected
                                </span>
                              ) : (
                                <span className="status-text warning">
                                  <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                                  Pending Verification
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Documents Section */}
                    <div className="documents-section">
                      <h4 className="documents-title">
                        <FontAwesomeIcon icon={faClipboard} className="me-2" />
                        Verification Documents
                      </h4>
                      
                      <div className="documents-container">
                        {/* KYC Document */}
                        <div className="document-card">
                          <div className="document-header">
                            <FontAwesomeIcon icon={faUserShield} className="document-icon" />
                            <h5>KYC Document</h5>
                          </div>
                          <div className="document-body">
                            {selectedEstateOwner.kycDocumentImage ? (
                              <div className="document-image-container">
                                <img
                                  src={selectedEstateOwner.kycDocumentImage}
                                  alt="KYC Document"
                                  className="document-image"
                                  
                                />
                                <div onClick={() => { window.open(selectedEstateOwner.kycDocumentImage, '_blank');}} className="image-overlay">
                                  <FontAwesomeIcon icon={faEye} />
                                  <span>Click to View</span>
                                </div>
                              </div>
                            ) : (
                              <div className="missing-document">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                <p>No KYC document provided</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Ownership Document */}
                        <div className="document-card">
                          <div className="document-header">
                            <FontAwesomeIcon icon={faHome} className="document-icon" />
                            <h5>Ownership Document</h5>
                          </div>
                          <div className="document-body">
                            {selectedEstateOwner.ownershipDocumentImage ? (
                              <div className="document-image-container">
                                <img
                                  src={selectedEstateOwner.ownershipDocumentImage}
                                  alt="Ownership Document"
                                  className="document-image"
                                />
                                <div onClick={() => window.open(selectedEstateOwner.ownershipDocumentImage, '_blank')} className="image-overlay">
                                  <FontAwesomeIcon icon={faEye} />
                                  <span>Click to view</span>
                                </div>
                              </div>
                            ) : (
                              <div className="missing-document">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                <p>No ownership document provided</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Modal.Body>
            
            <Modal.Footer className="estate-details-footer">
              <Button variant="outline-secondary" className="btn-close-details" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>

              {selectedEstateOwner && !selectedEstateOwner.isVerified && (
                <Button
                  variant="primary"
                  className="btn-verify-estate"
                  onClick={() => {
                    handleVerifyFromList(selectedEstateOwner);
                    setShowDetailsModal(false);
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} className="me-2" />
                  Verify Estate Owner
                </Button>
              )}
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  );
};

export default NodeOperatorDashboard;
