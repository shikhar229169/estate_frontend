import React, { useState, useEffect } from 'react';
import { Tab, Tabs, Card, Form, Button, Table, Alert, Spinner, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork } from '../utils/interact';
import { getEstateOwnersByNodeOperator, updateEstateOwner, getNodeOperatorByWalletAddress } from '../utils/api';

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
            
            // If vault address is not zero, operator is registered
            if (nodeInfo && nodeInfo.vaultAddress !== ethers.constants.AddressZero) {
              setIsRegistered(true);
              setNodeOperatorInfo(nodeInfo);
              setNodeOperatorEns(nodeInfo.ensName)
              console.log('Node operator info:', nodeInfo);
              
              // Also fetch info from backend
              try {
                const backendInfo = await getNodeOperatorByWalletAddress(walletAddress);
                if (backendInfo && backendInfo.data) {
                  // Merge blockchain and backend info
                  setNodeOperatorInfo({
                    ...nodeInfo,
                    ...backendInfo.data
                  });
                }
              } catch (error) {
                console.error('Error fetching backend operator info:', error);
              }
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
      const ethersFormattedAmount =  ethers.utils.formatUnits(amount, tokenDecimals);
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
      await updateEstateOwner(verifyEstateOwnerForm.estateOwnerId);
      
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
      <h2 className="mb-4">Node Operator Dashboard</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      {loading && (
        <div className="text-center mb-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}
      
      {!nodeOperatorInfo && (
        <Card className="mb-4">
          <Card.Body>
            <h4>Register Operator Vault</h4>
            <Form onSubmit={handleRegisterVault}>
              <Form.Group className="mb-3">
                <Form.Label>ENS Name</Form.Label>
                <Form.Control
                  type="text"
                  name="ensName"
                  value={registerVaultForm.ensName}
                  onChange={(e) => handleInputChange(e, setRegisterVaultForm)}
                  placeholder="your-ens-name.eth"
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Collateral Amount</Form.Label>
                <Form.Control
                  type="number"
                  name="collateralAmount"
                  value={registerVaultForm.collateralAmount}
                  onChange={(e) => handleInputChange(e, setRegisterVaultForm)}
                  min="1"
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Collateral Token</Form.Label>
                <Form.Control
                  type="text"
                  name="collateralToken"
                  value={registerVaultForm.collateralToken}
                  onChange={(e) => handleInputChange(e, setRegisterVaultForm)}
                  placeholder="0x... (leave empty for native token)"
                />
                <Form.Text className="text-muted">
                  Leave empty to use native token (ETH/AVAX)
                </Form.Text>
              </Form.Group>
              
              <Button variant="primary" type="submit" disabled={loading}>
                Register Vault
              </Button>
            </Form>
          </Card.Body>
        </Card>
      )}
      
      {nodeOperatorInfo && (
        <>
          <Card className="mb-4">
            <Card.Body>
              <h4>Operator Vault Information</h4>
              <Table responsive bordered>
                <tbody>
                  <tr>
                    <th>ENS Name</th>
                    <td>{nodeOperatorInfo.ensName}</td>
                  </tr>
                  <tr>
                    <th>Vault Address</th>
                    <td>{nodeOperatorInfo.vault}</td>
                  </tr>
                  <tr>
                    <th>Collateral Token</th>
                    <td>
                      {nodeOperatorInfo.token === ethers.constants.AddressZero ? 
                        `Native ${tokenSymbol}` : 
                        `${tokenSymbol} (${nodeOperatorInfo.token})`
                      }
                    </td>
                  </tr>
                  <tr>
                    <th>Collateral Amount</th>
                    <td>
                      {nodeOperatorInfo.stakedCollateralInToken ? 
                        `${formatTokenAmount(nodeOperatorInfo.stakedCollateralInToken)} ${tokenSymbol}` 
                        : 'Loading...'
                      }
                    </td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>{nodeOperatorInfo.isApproved ? 'Approved' : 'Pending Approval'}</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
          
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
          >
            <Tab eventKey="verifyEstateOwners" title="Estate Owners">
              <Card>
                <Card.Body>
                  <h4>Estate Owners</h4>
                  <Table responsive striped bordered hover>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>ETH Address</th>
                        <th>Country</th>
                        <th>Estate Value</th>
                        <th>Tokenization %</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estateOwners.map((owner, index) => (
                        <tr key={index}>
                          <td>{owner.name}</td>
                          <td>{owner.ethAddress}</td>
                          <td>{owner.country}</td>
                          <td>{formatTokenAmount(owner.currentEstateCost)} {tokenSymbol}</td>
                          <td>{owner.percentageToTokenize}%</td>
                          <td>{owner.isVerified ? 'Verified' : (owner.isRejected ? 'Rejected' : 'Pending')}</td>
                          <td>
                            <Button 
                              variant="info" 
                              size="sm"
                              className="me-2"
                              onClick={() => handleViewDetails(owner)}
                            >
                              Details
                            </Button>
                            
                            {!owner.isVerified && (
                              <Button 
                                variant="success" 
                                size="sm"
                                onClick={() => handleVerifyFromList(owner)}
                              >
                                Verify
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {estateOwners.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center">No estate owners found</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
            
            <Tab eventKey="verifyEstateOwner" title="Verify Estate Owner">
              <Card>
                <Card.Body>
                  <h4>Verify Estate Owner</h4>
                  <Form 
                    onSubmit={(e) => {
                      handleVerifyEstateOwner(e);
                    }}
                  >
                    <Form.Group className="mb-3">
                      <Form.Label>Estate Owner Address</Form.Label>
                      <Form.Control
                        type="text"
                        name="estateOwnerAddress"
                        value={verifyEstateOwnerForm.estateOwnerAddress}
                        onChange={(e) => handleInputChange(e, setVerifyEstateOwnerForm)}
                        placeholder="0x..."
                        required
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Estate Value</Form.Label>
                      <Form.Control
                        type="text"
                        name="realEstateValue"
                        value={verifyEstateOwnerForm.realEstateValue}
                        onChange={(e) => {
                          // Only allow numbers and decimal point
                          if (/^\d*\.?\d*$/.test(e.target.value)) {
                            handleInputChange(e, setVerifyEstateOwnerForm);
                          }
                        }}
                        placeholder="Enter estate value"
                        required
                      />
                      <Form.Text className="text-muted">
                        Value in {tokenSymbol}
                      </Form.Text>
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Tokenization Percentage</Form.Label>
                      <Form.Control
                        type="number"
                        name="tokenizationPercentage"
                        value={verifyEstateOwnerForm.tokenizationPercentage}
                        onChange={(e) => handleInputChange(e, setVerifyEstateOwnerForm)}
                        min="1"
                        max="100"
                        required
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Token</Form.Label>
                      <Form.Control
                        type="text"
                        name="token"
                        value={verifyEstateOwnerForm.token}
                        onChange={(e) => handleInputChange(e, setVerifyEstateOwnerForm)}
                        placeholder="0x..."
                        required
                      />
                    </Form.Group>
                    
                    <Button variant="primary" type="submit" disabled={loading || !nodeOperatorInfo?.isApproved}>
                      Verify Estate Owner
                    </Button>
                    
                    {!nodeOperatorInfo?.isApproved && (
                      <Form.Text className="text-danger">
                        Your operator vault must be approved by an admin before you can verify estate owners.
                      </Form.Text>
                    )}
                  </Form>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </>
      )}
      
      {/* Estate Owner Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Estate Owner Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEstateOwner && (
            <div>
              <h5>{selectedEstateOwner.name}</h5>
              <Table responsive bordered>
                <tbody>
                  <tr>
                    <th>ETH Address</th>
                    <td>{selectedEstateOwner.ethAddress}</td>
                  </tr>
                  <tr>
                    <th>Country</th>
                    <td>{selectedEstateOwner.country}</td>
                  </tr>
                  <tr>
                    <th>State</th>
                    <td>{selectedEstateOwner.state}</td>
                  </tr>
                  <tr>
                    <th>Address</th>
                    <td>{selectedEstateOwner.address}</td>
                  </tr>
                  <tr>
                    <th>KYC Type</th>
                    <td>{selectedEstateOwner.kycType}</td>
                  </tr>
                  <tr>
                    <th>KYC ID</th>
                    <td>{selectedEstateOwner.kycId}</td>
                  </tr>
                  <tr>
                    <th>Real Estate Information</th>
                    <td>{selectedEstateOwner.realEstateInfo}</td>
                  </tr>
                  <tr>
                    <th>Estate Value</th>
                    <td>{formatTokenAmount(selectedEstateOwner.currentEstateCost)} {tokenSymbol}</td>
                  </tr>
                  <tr>
                    <th>Tokenization Percentage</th>
                    <td>{selectedEstateOwner.percentageToTokenize}%</td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>{selectedEstateOwner.isVerified ? 'Verified' : 'Pending'}</td>
                  </tr>
                </tbody>
              </Table>
              
              <div className="mt-3">
                <h6>KYC Document</h6>
                {selectedEstateOwner.kycDocumentImage ? (
                  <img 
                    src={selectedEstateOwner.kycDocumentImage} 
                    alt="KYC Document" 
                    className="img-fluid mb-3"
                    style={{ maxHeight: '200px' }}
                  />
                ) : (
                  <p>No KYC document image available</p>
                )}
                
                <h6>Ownership Document</h6>
                {selectedEstateOwner.ownershipDocumentImage ? (
                  <img 
                    src={selectedEstateOwner.ownershipDocumentImage} 
                    alt="Ownership Document" 
                    className="img-fluid"
                    style={{ maxHeight: '200px' }}
                  />
                ) : (
                  <p>No ownership document image available</p>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
          
          {selectedEstateOwner && !selectedEstateOwner.isVerified && (
            <Button 
              variant="success" 
              onClick={() => {
                handleVerifyFromList(selectedEstateOwner);
                setShowDetailsModal(false);
              }}
            >
              Verify
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default NodeOperatorDashboard;
