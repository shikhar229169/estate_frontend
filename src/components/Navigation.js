import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { formatAddress, getChainName } from '../utils/interact';

const Navigation = ({ walletAddress, connectWalletPressed, chainId, role }) => {
  const location = useLocation();
  
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <Navbar bg="light" expand="lg" className="custom-navbar">
      <Container>
        <Navbar.Brand as={Link} to="/" className="brand-logo">
          <span className="brand-icon">🏠</span> Real Estate Tokenization
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" className={location.pathname === '/' ? 'active' : ''}>
              Home
            </Nav.Link>
            
            {role === 'admin' && (
              <Nav.Link as={Link} to="/dashboard/admin" className={location.pathname === '/dashboard/admin' ? 'active' : ''}>
                Admin Dashboard
              </Nav.Link>
            )}
            
            {role === 'node-operator' && (
              <Nav.Link as={Link} to="/dashboard/node-operator" className={location.pathname === '/dashboard/node-operator' ? 'active' : ''}>
                Node Operator Dashboard
              </Nav.Link>
            )}
            
            {!role && walletAddress && (
              <Nav.Link as={Link} to="/node-operator-signup" className={location.pathname === '/node-operator-signup' ? 'active' : ''}>
                Become a Node Operator
              </Nav.Link>
            )}
            
            {role === 'estate-owner' && (
              <Nav.Link as={Link} to="/dashboard/estate-owner" className={location.pathname === '/dashboard/estate-owner' ? 'active' : ''}>
                Estate Owner Dashboard
              </Nav.Link>
            )}
            
            {role === 'user' && (
              <Nav.Link as={Link} to="/dashboard/user" className={location.pathname === '/dashboard/user' ? 'active' : ''}>
                User Dashboard
              </Nav.Link>
            )}
          </Nav>
          
          <div className="d-flex align-items-center">
            {chainId && (
              <span className={`chain-badge ${chainId === 43113 ? 'fuji' : 'sepolia'}`}>
                {getChainName(chainId)}
              </span>
            )}
            
            {walletAddress ? (
              <div className="d-flex">
                <Button variant="outline-secondary" disabled className="wallet-address-button">
                  <span className="wallet-icon me-2">👛</span>
                  {formatAddress(walletAddress)}
                </Button>
                {role && (
                  <Button variant="outline-danger" className="ms-2 logout-button" onClick={handleLogout}>
                    Logout
                  </Button>
                )}
              </div>
            ) : (
              <Button variant="primary" onClick={connectWalletPressed} className="navbar-connect-btn">
                Connect Wallet
              </Button>
            )}
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
