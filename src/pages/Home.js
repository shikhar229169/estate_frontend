import React, { useState } from 'react';
import { Card, Button, Row, Col, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { adminLogin, nodeOperatorLogin, getEstateOwnerByAddress } from '../utils/api';
import { switchNetwork } from '../utils/interact';

const Home = ({ walletAddress, connectWalletPressed, setRole, role }) => {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [activeForm, setActiveForm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData({ ...loginData, [name]: value });
  };

  const handleRoleSelect = async (selectedRole) => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (selectedRole === 'estate-owner') {
      try {
        setLoading(true);
        
        // Check if user is already registered as an estate owner
        try {
          const estateOwnerData = await getEstateOwnerByAddress(walletAddress);
          const estateOwnerEthAddress = estateOwnerData?.data?.user?.ethAddress

          if (estateOwnerEthAddress) {
            if (estateOwnerEthAddress !== walletAddress.toLowerCase()) {
              setError('Wallet address does not match the registered estate owner address');
              setLoading(false);
              return;
            }

            // Already an estate owner, redirect to dashboard
            setRole('estate-owner');
            localStorage.setItem('userRole', 'estate-owner');
            navigate('/dashboard/estate-owner');
            return;
          }
        } catch (error) {
          console.log('Not registered as an estate owner yet');
        }
        
        // Not an estate owner, redirect to signup page
        navigate('/estate-owner-signup');
      } catch (error) {
        console.error('Error checking estate owner status:', error);
        setError('Error checking estate owner status. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setActiveForm(selectedRole);
    setError('');
    setSuccess('');
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      const data = await adminLogin(loginData.email, loginData.password);
      console.log(data.data.user.ethAddress);
      
      if (data.data.user.ethAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        setError('Wallet address does not match the registered admin address');
        setLoading(false);
        return;
      }
      
      localStorage.setItem('token', data.token);
      setRole('admin');
      setSuccess('Login successful! Redirecting...');
      
      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (error) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeOperatorLogin = async (e) => {
    e.preventDefault();
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      const data = await nodeOperatorLogin(loginData.email, loginData.password);
      
      const nodeOperator = data.data.user;
      
      if (nodeOperator.ethAddress && nodeOperator.ethAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        setError('Wallet address does not match the registered node operator address');
        setLoading(false);
        return;
      }

      // const ensName = nodeOperator.ensName;
      // const vaultAddress = nodeOperator.vaultAddress;
      // const collateralToken = nodeOperator.paymentToken;
      // const status = nodeOperator.isApproved ? "Approved" : "Not Approved";
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('nodeOperatorId', nodeOperator._id);
      setRole('node-operator');
      setSuccess('Login successful! Redirecting...');
      
      setTimeout(() => {
        navigate('/dashboard/node-operator');
      }, 1500);
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUserDashboard = () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    setRole('user');
    navigate('/dashboard/user');
  };

  const renderForm = () => {
    switch (activeForm) {
      case 'admin':
        return (
          <Card>
            <Card.Header>Admin Login</Card.Header>
            <Card.Body>
              <Form onSubmit={handleAdminLogin}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={loginData.email}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={loginData.password}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        );
        
      case 'node-operator':
        return (
          <Card>
            <Card.Header>Node Operator Login</Card.Header>
            <Card.Body>
              <Form onSubmit={handleNodeOperatorLogin}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={loginData.email}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={loginData.password}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="home-container">
      {!walletAddress && (
        <div className="welcome-banner">
          <h2>Welcome to Real Estate Tokenization Platform</h2>
          <p>Connect your wallet to explore tokenized real estate investments, manage properties, and earn rewards through blockchain technology.</p>
          <Button variant="primary" size="lg" onClick={connectWalletPressed} className="connect-wallet-btn">
            Connect Wallet
          </Button>
        </div>
      )}
      
      <h1 className={walletAddress ? "" : "mt-4"}>Real Estate Tokenization Platform</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      {walletAddress && !activeForm && !role && (
        <Row className="mb-4">
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <Card.Title>Admin</Card.Title>
                <Card.Text>
                  Manage the platform, approve operators, and configure contract settings.
                </Card.Text>
                <Button 
                  variant="primary" 
                  className="mt-auto"
                  onClick={() => handleRoleSelect('admin')}
                >
                  Login as Admin
                </Button>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <Card.Title>Node Operator</Card.Title>
                <Card.Text>
                  Register your vault, verify estate owners, and manage the verification process.
                </Card.Text>
                <Button 
                  variant="primary" 
                  className="mt-auto"
                  onClick={() => handleRoleSelect('node-operator')}
                >
                  Login as Node Operator
                </Button>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <Card.Title>Estate Owner</Card.Title>
                <Card.Text>
                  Register your real estate, get verified, and tokenize your property.
                </Card.Text>
                <Button 
                  variant="primary" 
                  className="mt-auto"
                  onClick={() => handleRoleSelect('estate-owner')}
                  disabled={loading}
                >
                  {loading ? 'Checking...' : 'Open Real Estate'}
                </Button>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={3}>
            <Card className="h-100">
              <Card.Body className="d-flex flex-column">
                <Card.Title>User</Card.Title>
                <Card.Text>
                  Browse tokenized properties, invest in real estate tokens, and manage your portfolio.
                </Card.Text>
                <Button 
                  variant="primary" 
                  className="mt-auto"
                  onClick={handleUserDashboard}
                >
                  Continue as User
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      
      {activeForm && (
        <div className="form-login">
          {renderForm()}
        </div>
      )}
      
      {walletAddress && activeForm && (
        <div className="text-center mt-3 back-link">
          <Button variant="link" onClick={() => setActiveForm('')}>
            ← Back to Role Selection
          </Button>
        </div>
      )}
      
      <div className="supported-chains">
        <h3>Supported Chains</h3>
        <Row>
          <Col md={6}>
            <Card className="chain-card">
              <Card.Body>
                <Card.Title>
                  <span className="chain-icon me-2">🔴</span>
                  Avalanche Fuji Testnet
                </Card.Title>
                <Card.Text>
                  Chain ID: 43113 - Fast transactions with low gas fees, perfect for real estate tokenization.
                </Card.Text>
                <Button 
                  variant="outline-primary"
                  onClick={() => switchNetwork(43113)}
                >
                  Switch to Fuji
                </Button>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={6}>
            <Card className="chain-card">
              <Card.Body>
                <Card.Title>
                  <span className="chain-icon me-2">🔵</span>
                  Ethereum Sepolia Testnet
                </Card.Title>
                <Card.Text>
                  Chain ID: 11155111 - Ethereum's testnet with broad developer support and robust security.
                </Card.Text>
                <Button 
                  variant="outline-primary"
                  onClick={() => switchNetwork(11155111)}
                >
                  Switch to Sepolia
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Home;
