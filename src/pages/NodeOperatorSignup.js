import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, getCurrentWalletConnected } from '../utils/interact';
import { checkNodeOperatorExists, registerNodeOperatorWithBlockchain } from '../utils/api';

const NodeOperatorSignup = ({ setRole }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [chainId, setChainId] = useState(null);
  const [contracts, setContracts] = useState(null);
  
  // Form state
  const [ensName, setEnsName] = useState('');
  const [paymentToken, setPaymentToken] = useState('');
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Get connected wallet
        const { address, status } = await getCurrentWalletConnected();
        console.log("Wallet connection status:", status, "Address:", address);
        
        if (status !== 'success' || !address) {
          console.log("Wallet not connected properly");
          setError('Please connect your wallet to continue');
          setLoading(false);
          return;
        }
        
        setWalletAddress(address);
        
        // Get chain ID and contracts
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const network = await provider.getNetwork();
          setChainId(network.chainId);
          
          // Get contract instances
          const contractInstances = getContracts(network.chainId);
          setContracts(contractInstances);
          
          if (contractInstances && !contractInstances.error) {
            try {
              // Check if wallet is already registered in the blockchain
              const operatorInfo = await contractInstances.realEstateRegistry.getOperatorInfo(address);
              
              // If vault address is not zero, operator is registered in blockchain
              console.log(operatorInfo.vault)
              if (operatorInfo && operatorInfo.vault !== ethers.constants.AddressZero) {
                setIsRegistered(true);
                
                // Also check if registered in our backend
                try {
                  const backendCheckResult = await checkNodeOperatorExists(address);
                  
                  if (backendCheckResult.exists) {
                    // User is registered in both blockchain and backend
                    console.log('Node operator is registered in both blockchain and backend');
                    
                    // Set role if provided
                    if (setRole) {
                      setRole('node-operator');
                      localStorage.setItem('userRole', 'node-operator');
                    }
                    
                    // Redirect to dashboard after a short delay
                    setTimeout(() => {
                      window.location.href = '/dashboard/node-operator';
                    }, 2000);
                  } else {
                    // User is registered in blockchain but not in backend
                    // We'll let them complete the signup form
                    setEnsName(operatorInfo.ensName || '');
                    setPaymentToken(operatorInfo.paymentToken || 'ETH');
                    setAutoUpdateEnabled(operatorInfo.autoUpdateEnabled || false);
                    console.log('Node operator is registered in blockchain but not in backend');
                  }
                } catch (error) {
                  console.error('Error checking backend registration:', error);
                }
              } else {
                setIsRegistered(false);
              }
            } catch (error) {
              console.error('Error checking blockchain registration:', error);
              setError('Error checking blockchain registration: ' + error.message);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing:', error);
        setError('Error initializing: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    init();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          window.location.reload();
        } else {
          setWalletAddress('');
        }
      });
      
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [setRole]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Validate form
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      
      if (!ensName || !paymentToken || !username || !password || !name || !email) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }
      
      // Generate a signature (this is a placeholder - in a real app, you'd sign a message)
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(`I am registering as a node operator with ENS name: ${ensName}`);
      
      // Register in the backend
      const signupData = {
        name,
        email,
        password,
        ethAddress: walletAddress,
        ensName,
        paymentToken,
        autoUpdateEnabled,
        signature
      };
      
      const response = await registerNodeOperatorWithBlockchain(signupData);
      
      // Set success message
      setSuccess('Successfully registered as a node operator! Redirecting to dashboard...');
      
      // Set role if provided
      if (setRole) {
        setRole('node-operator');
        localStorage.setItem('userRole', 'node-operator');
        localStorage.setItem('token', response.token);
      }
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard/node-operator';
      }, 2000);
    } catch (error) {
      console.error('Error registering:', error);
      setError('Error registering: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // If wallet is not connected
  if (!walletAddress) {
    return (
      <Container className="mt-5">
        <Card>
          <Card.Body className="text-center">
            <Card.Title>Node Operator Registration</Card.Title>
            <Card.Text>Please connect your wallet to continue</Card.Text>
            <Button 
              variant="primary" 
              onClick={async () => {
                try {
                  // Request account access
                  if (window.ethereum) {
                    const accounts = await window.ethereum.request({ 
                      method: 'eth_requestAccounts' 
                    });
                    if (accounts.length > 0) {
                      setWalletAddress(accounts[0]);
                      window.location.reload(); // Reload to reinitialize
                    }
                  } else {
                    alert('Please install MetaMask or another Ethereum wallet provider');
                  }
                } catch (error) {
                  console.error("Error connecting wallet:", error);
                  setError('Error connecting wallet: ' + error.message);
                }
              }}
            >
              Connect Wallet
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }
  
  // If loading
  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Checking registration status...</p>
      </Container>
    );
  }
  
  // If already registered
  if (isRegistered) {
    return (
      <Container className="mt-5">
        <Card>
          <Card.Body className="text-center">
            <Card.Title>Welcome, Node Operator!</Card.Title>
            <Card.Text>
              You are already registered as a node operator.
              Redirecting to your dashboard...
            </Card.Text>
            <Button 
              variant="primary" 
              onClick={() => window.location.href = '/dashboard/node-operator'}
            >
              Go to Dashboard
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }
  
  // Signup form
  return (
    <Container className="mt-5">
      <Card>
        <Card.Body>
          <Card.Title className="text-center mb-4">Node Operator Registration</Card.Title>
          
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Connected Wallet Address</Form.Label>
              <Form.Control
                type="text"
                value={walletAddress}
                disabled
              />
              <Form.Text className="text-muted">
                This address will be registered as a node operator
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Full Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Email Address *</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>ENS Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="your-name.eth"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                Your Ethereum Name Service identifier
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Payment Token *</Form.Label>
              <Form.Control
                as="select"
                value={paymentToken}
                onChange={(e) => setPaymentToken(e.target.value)}
                required
              >
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
                <option value="DAI">DAI</option>
              </Form.Control>
              <Form.Text className="text-muted">
                Token you want to receive payments in
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Enable automatic updates"
                checked={autoUpdateEnabled}
                onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
              />
              <Form.Text className="text-muted">
                Allow the system to automatically update your node
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Username *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Password *</Form.Label>
              <Form.Control
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <Form.Text className="text-muted">
                Password must be at least 8 characters
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label>Confirm Password *</Form.Label>
              <Form.Control
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </Form.Group>
            
            <div className="d-grid">
              <Button 
                variant="primary" 
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Registering...
                  </>
                ) : (
                  'Register as Node Operator'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default NodeOperatorSignup;
