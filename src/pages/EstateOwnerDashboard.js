import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Spinner, Form, Tab, Tabs, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork } from '../utils/interact';
import { getEstateOwnerByAddress } from '../utils/api';
import TokenizedRealEstateABI from '../contracts/abi/TokenizedRealEstate';

const EstateOwnerDashboard = ({ walletAddress, chainId }) => {
  const [activeTab, setActiveTab] = useState('estateDetails');
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [estateOwner, setEstateOwner] = useState(null);
  const [tokenizationDetails, setTokenizationDetails] = useState(null);
  const [showTokenizeModal, setShowTokenizeModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenContractAddr, setTokenContractAddr] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [formattedEstateCost, setFormattedEstateCost] = useState('');

  // Form states for tokenization
  const [tokenizeForm, setTokenizeForm] = useState({
    tokenName: '',
    tokenSymbol: '',
    tokenSupply: '',
    tokenPrice: '',
    initialSalePercentage: '50'
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
                
                console.log("<MEEEEOW:", tokenSupply);

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
                  [
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                  ],
                  provider
                );
                
                // Get token symbol and decimals
                const symbol = await tokenContract.symbol();
                const decimals = await tokenContract.decimals();
                
                setTokenSymbol(symbol);
                setTokenContractAddr(estateOwner.token);
                setTokenDecimals(decimals);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTokenizeForm({ ...tokenizeForm, [name]: value });
  };

  const handleTokenize = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    if (!estateOwner || !estateOwner.isVerified) {
      setError('Your estate must be verified before tokenization');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Calculate token supply based on estate value and tokenization percentage
      const estateValue = parseFloat(estateOwner.currentEstateCost);
      const tokenizationPercentage = parseFloat(estateOwner.percentageToTokenize);
      const tokenizedValue = (estateValue * tokenizationPercentage) / 100;
      const tokenSupply = parseFloat(tokenizeForm.tokenSupply);
      const tokenPrice = tokenizedValue / tokenSupply;
      
      // Tokenize the estate
      const tx = await contracts.realEstateRegistry.tokenizeEstate(
        tokenizeForm.tokenName,
        tokenizeForm.tokenSymbol,
        ethers.utils.parseEther(tokenizeForm.tokenSupply),
        ethers.utils.parseEther(tokenPrice.toString()),
        tokenizeForm.initialSalePercentage
      );
      
      await tx.wait();
      
      setSuccess('Estate tokenized successfully!');
      setShowTokenizeModal(false);
      
      // Refresh tokenization details
      const tokenizedRealEstate = await contracts.assetTokenizationManager.getEstateOwnerToTokeinzedRealEstate(walletAddress);
      if (tokenizedRealEstate && tokenizedRealEstate !== ethers.constants.AddressZero) {
        setTokenizationDetails({
          tokenAddress: tokenizedRealEstate,
          isTokenized: true
        });
      }
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawFunds = async () => {
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    if (!tokenizationDetails || !tokenizationDetails.isTokenized) {
      setError('Your estate is not tokenized yet');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.withdrawFunds();
      await tx.wait();
      setSuccess('Funds withdrawn successfully!');
      
      // Refresh tokenization details
      const tokenizedRealEstate = await contracts.assetTokenizationManager.getEstateOwnerToTokeinzedRealEstate(walletAddress);
      if (tokenizedRealEstate && tokenizedRealEstate !== ethers.constants.AddressZero) {
        setTokenizationDetails({
          tokenAddress: tokenizedRealEstate,
          isTokenized: true
        });
      }
    } catch (error) {
      setError(`Error: ${error.message}`);
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
              
              {estateOwner.isVerified && !tokenizationDetails?.isTokenized && (
                <Button 
                  variant="primary" 
                  onClick={() => setShowTokenizeModal(true)}
                  disabled={loading}
                >
                  Tokenize Estate
                </Button>
              )}
              
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
                      <th>Initial Sale Percentage</th>
                      <td>{tokenizationDetails.initialSalePercentage ? `${tokenizationDetails.initialSalePercentage}%` : 'N/A'}</td>
                    </tr>
                    <tr>
                      <th>Tokens Sold</th>
                      <td>
                        {tokenizationDetails.tokensSold && tokenizationDetails.decimals ? 
                          ethers.utils.formatUnits(tokenizationDetails.tokensSold, tokenizationDetails.decimals) : 'N/A'} {tokenizationDetails.tokenSymbol || ''}
                      </td>
                    </tr>
                    <tr>
                      <th>Funds Raised</th>
                      <td>
                        {tokenizationDetails.fundsRaised && tokenizationDetails.decimals ? 
                          `$${ethers.utils.formatUnits(tokenizationDetails.fundsRaised, tokenizationDetails.decimals)}` : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <th>Funds Withdrawn</th>
                      <td>
                        {tokenizationDetails.fundsWithdrawn && tokenizationDetails.decimals ? 
                          `$${ethers.utils.formatUnits(tokenizationDetails.fundsWithdrawn, tokenizationDetails.decimals)}` : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </Table>
                
                {tokenizationDetails.fundsRaised && tokenizationDetails.fundsWithdrawn && tokenizationDetails.decimals && 
                  parseFloat(ethers.utils.formatUnits(tokenizationDetails.fundsRaised, tokenizationDetails.decimals)) > 
                  parseFloat(ethers.utils.formatUnits(tokenizationDetails.fundsWithdrawn, tokenizationDetails.decimals)) && (
                  <Button 
                    variant="success" 
                    onClick={handleWithdrawFunds}
                    disabled={loading}
                  >
                    Withdraw Available Funds
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Tab>
        )}
      </Tabs>
      
      {/* Tokenize Modal */}
      <Modal show={showTokenizeModal} onHide={() => setShowTokenizeModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Tokenize Your Estate</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleTokenize}>
            <Form.Group className="mb-3">
              <Form.Label>Token Name</Form.Label>
              <Form.Control
                type="text"
                name="tokenName"
                value={tokenizeForm.tokenName}
                onChange={handleInputChange}
                placeholder="e.g., Real Estate Token"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Token Symbol</Form.Label>
              <Form.Control
                type="text"
                name="tokenSymbol"
                value={tokenizeForm.tokenSymbol}
                onChange={handleInputChange}
                placeholder="e.g., RET"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Token Supply</Form.Label>
              <Form.Control
                type="number"
                name="tokenSupply"
                value={tokenizeForm.tokenSupply}
                onChange={handleInputChange}
                placeholder="e.g., 1000000"
                required
              />
              <Form.Text className="text-muted">
                The total number of tokens to create
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Initial Sale Percentage</Form.Label>
              <Form.Control
                type="number"
                name="initialSalePercentage"
                value={tokenizeForm.initialSalePercentage}
                onChange={handleInputChange}
                min="1"
                max="100"
                required
              />
              <Form.Text className="text-muted">
                Percentage of tokens available for initial sale
              </Form.Text>
            </Form.Group>
            
            <div className="mb-3">
              <h6>Summary</h6>
              <p>
                Estate Value: ${estateOwner.currentEstateCost}<br />
                Tokenization Percentage: {estateOwner.percentageToTokenize}%<br />
                Tokenized Value: ${(parseFloat(estateOwner.currentEstateCost) * parseFloat(estateOwner.percentageToTokenize) / 100).toFixed(2)}
              </p>
              
              {tokenizeForm.tokenSupply && (
                <p>
                  Token Price: ${(parseFloat(estateOwner.currentEstateCost) * parseFloat(estateOwner.percentageToTokenize) / 100 / parseFloat(tokenizeForm.tokenSupply)).toFixed(6)} per token
                </p>
              )}
            </div>
            
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Tokenize Estate'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default EstateOwnerDashboard;
