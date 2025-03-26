import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Components
import Navigation from './components/Navigation';

// Pages
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import NodeOperatorDashboard from './pages/NodeOperatorDashboard';
import NodeOperatorSignup from './pages/NodeOperatorSignup';
import EstateOwnerDashboard from './pages/EstateOwnerDashboard';
import EstateOwnerSignup from './pages/EstateOwnerSignup';
import UserDashboard from './pages/UserDashboard';

// Utils
import { connectWallet, getCurrentWalletConnected, getChainId } from './utils/interact';

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState(null);
  const [role, setRole] = useState('');

  useEffect(() => {
    const init = async () => {
      // Check if wallet is already connected
      const { address, status } = await getCurrentWalletConnected();
      setWalletAddress(address);
      
      // Get chain ID
      const chainId = await getChainId();
      setChainId(chainId);
      
      // Check if role is stored in localStorage
      const storedRole = localStorage.getItem('userRole');
      if (storedRole) {
        setRole(storedRole);
      }
      
      // Add wallet event listeners
      addWalletListener();
    };
    
    init();
  }, []);

  const connectWalletPressed = async () => {
    const { address, status } = await connectWallet();
    setWalletAddress(address);
    
    // Get chain ID after connecting
    const chainId = await getChainId();
    setChainId(chainId);
  };

  const addWalletListener = () => {
    if (window.ethereum) {
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress('');
          setRole('');
          localStorage.removeItem('userRole');
          localStorage.removeItem('token');
        }
      });
      
      // Listen for chain changes
      window.ethereum.on('chainChanged', async () => {
        const chainId = await getChainId();
        setChainId(chainId);
      });
    }
  };

  // Update localStorage when role changes
  useEffect(() => {
    if (role) {
      localStorage.setItem('userRole', role);
    }
  }, [role]);

  return (
    <Router>
      <div className="App">
        <Navigation 
          walletAddress={walletAddress} 
          connectWalletPressed={connectWalletPressed} 
          chainId={chainId}
          role={role}
        />
        <Container className="py-4">
          <Routes>
            <Route 
              path="/" 
              element={
                <Home 
                  walletAddress={walletAddress} 
                  connectWalletPressed={connectWalletPressed}
                  setRole={setRole}
                  role={role}
                />
              } 
            />
            <Route 
              path="/dashboard/admin" 
              element={
                role === 'admin' ? (
                  <AdminDashboard 
                    walletAddress={walletAddress} 
                    chainId={chainId} 
                  />
                ) : (
                  <Navigate to="/" />
                )
              } 
            />
            <Route 
              path="/dashboard/node-operator" 
              element={
                role === 'node-operator' ? (
                  <NodeOperatorDashboard 
                    walletAddress={walletAddress} 
                    chainId={chainId} 
                  />
                ) : (
                  <Navigate to="/" />
                )
              } 
            />
            <Route 
              path="/node-operator-signup" 
              element={
                <NodeOperatorSignup 
                  walletAddress={walletAddress}
                  chainId={chainId}
                  setRole={setRole}
                />
              } 
            />
            <Route 
              path="/estate-owner-signup" 
              element={
                <EstateOwnerSignup 
                  walletAddress={walletAddress}
                  chainId={chainId}
                  setRole={setRole}
                />
              } 
            />
            <Route 
              path="/dashboard/estate-owner" 
              element={
                role === 'estate-owner' ? (
                  <EstateOwnerDashboard 
                    walletAddress={walletAddress} 
                    chainId={chainId} 
                  />
                ) : (
                  <Navigate to="/" />
                )
              } 
            />
            <Route 
              path="/dashboard/user" 
              element={
                <UserDashboard 
                  walletAddress={walletAddress} 
                  chainId={chainId} 
                />
              } 
            />
          </Routes>
        </Container>
      </div>
    </Router>
  );
}

export default App;
