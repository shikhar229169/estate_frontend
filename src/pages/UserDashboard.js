import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Spinner, Form, Row, Col, Modal } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork, getAllTokenizedRealEstates } from '../utils/interact';

const UserDashboard = ({ walletAddress, chainId }) => {
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenizedEstates, setTokenizedEstates] = useState([]);
  const [userTokenBalances, setUserTokenBalances] = useState({});
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedEstate, setSelectedEstate] = useState(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAmount, setSellAmount] = useState('');
  const [currentChainId, setCurrentChainId] = useState(null);

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

  const loadTokenizedEstates = async (contractInstances) => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`Loading tokenized estates for chain ID: ${contractInstances.chainId}`);
      
      const estates = await getAllTokenizedRealEstates(contractInstances.signer);
      const balances = {};
      
      for (const estate of estates) {
        try {
          const tokenContract = new ethers.Contract(
            estate.address,
            ['function balanceOf(address owner) view returns (uint256)', 'function allowance(address owner, address spender) view returns (uint256)'],
            contractInstances.signer
          );
          
          const balance = await tokenContract.balanceOf(walletAddress);
          balances[estate.address] = balance;
          
          const allowance = await tokenContract.allowance(walletAddress, contractInstances.realEstateRegistry.address);
          
          estate.balance = balance;
          estate.allowance = allowance;
          estate.tokenPrice = ethers.utils.parseEther('0.01'); 
          
          // Calculate tokens available (30% of total supply) - properly convert to BigNumber
          const totalSupplyBN = ethers.BigNumber.from(estate.totalSupply);
          estate.tokensAvailable = totalSupplyBN.mul(30).div(100); // 30% of total supply
        } catch (error) {
          console.error(`Error fetching balance for token ${estate.address}:`, error);
        }
      }
      
      setTokenizedEstates(estates);
      setUserTokenBalances(balances);
    } catch (error) {
      console.error('Error loading tokenized estates:', error);
      setError(`Error loading tokenized estates: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyTokens = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry || !selectedEstate) {
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
      
      // Calculate total cost (buyAmount * tokenPrice)
      const totalCost = buyAmountWei.mul(selectedEstate.tokenPrice).div(ethers.utils.parseEther('1'));
      
      // Buy tokens
      const tx = await contracts.realEstateRegistry.buyTokens(
        selectedEstate.id,
        buyAmountWei,
        { value: totalCost }
      );
      
      await tx.wait();
      
      setSuccess(`Successfully purchased ${buyAmount} ${selectedEstate.symbol} tokens!`);
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
    if (!contracts || !contracts.realEstateRegistry || !selectedEstate) {
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
      
      // Check if allowance is needed
      if (selectedEstate.allowance.lt(sellAmountWei)) {
        // Create token contract instance
        const tokenContract = new ethers.Contract(
          selectedEstate.address, 
          ['function approve(address spender, uint256 amount) public returns (bool)'],
          contracts.signer
        );
        
        console.log(`Approving tokens for sale: ${sellAmountWei.toString()} to ${contracts.realEstateRegistry.address}`);
        
        // Approve tokens
        const approveTx = await tokenContract.approve(
          contracts.realEstateRegistry.address,
          ethers.constants.MaxUint256 
        );
        
        await approveTx.wait();
        console.log('Approval transaction complete');
      }
      
      console.log(`Selling tokens: ${sellAmountWei.toString()} of token ID ${selectedEstate.id}`);
      
      // Sell tokens
      const tx = await contracts.realEstateRegistry.sellTokens(
        selectedEstate.id,
        sellAmountWei
      );
      
      await tx.wait();
      
      setSuccess(`Successfully sold ${sellAmount} ${selectedEstate.symbol} tokens!`);
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
              <Card>
                <Card.Body>
                  <Card.Title>{estate.name} ({estate.symbol})</Card.Title>
                  <Table responsive bordered size="sm">
                    <tbody>
                      <tr>
                        <th>Total Supply</th>
                        <td>{estate.totalSupply ? ethers.utils.formatEther(estate.totalSupply) : '0'}</td>
                      </tr>
                      <tr>
                        <th>Your Balance</th>
                        <td>{estate.balance ? ethers.utils.formatEther(estate.balance) : '0'}</td>
                      </tr>
                      <tr>
                        <th>Token Price</th>
                        <td>{estate.tokenPrice ? ethers.utils.formatEther(estate.tokenPrice) : '0'} ETH</td>
                      </tr>
                      <tr>
                        <th>Available</th>
                        <td>{estate.tokensAvailable ? ethers.utils.formatEther(estate.tokensAvailable) : '0'}</td>
                      </tr>
                    </tbody>
                  </Table>
                  
                  <div className="d-flex justify-content-between mt-3">
                    <Button 
                      variant="success" 
                      onClick={() => {
                        setSelectedEstate(estate);
                        setShowBuyModal(true);
                      }}
                      disabled={!estate.tokensAvailable || estate.tokensAvailable.isZero()}
                    >
                      Buy Tokens
                    </Button>
                    
                    <Button 
                      variant="warning" 
                      onClick={() => {
                        setSelectedEstate(estate);
                        setShowSellModal(true);
                      }}
                      disabled={!estate.balance || estate.balance.isZero()}
                    >
                      Sell Tokens
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      
      <div className="d-flex justify-content-between align-items-center mt-4">
        <h2>Network Switcher</h2>
        <div>
          <Button 
            variant={currentChainId === 11155111 ? "primary" : "outline-primary"} 
            className="me-2"
            onClick={() => handleNetworkSwitch(11155111)}
            disabled={loading || currentChainId === 11155111}
          >
            Ethereum Sepolia
          </Button>
          <Button 
            variant={currentChainId === 43113 ? "primary" : "outline-primary"}
            onClick={() => handleNetworkSwitch(43113)}
            disabled={loading || currentChainId === 43113}
          >
            Avalanche Fuji
          </Button>
        </div>
      </div>
      
      {/* Buy Modal */}
      <Modal show={showBuyModal} onHide={() => setShowBuyModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Buy {selectedEstate?.symbol} Tokens</Modal.Title>
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
              />
              <Form.Text className="text-muted">
                Available: {selectedEstate && selectedEstate.tokensAvailable ? 
                  ethers.utils.formatEther(selectedEstate.tokensAvailable) : '0'} tokens
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Total Cost</Form.Label>
              <Form.Control 
                type="text" 
                value={buyAmount && selectedEstate && selectedEstate.tokenPrice ? 
                  `${parseFloat(buyAmount) * parseFloat(ethers.utils.formatEther(selectedEstate.tokenPrice))} ETH` : 
                  '0 ETH'
                } 
                disabled
              />
            </Form.Group>
            
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowBuyModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Buy Tokens'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      
      {/* Sell Modal */}
      <Modal show={showSellModal} onHide={() => setShowSellModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Sell {selectedEstate?.symbol} Tokens</Modal.Title>
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
              />
              <Form.Text className="text-muted">
                Your Balance: {selectedEstate && selectedEstate.balance ? 
                  ethers.utils.formatEther(selectedEstate.balance) : '0'} tokens
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Expected Return</Form.Label>
              <Form.Control 
                type="text" 
                value={sellAmount && selectedEstate && selectedEstate.tokenPrice ? 
                  `${parseFloat(sellAmount) * parseFloat(ethers.utils.formatEther(selectedEstate.tokenPrice))} ETH` : 
                  '0 ETH'
                } 
                disabled
              />
            </Form.Group>
            
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowSellModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Sell Tokens'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default UserDashboard;
