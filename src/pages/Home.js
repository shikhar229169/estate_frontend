import React, { useState } from 'react';
import { Card, Button, Row, Col, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { adminLogin, nodeOperatorLogin, registerEstateOwner } from '../utils/api';
import { switchNetwork } from '../utils/interact';

const Home = ({ walletAddress, connectWalletPressed, setRole, role }) => {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [activeForm, setActiveForm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // For estate owner registration
  const [estateOwnerData, setEstateOwnerData] = useState({
    name: '',
    country: '',
    state: '',
    address: '',
    kycType: '',
    kycId: '',
    realEstateInfo: '',
    currentEstateCost: '',
    percentageToTokenize: '',
    signature: ''
  });
  
  // For file uploads
  const [kycDocumentImage, setKycDocumentImage] = useState(null);
  const [ownershipDocumentImage, setOwnershipDocumentImage] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData({ ...loginData, [name]: value });
  };

  const handleEstateOwnerInputChange = (e) => {
    const { name, value } = e.target;
    setEstateOwnerData({ ...estateOwnerData, [name]: value });
  };

  const handleFileChange = (e, setFile) => {
    setFile(e.target.files[0]);
  };

  const handleRoleSelect = (selectedRole) => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
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
      console.log(data)
      console.log(data.data.user.ethAddress)
      
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

  const handleEstateOwnerRegistration = async (e) => {
    e.preventDefault();
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create form data with all estate owner information
      const formData = new FormData();
      Object.keys(estateOwnerData).forEach(key => {
        formData.append(key, estateOwnerData[key]);
      });
      
      formData.append('ethAddress', walletAddress);
      
      if (kycDocumentImage) {
        formData.append('kycDocumentImage', kycDocumentImage);
      }
      
      if (ownershipDocumentImage) {
        formData.append('ownershipDocumentImage', ownershipDocumentImage);
      }
      
      // Register estate owner
      const data = await registerEstateOwner(formData);
      
      setRole('estate-owner');
      setSuccess('Registration successful! Redirecting...');
      
      setTimeout(() => {
        navigate('/estate-owner');
      }, 1500);
    } catch (error) {
      setError(error.message || 'Registration failed');
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
    navigate('/user');
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
        
      case 'estate-owner':
        return (
          <Card>
            <Card.Header>Estate Owner Registration</Card.Header>
            <Card.Body>
              <Form onSubmit={handleEstateOwnerRegistration}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        value={estateOwnerData.name}
                        onChange={handleEstateOwnerInputChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Country</Form.Label>
                      <Form.Control
                        type="text"
                        name="country"
                        value={estateOwnerData.country}
                        onChange={handleEstateOwnerInputChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>State</Form.Label>
                      <Form.Control
                        type="text"
                        name="state"
                        value={estateOwnerData.state}
                        onChange={handleEstateOwnerInputChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Address</Form.Label>
                      <Form.Control
                        type="text"
                        name="address"
                        value={estateOwnerData.address}
                        onChange={handleEstateOwnerInputChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>KYC Type</Form.Label>
                      <Form.Control
                        as="select"
                        name="kycType"
                        value={estateOwnerData.kycType}
                        onChange={handleEstateOwnerInputChange}
                        required
                      >
                        <option value="">Select KYC Type</option>
                        <option value="passport">Passport</option>
                        <option value="drivers_license">Driver's License</option>
                        <option value="national_id">National ID</option>
                      </Form.Control>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>KYC ID</Form.Label>
                      <Form.Control
                        type="text"
                        name="kycId"
                        value={estateOwnerData.kycId}
                        onChange={handleEstateOwnerInputChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>KYC Document Image</Form.Label>
                      <Form.Control
                        type="file"
                        onChange={(e) => handleFileChange(e, setKycDocumentImage)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Ownership Document Image</Form.Label>
                      <Form.Control
                        type="file"
                        onChange={(e) => handleFileChange(e, setOwnershipDocumentImage)}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Form.Group className="mb-3">
                  <Form.Label>Real Estate Information</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="realEstateInfo"
                    value={estateOwnerData.realEstateInfo}
                    onChange={handleEstateOwnerInputChange}
                    required
                  />
                </Form.Group>
                
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Current Estate Cost (in USD)</Form.Label>
                      <Form.Control
                        type="number"
                        name="currentEstateCost"
                        value={estateOwnerData.currentEstateCost}
                        onChange={handleEstateOwnerInputChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Percentage to Tokenize (0-100)</Form.Label>
                      <Form.Control
                        type="number"
                        name="percentageToTokenize"
                        value={estateOwnerData.percentageToTokenize}
                        onChange={handleEstateOwnerInputChange}
                        min="0"
                        max="100"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Form.Group className="mb-3">
                  <Form.Label>Signature (Sign a message with your wallet)</Form.Label>
                  <Form.Control
                    type="text"
                    name="signature"
                    value={estateOwnerData.signature}
                    onChange={handleEstateOwnerInputChange}
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Registering...' : 'Register'}
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
      <h1 className="text-center mb-4">Real Estate Tokenization Platform</h1>
      
      {!walletAddress && (
        <div className="text-center mb-4">
          <Button variant="primary" size="lg" onClick={connectWalletPressed}>
            Connect Wallet
          </Button>
        </div>
      )}
      
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
                >
                  Register as Estate Owner
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
      
      {activeForm && renderForm()}
      
      {walletAddress && activeForm && (
        <div className="text-center mt-3">
          <Button variant="link" onClick={() => setActiveForm('')}>
            Back to Role Selection
          </Button>
        </div>
      )}
      
      <div className="mt-5">
        <h3>Supported Chains</h3>
        <Row>
          <Col md={6}>
            <Card>
              <Card.Body>
                <Card.Title>Avalanche Fuji Testnet</Card.Title>
                <Card.Text>
                  Chain ID: 43113
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
            <Card>
              <Card.Body>
                <Card.Title>Ethereum Sepolia Testnet</Card.Title>
                <Card.Text>
                  Chain ID: 11155111
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
