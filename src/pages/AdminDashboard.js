import React, { useState, useEffect } from 'react';
import { Tab, Tabs, Card, Form, Button, Table, Alert, Spinner } from 'react-bootstrap';
import { ethers } from 'ethers';
import { getContracts, switchNetwork } from '../utils/interact';
import { getAllNodeOperators, updateNodeOperator } from '../utils/api';
// Import FontAwesome icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUserShield, faCheckCircle, faTimesCircle, faClockRotateLeft,
  faHome, faCoins, faExchangeAlt, faNetworkWired, faTools,
  faShieldAlt, faExclamationTriangle, faCog, faPlug, faServer,
  faChain, faPowerOff, faWrench, faUnlockAlt, faDatabase
} from '@fortawesome/free-solid-svg-icons';

const AdminDashboard = ({ walletAddress, chainId }) => {
  const [activeTab, setActiveTab] = useState('approveOperator');
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nodeOperators, setNodeOperators] = useState([]);
  const [operators, setOperators] = useState([]);
  
  // Statistics
  const [stats, setStats] = useState({
    totalOperators: 0,
    approvedOperators: 0,
    pendingOperators: 0,
    tokenizedEstates: 0
  });
  
  // Form states for various admin functions
  const [tokenForAnotherChainForm, setTokenForAnotherChainForm] = useState({
    baseAcceptedToken: '',
    chainId: '',
    tokenOnChain: ''
  });
  
  const [collateralTokenForm, setCollateralTokenForm] = useState({
    newToken: '',
    dataFeed: ''
  });
  
  const [vovImplementationForm, setVovImplementationForm] = useState({
    newImplementation: ''
  });
  
  const [swapRouterForm, setSwapRouterForm] = useState({
    newRouter: ''
  });
  
  const [forceUpdateForm, setForceUpdateForm] = useState({
    operatorVaultEns: ''
  });
  
  const [slashOperatorForm, setSlashOperatorForm] = useState({
    operatorVaultEns: '',
  });
  
  const [emergencyWithdrawForm, setEmergencyWithdrawForm] = useState({
    token: ''
  });
  
  const [allowlistManagerForm, setAllowlistManagerForm] = useState({
    chainSelector: '',
    manager: ''
  });

  useEffect(() => {
    const loadContracts = async () => {
      if (walletAddress && chainId) {
        const contractInstances = getContracts(chainId);
        if (contractInstances && !contractInstances.error) {
          setContracts(contractInstances);
          
          // Load operators from RealEstateRegistry
          try {
            const allOperators = await contractInstances.realEstateRegistry.getAllOperators();
            setOperators(allOperators);
          } catch (error) {
            console.error('Error loading operators:', error);
          }
        } else if (contractInstances && contractInstances.error) {
          setError(contractInstances.error);
        }
      }
    };
    
    const loadNodeOperators = async () => {
      try {
        const data = await getAllNodeOperators();
        const nodes = data.data.nodes || [];
        setNodeOperators(nodes);
        
        // Update stats
        const approvedCount = nodes.filter(node => node.isApproved).length;
        setStats({
          totalOperators: nodes.length,
          approvedOperators: approvedCount,
          pendingOperators: nodes.length - approvedCount,
          tokenizedEstates: Math.floor(Math.random() * 10) // Just a placeholder, replace with actual data
        });
        
      } catch (error) {
        console.error('Error loading node operators:', error);
      }
    };
    
    loadContracts();
    loadNodeOperators();
  }, [walletAddress, chainId]);

  const handleInputChange = (e, formSetter) => {
    const { name, value } = e.target;
    formSetter(prev => ({ ...prev, [name]: value }));
  };

  const handleSetTokenForAnotherChain = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.setTokenForAnotherChain(
        tokenForAnotherChainForm.baseAcceptedToken,
        tokenForAnotherChainForm.chainId,
        tokenForAnotherChainForm.tokenOnChain
      );
      
      await tx.wait();
      setSuccess('Token for another chain set successfully!');
      setTokenForAnotherChainForm({
        baseAcceptedToken: '',
        chainId: '',
        tokenOnChain: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollateralToken = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log(contracts.realEstateRegistry);
      const tx = await contracts.realEstateRegistry.addCollateralToken(
        collateralTokenForm.newToken,
        collateralTokenForm.dataFeed
      );
      
      await tx.wait();
      setSuccess('Collateral token added successfully!');
      setCollateralTokenForm({
        newToken: '',
        dataFeed: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVOVImplementation = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.updateVOVImplementation(
        vovImplementationForm.newImplementation
      );
      
      await tx.wait();
      setSuccess('VOV implementation updated successfully!');
      setVovImplementationForm({
        newImplementation: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetSwapRouter = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.setSwapRouter(
        swapRouterForm.newRouter
      );
      
      await tx.wait();
      setSuccess('Swap router set successfully!');
      setSwapRouterForm({
        newRouter: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOperatorVault = async (operatorVaultEns) => {
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.approveOperatorVault(operatorVaultEns);
      await tx.wait();
      setSuccess(`Operator vault ${operatorVaultEns} approved successfully!`);
      
      // Update node operator status in backend
      const nodeOperator = nodeOperators.find(node => node.ensName === operatorVaultEns);
      if (nodeOperator) {
        try {
          await updateNodeOperator(nodeOperator._id, { isApproved: true });
          // Update local state
          setNodeOperators(prev => 
            prev.map(node => 
              node.ensName === operatorVaultEns 
                ? { ...node, isApproved: true } 
                : node
            )
          );
        } catch (error) {
          console.error('Failed to update node operator status in backend:', error);
        }
      }
    } catch (error) {
      setError(`Error: Invalid ENS Name`);
    } finally {
      setLoading(false);
    }
  };

  const handleForceUpdateOperatorVault = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.forceUpdateOperatorVault(
        forceUpdateForm.operatorVaultEns
      );
      
      await tx.wait();
      setSuccess('Operator vault force updated successfully!');
      setForceUpdateForm({
        operatorVaultEns: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSlashOperatorVault = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.slashOperatorVault(
        slashOperatorForm.operatorVaultEns,
      );
      
      await tx.wait();
      setSuccess('Operator vault slashed successfully!');

      // Update node operator status in backend
      const nodeOperator = nodeOperators.find(node => node.ensName === slashOperatorForm.operatorVaultEns);
      if (nodeOperator) {
        try {
          await updateNodeOperator(nodeOperator._id, { isApproved: false });
          // Update local state
          setNodeOperators(prev => 
            prev.map(node => 
              node.ensName === slashOperatorForm.operatorVaultEns 
                ? { ...node, isApproved: false } 
                : node
            )
          );
        } catch (error) {
          console.error('Failed to update node operator status in backend:', error);
        }
      }

      setSlashOperatorForm({
        operatorVaultEns: '',
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyWithdrawToken = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.realEstateRegistry) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.realEstateRegistry.emergencyWithdrawToken(
        emergencyWithdrawForm.token
      );
      
      await tx.wait();
      setSuccess('Emergency token withdrawal successful!');
      setEmergencyWithdrawForm({
        token: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAllowlistManager = async (e) => {
    e.preventDefault();
    if (!contracts || !contracts.assetTokenizationManager) {
      setError('Contracts not loaded');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const tx = await contracts.assetTokenizationManager.allowlistManager(
        allowlistManagerForm.chainSelector,
        allowlistManagerForm.manager
      );
      
      await tx.wait();
      setSuccess('Manager allowlisted successfully!');
      setAllowlistManagerForm({
        chainSelector: '',
        manager: ''
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="text-center">
        <h2>Please connect your wallet to access the Admin Dashboard</h2>
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

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      
      {error && <Alert variant="danger">
        <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
        {error}
      </Alert>}
      
      {success && <Alert variant="success">
        <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
        {success}
      </Alert>}
      
      {loading && (
        <div className="text-center mb-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}
      
      {/* Statistics Row */}
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-operators">
            <FontAwesomeIcon icon={faUserShield} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalOperators}</span>
            <span className="stat-label">Total Operators</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-approved">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.approvedOperators}</span>
            <span className="stat-label">Approved Operators</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-pending">
            <FontAwesomeIcon icon={faClockRotateLeft} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.pendingOperators}</span>
            <span className="stat-label">Pending Approval</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-estates">
            <FontAwesomeIcon icon={faHome} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.tokenizedEstates}</span>
            <span className="stat-label">Tokenized Estates</span>
          </div>
        </div>
      </div>
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="approveOperator" title={
          <span><FontAwesomeIcon icon={faUserShield} className="me-2" />Approve Operators</span>
        }>
          <Card className="operators-table">
            <Card.Body>
              <h4>
                <FontAwesomeIcon icon={faUserShield} className="me-2" style={{ color: '#3498db' }} />
                Node Operators
              </h4>
              <Table responsive striped bordered hover className="mt-4">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ENS Name</th>
                    <th>ETH Address</th>
                    <th>Vault Address</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nodeOperators.map((node, index) => (
                    <tr key={index}>
                      <td>{node.name}</td>
                      <td>{node.ensName}</td>
                      <td>
                        <span className="eth-address">{node.ethAddress}</span>
                      </td>
                      <td>
                        {node.vaultAddress ? 
                          <span className="eth-address">{node.vaultAddress}</span> : 
                          'Not registered'
                        }
                      </td>
                      <td>
                        {node.isApproved ? 
                          <span className="badge badge-approved">
                            <FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Approved
                          </span> : 
                          <span className="badge badge-pending">
                            <FontAwesomeIcon icon={faClockRotateLeft} className="me-1" /> Pending
                          </span>
                        }
                      </td>
                      <td className="text-center">
                        {!node.isApproved && node.ensName && (
                          <Button 
                            variant="success" 
                            size="sm"
                            onClick={() => handleApproveOperatorVault(node.ensName)}
                            disabled={loading}
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {nodeOperators.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-4">No node operators found</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="tokenConfig" title={
          <span><FontAwesomeIcon icon={faCoins} className="me-2" />Token Configuration</span>
        }>
          <Card className="token-card">
            <Card.Header>
              <h4><FontAwesomeIcon icon={faExchangeAlt} className="me-2" style={{ color: '#f1c40f' }} /> Set Token For Another Chain</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSetTokenForAnotherChain}>
                <Form.Group className="mb-3">
                  <Form.Label>Base Accepted Token</Form.Label>
                  <Form.Control
                    type="text"
                    name="baseAcceptedToken"
                    value={tokenForAnotherChainForm.baseAcceptedToken}
                    onChange={(e) => handleInputChange(e, setTokenForAnotherChainForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Chain ID</Form.Label>
                  <Form.Control
                    type="number"
                    name="chainId"
                    value={tokenForAnotherChainForm.chainId}
                    onChange={(e) => handleInputChange(e, setTokenForAnotherChainForm)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Token On Chain</Form.Label>
                  <Form.Control
                    type="text"
                    name="tokenOnChain"
                    value={tokenForAnotherChainForm.tokenOnChain}
                    onChange={(e) => handleInputChange(e, setTokenForAnotherChainForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faChain} className="me-2" />
                  Set Token For Another Chain
                </Button>
              </Form>
              
              <hr />
              
              <h4><FontAwesomeIcon icon={faCoins} className="me-2" style={{ color: '#f1c40f' }} /> Add Collateral Token</h4>
              <Form onSubmit={handleAddCollateralToken}>
                <Form.Group className="mb-3">
                  <Form.Label>New Token</Form.Label>
                  <Form.Control
                    type="text"
                    name="newToken"
                    value={collateralTokenForm.newToken}
                    onChange={(e) => handleInputChange(e, setCollateralTokenForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Data Feed</Form.Label>
                  <Form.Control
                    type="text"
                    name="dataFeed"
                    value={collateralTokenForm.dataFeed}
                    onChange={(e) => handleInputChange(e, setCollateralTokenForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faPlug} className="me-2" />
                  Add Collateral Token
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="systemConfig" title={
          <span><FontAwesomeIcon icon={faCog} className="me-2" />System Configuration</span>
        }>
          <Card className="config-card">
            <Card.Header>
              <h4><FontAwesomeIcon icon={faTools} className="me-2" style={{ color: '#9b59b6' }} /> Update VOV Implementation</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleUpdateVOVImplementation}>
                <Form.Group className="mb-3">
                  <Form.Label>New Implementation</Form.Label>
                  <Form.Control
                    type="text"
                    name="newImplementation"
                    value={vovImplementationForm.newImplementation}
                    onChange={(e) => handleInputChange(e, setVovImplementationForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faWrench} className="me-2" />
                  Update VOV Implementation
                </Button>
              </Form>
              
              <hr />
              
              <h4><FontAwesomeIcon icon={faNetworkWired} className="me-2" style={{ color: '#9b59b6' }} /> Set Swap Router</h4>
              <Form onSubmit={handleSetSwapRouter}>
                <Form.Group className="mb-3">
                  <Form.Label>New Router</Form.Label>
                  <Form.Control
                    type="text"
                    name="newRouter"
                    value={swapRouterForm.newRouter}
                    onChange={(e) => handleInputChange(e, setSwapRouterForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faExchangeAlt} className="me-2" />
                  Set Swap Router
                </Button>
              </Form>
              
              <hr />
              
              <h4><FontAwesomeIcon icon={faShieldAlt} className="me-2" style={{ color: '#9b59b6' }} /> Allowlist Manager</h4>
              <Form onSubmit={handleAllowlistManager}>
                <Form.Group className="mb-3">
                  <Form.Label>Chain Selector</Form.Label>
                  <Form.Control
                    type="text"
                    name="chainSelector"
                    value={allowlistManagerForm.chainSelector}
                    onChange={(e) => handleInputChange(e, setAllowlistManagerForm)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Manager</Form.Label>
                  <Form.Control
                    type="text"
                    name="manager"
                    value={allowlistManagerForm.manager}
                    onChange={(e) => handleInputChange(e, setAllowlistManagerForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Button variant="primary" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faUnlockAlt} className="me-2" />
                  Allowlist Manager
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="operatorManagement" title={
          <span><FontAwesomeIcon icon={faServer} className="me-2" />Operator Management</span>
        }>
          <Card className="operator-card">
            <Card.Header>
              <h4><FontAwesomeIcon icon={faPowerOff} className="me-2" style={{ color: '#3498db' }} /> Force Update Operator Vault</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleForceUpdateOperatorVault}>
                <Form.Group className="mb-3">
                  <Form.Label>Operator Vault ENS</Form.Label>
                  <Form.Control
                    type="text"
                    name="operatorVaultEns"
                    value={forceUpdateForm.operatorVaultEns}
                    onChange={(e) => handleInputChange(e, setForceUpdateForm)}
                    required
                  />
                </Form.Group>
                
                <Button variant="warning" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faCog} className="me-2" />
                  Force Update Operator Vault
                </Button>
              </Form>
              
              <hr />
              
              <h4><FontAwesomeIcon icon={faTimesCircle} className="me-2" style={{ color: '#3498db' }} /> Slash Operator Vault</h4>
              <Form onSubmit={handleSlashOperatorVault}>
                <Form.Group className="mb-3">
                  <Form.Label>Operator Vault ENS</Form.Label>
                  <Form.Control
                    type="text"
                    name="operatorVaultEns"
                    value={slashOperatorForm.operatorVaultEns}
                    onChange={(e) => handleInputChange(e, setSlashOperatorForm)}
                    required
                  />
                </Form.Group>
                <Button variant="danger" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faTimesCircle} className="me-2" />
                  Slash Operator Vault
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="emergency" title={
          <span><FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />Emergency</span>
        }>
          <Card className="emergency-card">
            <Card.Header>
              <h4><FontAwesomeIcon icon={faExclamationTriangle} className="me-2" style={{ color: '#e74c3c' }} /> Emergency Withdraw Token</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleEmergencyWithdrawToken}>
                <Form.Group className="mb-3">
                  <Form.Label>Token</Form.Label>
                  <Form.Control
                    type="text"
                    name="token"
                    value={emergencyWithdrawForm.token}
                    onChange={(e) => handleInputChange(e, setEmergencyWithdrawForm)}
                    placeholder="0x..."
                    required
                  />
                </Form.Group>
                
                <Button variant="danger" type="submit" disabled={loading}>
                  <FontAwesomeIcon icon={faDatabase} className="me-2" />
                  Emergency Withdraw Token
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
