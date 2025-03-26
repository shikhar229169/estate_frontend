import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, getCurrentWalletConnected, approveTokens, getDecimalsFromTokenContract } from '../utils/interact';
import { registerEstateOwner, getEstateOwnerByAddress, getApprovedNodeOperators } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import addresses from '../contracts/abi/addresses';
import { PinataSDK } from "pinata";

const EstateOwnerSignup = ({ setRole }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [chainId, setChainId] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [tokenOptions, setTokenOptions] = useState([]);
  const [approvedNodeOperators, setApprovedNodeOperators] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ethAddress: '',
    country: '',
    state: '',
    address: '',
    kycType: 'passport', // Default value
    kycId: '',
    kycDocumentImage: '',
    ownershipDocumentImage: '',
    realEstateInfo: '',
    currentEstateCost: '',
    percentageToTokenize: '',
    nodeOperatorAssigned: '',
    token: ''
  });

  

  const pinata = new PinataSDK({
    pinataJwt: process.env.REACT_APP_PINATA_JWT,
    pinataGateway: "brown-evil-marlin-908.mypinata.cloud",
  });
  
  const navigate = useNavigate();
  
  useEffect(() => {
    const init = async () => {
      try {
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
        setFormData(prev => ({ ...prev, ethAddress: address }));
        
        // Get chain ID and contracts
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const network = await provider.getNetwork();
          setChainId(network.chainId);
          
          // Update token options based on chain
          updateTokenOptions(network.chainId);
          
          // Get contract instances
          const contractInstances = getContracts(network.chainId);
          setContracts(contractInstances);
          
          // Check if wallet is already registered
          try {
            const estateOwnerData = await getEstateOwnerByAddress(address);
            if (estateOwnerData && estateOwnerData.estateOwner) {
              setIsRegistered(true);
              
              // Set role if provided
              if (setRole) {
                setRole('estate-owner');
                localStorage.setItem('userRole', 'estate-owner');
              }
              
              // Redirect to dashboard
              navigate('/dashboard/estate-owner');
            }
          } catch (error) {
            console.log('Not registered as an estate owner yet');
          }
        }
        
        // Fetch approved node operators
        try {
          const response = await getApprovedNodeOperators();
          const nodes = response.data.node
          if (nodes && nodes.length > 0) {
            setApprovedNodeOperators(nodes);
          }
        } catch (error) {
          console.error('Error fetching approved node operators:', error);
        }
        
      } catch (err) {
        console.error(err);
        setError('Error connecting to wallet');
      } finally {
        setLoading(false);
      }
    };
    
    const updateTokenOptions = (chainId) => {
      const networkAddresses = addresses[chainId];
      if (networkAddresses) {
        setTokenOptions([
          { name: `Native ${chainId === 43114 ? 'AVAX' : 'ETH'}`, address: ethers.constants.AddressZero },
          { name: 'USDC', address: networkAddresses.usdc }
        ]);
        // Reset token when chain changes
        setFormData(prev => ({ ...prev, token: '' }));
      }
    };
    
    init();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setFormData(prev => ({ ...prev, ethAddress: accounts[0] }));
        } else {
          setWalletAddress('');
          setFormData(prev => ({ ...prev, ethAddress: '' }));
        }
      });
      
      window.ethereum.on('chainChanged', (chainId) => {
        const newChainId = parseInt(chainId, 16);
        setChainId(newChainId);
        updateTokenOptions(newChainId);
      });
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [setRole, navigate]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const uploadImage = async (file) => {
    const upload = await pinata.upload.public.file(file);
    return upload.cid;
  };

  const handleImageChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({ ...prev, [name]: files[0] }));
  };
  
  const handleTokenChange = (e) => {
    const selectedToken = e.target.value;
    setFormData(prev => ({ ...prev, token: selectedToken }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Validate form
      if (!formData.name || !formData.ethAddress || !formData.country || 
          !formData.state || !formData.address || !formData.kycType || 
          !formData.kycId || !formData.kycDocumentImage || !formData.ownershipDocumentImage || 
          !formData.realEstateInfo || !formData.currentEstateCost || 
          !formData.percentageToTokenize || !formData.token) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }
      
      // Randomly assign a node operator if there are approved ones
      let nodeOperatorAssigned = '';
      if (approvedNodeOperators.length > 0) {
        const randomIndex = Math.floor(Math.random() * approvedNodeOperators.length);
        nodeOperatorAssigned = approvedNodeOperators[randomIndex].ensName;
      } else {
        setError('No approved node operators available. Please try again later.');
        setLoading(false);
        return;
      }
      
      const kycDocumentCid = await uploadImage(formData.kycDocumentImage);
      const ownershipDocumentCid = await uploadImage(formData.ownershipDocumentImage);

      // Prepare data for submission
      const estateOwnerData = {
        ...formData,
        nodeOperatorAssigned,
        kycDocumentImage: `${process.env.REACT_APP_PINATA_BASE_URL}/${kycDocumentCid}`,
        ownershipDocumentImage: `${process.env.REACT_APP_PINATA_BASE_URL}/${ownershipDocumentCid}`,
        ethAddress: walletAddress // Ensure we're using the connected wallet address
      };

      let tokenDecimals = 18;
      
      // If the selected token is not the native token (address 0), approve it to the asset tokenization manager
      if (formData.token !== ethers.constants.AddressZero) {
        try {
          setSuccess('Approving token for spending...');
          
          // Get the provider and signer
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          // Get the asset tokenization manager address
          const assetTokenizationManagerAddress = contracts.assetTokenizationManager.address;
                    
          // Approve the token
          const approvalResult = await approveTokens(
            formData.token,
            assetTokenizationManagerAddress,
            ethers.constants.MaxUint256,
            signer
          );
          
          if (!approvalResult.success) {
            setError('Failed to approve token. Please try again.');
            setLoading(false);
            return;
          }

          tokenDecimals = await getDecimalsFromTokenContract(formData.token, signer);

          setSuccess('Token approved successfully! Proceeding with registration...');
        } catch (error) {
          console.error('Error approving token:', error);
          setError('Failed to approve token: ' + error.message);
          setLoading(false);
          return;
        }
      }

      const estateCostInTokenDecimals = ethers.utils.parseUnits(
        formData.currentEstateCost.toString(), 
        tokenDecimals
      ).toString();
      
      estateOwnerData.currentEstateCost = estateCostInTokenDecimals;

      // Register estate owner
      const response = await registerEstateOwner(estateOwnerData);
      
      if (response && response.status === 'success') {
        setSuccess('Estate owner registered successfully!');
        
        // Set role if provided
        if (setRole) {
          setRole('estate-owner');
          localStorage.setItem('userRole', 'estate-owner');
        }
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard/estate-owner');
        }, 2000);
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
        <Spinner animation="border" />
      </Container>
    );
  }
  
  if (isRegistered) {
    return (
      <Container className="mt-5">
        <Card>
          <Card.Body className="text-center">
            <Card.Title>Already Registered</Card.Title>
            <Card.Text>
              This wallet address is already registered as an estate owner.
            </Card.Text>
            <Button variant="primary" onClick={() => navigate('/dashboard/estate-owner')}>
              Go to Dashboard
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }
  
  return (
    <Container className="mt-5 mb-5">
      <Card>
        <Card.Body>
          <Card.Title className="text-center mb-4">Estate Owner Registration</Card.Title>
          
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Wallet Address</Form.Label>
                  <Form.Control
                    type="text"
                    value={walletAddress}
                    disabled
                    placeholder="Connect your wallet"
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Country</Form.Label>
                  <Form.Control
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Enter your country"
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>State</Form.Label>
                  <Form.Control
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="Enter your state"
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Address</Form.Label>
                  <Form.Control
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your address"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>KYC Document Type</Form.Label>
                  <Form.Select
                    name="kycType"
                    value={formData.kycType}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="passport">Passport</option>
                    <option value="drivingLicense">Driving License</option>
                    <option value="nationalId">National ID</option>
                    <option value="other">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>KYC Document ID</Form.Label>
                  <Form.Control
                    type="text"
                    name="kycId"
                    value={formData.kycId}
                    onChange={handleInputChange}
                    placeholder="Enter your document ID"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>KYC Document Image URL</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    name="kycDocumentImage"
                    // value={formData.kycDocumentImage}
                    onChange={handleImageChange}
                    placeholder="Enter URL to your KYC document image"
                    required
                  />
                  <Form.Text className="text-muted">
                    Please provide a URL to your KYC document image
                  </Form.Text>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ownership Document Image URL</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    name="ownershipDocumentImage"
                    // value={formData.ownershipDocumentImage}
                    onChange={handleImageChange}
                    placeholder="Enter URL to your ownership document image"
                    required
                  />
                  <Form.Text className="text-muted">
                    Please provide a URL to your property ownership document image
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Real Estate Information</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="realEstateInfo"
                value={formData.realEstateInfo}
                onChange={handleInputChange}
                placeholder="Provide details about your real estate property"
                required
              />
            </Form.Group>
            
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Current Estate Cost</Form.Label>
                  <Form.Control
                    type="number"
                    name="currentEstateCost"
                    value={formData.currentEstateCost}
                    onChange={handleInputChange}
                    placeholder="Enter the current value of your estate"
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Percentage to Tokenize</Form.Label>
                  <Form.Control
                    type="number"
                    name="percentageToTokenize"
                    value={formData.percentageToTokenize}
                    onChange={handleInputChange}
                    placeholder="Enter percentage (1-100)"
                    min="1"
                    max="100"
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Token</Form.Label>
                  <Form.Select
                    value={formData.token}
                    onChange={handleTokenChange}
                    required
                  >
                    <option value="">Select Token</option>
                    {tokenOptions.map((token, index) => (
                      <option key={index} value={token.address}>
                        {token.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <div className="d-grid gap-2 mt-4">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Register as Estate Owner'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default EstateOwnerSignup;
