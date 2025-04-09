import React, { useState, useEffect } from 'react'
import {
  Container,
  Form,
  Button,
  Card,
  Alert,
  Spinner,
  Row,
  Col,
} from 'react-bootstrap'
import { ethers } from 'ethers'
import {
  getContracts,
  getCurrentWalletConnected,
  approveTokens,
  getDecimalsFromTokenContract,
  getERC20Contract,
} from '../utils/interact'
import {
  registerEstateOwner,
  getEstateOwnerByAddress,
  getApprovedNodeOperators,
} from '../utils/api'
import { useNavigate } from 'react-router-dom'
import addresses from '../contracts/abi/addresses'
import { PinataSDK } from 'pinata'

const EstateOwnerSignup = ({ setRole }) => {
  const [walletAddress, setWalletAddress] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [chainId, setChainId] = useState(null)
  const [contracts, setContracts] = useState(null)
  const [tokenOptions, setTokenOptions] = useState([])
  const [approvedNodeOperators, setApprovedNodeOperators] = useState([])

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
    token: '',
    tokenSymbol: '',
  })

  const pinata = new PinataSDK({
    pinataJwt: process.env.REACT_APP_PINATA_JWT,
    pinataGateway: 'brown-evil-marlin-908.mypinata.cloud',
  })

  const navigate = useNavigate()

  useEffect(() => {
    const init = async () => {
      try {
        // Get connected wallet
        const { address, status } = await getCurrentWalletConnected()
        console.log('Wallet connection status:', status, 'Address:', address)

        if (status !== 'success' || !address) {
          console.log('Wallet not connected properly')
          setError('Please connect your wallet to continue')
          setLoading(false)
          return
        }

        setWalletAddress(address)
        setFormData((prev) => ({ ...prev, ethAddress: address }))

        // Get chain ID and contracts
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum)
          const network = await provider.getNetwork()
          setChainId(network.chainId)

          // Update token options based on chain
          updateTokenOptions(network.chainId)

          // Get contract instances
          const contractInstances = getContracts(network.chainId)
          setContracts(contractInstances)

          // Check if wallet is already registered
          try {
            const estateOwnerData = await getEstateOwnerByAddress(address)
            if (estateOwnerData && estateOwnerData.estateOwner) {
              setIsRegistered(true)

              // Set role if provided
              if (setRole) {
                setRole('estate-owner')
                localStorage.setItem('userRole', 'estate-owner')
              }

              // Redirect to dashboard
              navigate('/dashboard/estate-owner')
            }
          } catch (error) {
            console.log('Not registered as an estate owner yet')
          }
        }

        // Fetch approved node operators
        try {
          const response = await getApprovedNodeOperators()
          const nodes = response.data.node
          if (nodes && nodes.length > 0) {
            setApprovedNodeOperators(nodes)
          }
        } catch (error) {
          console.error('Error fetching approved node operators:', error)
        }
      } catch (err) {
        console.error(err)
        setError('Error connecting to wallet')
      } finally {
        setLoading(false)
      }
    }

    const updateTokenOptions = (chainId) => {
      const networkAddresses = addresses[chainId]
      if (networkAddresses) {
        setTokenOptions([
          {
            name: `Native ${chainId === 43114 ? 'AVAX' : 'ETH'}`,
            address: ethers.constants.AddressZero,
          },
          { name: 'USDC', address: networkAddresses.usdc },
        ])
        // Reset token when chain changes
        setFormData((prev) => ({ ...prev, token: '' }))
      }
    }

    init()

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
          setFormData((prev) => ({ ...prev, ethAddress: accounts[0] }))
        } else {
          setWalletAddress('')
          setFormData((prev) => ({ ...prev, ethAddress: '' }))
        }
      })

      window.ethereum.on('chainChanged', (chainId) => {
        const newChainId = parseInt(chainId, 16)
        setChainId(newChainId)
        updateTokenOptions(newChainId)
      })
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {})
        window.ethereum.removeListener('chainChanged', () => {})
      }
    }
  }, [setRole, navigate])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const uploadImage = async (file) => {
    const upload = await pinata.upload.public.file(file)
    return upload.cid
  }

  const handleImageChange = (e) => {
    const { name, files } = e.target
    setFormData((prev) => ({ ...prev, [name]: files[0] }))
  }

  const handleTokenChange = async (e) => {
    const selectedToken = e.target.value

    let tokenSymbol = ''

    if (selectedToken === ethers.constants.AddressZero) {
      tokenSymbol = chainId === 43114 ? 'AVAX' : 'ETH'
    } else {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const tokenContract = getERC20Contract(selectedToken, signer)
      tokenSymbol = await tokenContract.symbol()
    }

    setFormData((prev) => ({
      ...prev,
      token: selectedToken,
      tokenSymbol: tokenSymbol,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      // Validate form
      if (
        !formData.name ||
        !formData.ethAddress ||
        !formData.country ||
        !formData.state ||
        !formData.address ||
        !formData.kycType ||
        !formData.kycId ||
        !formData.kycDocumentImage ||
        !formData.ownershipDocumentImage ||
        !formData.realEstateInfo ||
        !formData.currentEstateCost ||
        !formData.percentageToTokenize ||
        !formData.token ||
        !formData.tokenSymbol
      ) {
        setError('Please fill in all required fields')
        setLoading(false)
        return
      }

      // Randomly assign a node operator if there are approved ones
      let nodeOperatorAssigned = ''
      if (approvedNodeOperators.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * approvedNodeOperators.length
        )
        nodeOperatorAssigned = approvedNodeOperators[randomIndex].ensName
      } else {
        setError(
          'No approved node operators available. Please try again later.'
        )
        setLoading(false)
        return
      }

      // nodeOperatorAssigned = 'TitanOP';

      const kycDocumentCid = await uploadImage(formData.kycDocumentImage)
      const ownershipDocumentCid = await uploadImage(
        formData.ownershipDocumentImage
      )

      // Prepare data for submission
      const estateOwnerData = {
        ...formData,
        nodeOperatorAssigned,
        kycDocumentImage: `${process.env.REACT_APP_PINATA_BASE_URL}/${kycDocumentCid}`,
        ownershipDocumentImage: `${process.env.REACT_APP_PINATA_BASE_URL}/${ownershipDocumentCid}`,
        ethAddress: walletAddress, // Ensure we're using the connected wallet address
      }

      let tokenDecimals = 18

      // If the selected token is not the native token (address 0), approve it to the asset tokenization manager
      if (formData.token !== ethers.constants.AddressZero) {
        try {
          setSuccess('Approving token for spending...')

          // Get the provider and signer
          const provider = new ethers.providers.Web3Provider(window.ethereum)
          const signer = provider.getSigner()

          // Get the asset tokenization manager address
          const assetTokenizationManagerAddress =
            contracts.assetTokenizationManager.address

          // Approve the token
          const approvalResult = await approveTokens(
            formData.token,
            assetTokenizationManagerAddress,
            ethers.constants.MaxUint256,
            signer
          )

          if (!approvalResult.success) {
            setError('Failed to approve token. Please try again.')
            setLoading(false)
            return
          }

          tokenDecimals = await getDecimalsFromTokenContract(
            formData.token,
            signer
          )

          setSuccess(
            'Token approved successfully! Proceeding with registration...'
          )
        } catch (error) {
          console.error('Error approving token:', error)
          setError('Failed to approve token: ' + error.message)
          setLoading(false)
          return
        }
      }

      const estateCostInTokenDecimals = ethers.utils
        .parseUnits(formData.currentEstateCost.toString(), tokenDecimals)
        .toString()

      estateOwnerData.currentEstateCost = estateCostInTokenDecimals

      // Register estate owner
      const response = await registerEstateOwner(estateOwnerData)

      if (response && response.status === 'success') {
        setSuccess('Estate owner registered successfully!')

        // Set role if provided
        if (setRole) {
          setRole('estate-owner')
          localStorage.setItem('userRole', 'estate-owner')
        }

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard/estate-owner')
        }, 2000)
      } else {
        setError('Registration failed. Please try again.')
      }
    } catch (error) {
      console.error('Error during registration:', error)
      setError(error.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="estate-owner-signup-container">
        <Container className="estate-signup-spinner-container">
          <div className="estate-signup-spinner"></div>
        </Container>
      </div>
    )
  }

  if (isRegistered) {
    return (
      <div className="estate-owner-signup-container">
        <Container className="mt-5 mb-5">
          <Card className="estate-owner-signup-card">
            <div className="estate-signup-registered">
              <h3>Already Registered</h3>
              <p>
                This wallet address is already registered as an estate owner.
              </p>
              <Button
                variant="primary"
                onClick={() => navigate('/dashboard/estate-owner')}
                className="estate-signup-dashboard-btn"
              >
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </Container>
      </div>
    )
  }

  return (
    <div className="estate-owner-signup-container">
      <Container className="mt-5 mb-5">
        <Card className="estate-owner-signup-card">
          <div className="estate-owner-signup-header">
            <h2>Tokenize Your Real Estate Property</h2>
            <p>
              Register your property details and transform it into a valuable
              digital asset on the blockchain
            </p>
          </div>

          <div className="estate-owner-signup-body">
            {error && (
              <div className="estate-signup-alert estate-signup-alert-danger">
                {error}
              </div>
            )}
            {success && (
              <div className="estate-signup-alert estate-signup-alert-success">
                {success}
              </div>
            )}

            <div className="estate-signup-features">
              <div className="estate-signup-feature-box">
                <div className="icon">🏡</div>
                <h3>Property Ownership</h3>
                <p>Register your real estate assets securely on blockchain</p>
              </div>

              <div className="estate-signup-feature-box">
                <div className="icon">📊</div>
                <h3>Tokenization</h3>
                <p>Convert your property value into digital tokens</p>
              </div>

              <div className="estate-signup-feature-box">
                <div className="icon">💰</div>
                <h3>Liquidity</h3>
                <p>Unlock the value of your real estate assets</p>
              </div>
            </div>

            <Form onSubmit={handleSubmit}>
              <div className="estate-signup-section-title">
                Personal Information
              </div>
              <Row className="estate-signup-form-row">
                <Col md={6}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Full Name{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      required
                      className="form-control estate-signup-form-control"
                    />
                  </div>
                </Col>

                <Col md={6}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Wallet Address
                    </label>
                    <input
                      type="text"
                      value={walletAddress}
                      disabled
                      placeholder="Connect your wallet"
                      className="form-control estate-signup-form-control"
                    />
                    <small className="estate-signup-form-text">
                      Your connected blockchain wallet address
                    </small>
                  </div>
                </Col>
              </Row>

              <Row className="estate-signup-form-row">
                <Col md={4}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Country <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      placeholder="Enter your country"
                      required
                      className="form-control estate-signup-form-control"
                    />
                  </div>
                </Col>

                <Col md={4}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      State <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="Enter your state"
                      required
                      className="form-control estate-signup-form-control"
                    />
                  </div>
                </Col>

                <Col md={4}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Address <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Enter your address"
                      required
                      className="form-control estate-signup-form-control"
                    />
                  </div>
                </Col>
              </Row>

              <div className="estate-signup-section-title">
                KYC & Verification
              </div>
              <Row className="estate-signup-form-row">
                <Col md={6}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      KYC Document Type{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <select
                      name="kycType"
                      value={formData.kycType}
                      onChange={handleInputChange}
                      required
                      className="form-control estate-signup-form-control estate-signup-select"
                    >
                      <option value="passport">Passport</option>
                      <option value="drivingLicense">Driving License</option>
                      <option value="nationalId">National ID</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      KYC Document ID{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="kycId"
                      value={formData.kycId}
                      onChange={handleInputChange}
                      placeholder="Enter your document ID"
                      required
                      className="form-control estate-signup-form-control"
                    />
                  </div>
                </Col>
              </Row>

              <Row className="estate-signup-form-row">
                <Col md={6}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      KYC Document Image{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <div className="estate-signup-file-input">
                      <label
                        className={
                          formData.kycDocumentImage ? 'file-selected' : ''
                        }
                      >
                        {formData.kycDocumentImage
                          ? 'File Selected ✓'
                          : 'Choose File'}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        name="kycDocumentImage"
                        onChange={handleImageChange}
                        required
                      />
                    </div>
                    <small className="estate-signup-form-text">
                      Upload your KYC document image (passport, ID, etc.)
                    </small>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Ownership Document Image{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <div className="estate-signup-file-input">
                      <label
                        className={
                          formData.ownershipDocumentImage ? 'file-selected' : ''
                        }
                      >
                        {formData.ownershipDocumentImage
                          ? 'File Selected ✓'
                          : 'Choose File'}
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        name="ownershipDocumentImage"
                        onChange={handleImageChange}
                        required
                      />
                    </div>
                    <small className="estate-signup-form-text">
                      Upload your property ownership document image
                    </small>
                  </div>
                </Col>
              </Row>

              <div className="estate-signup-section-title">
                Property Information
              </div>
              <div className="estate-signup-form-group">
                <label className="estate-signup-form-label">
                  Real Estate Information{' '}
                  <span className="estate-signup-required">*</span>
                </label>
                <textarea
                  rows={4}
                  name="realEstateInfo"
                  value={formData.realEstateInfo}
                  onChange={handleInputChange}
                  placeholder="Provide details about your real estate property (location, size, type, amenities, etc.)"
                  required
                  className="form-control estate-signup-form-control estate-signup-textarea"
                ></textarea>
              </div>

              <Row className="estate-signup-form-row">
                <Col md={4}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Current Estate Value{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="number"
                      name="currentEstateCost"
                      value={formData.currentEstateCost}
                      onChange={handleInputChange}
                      placeholder="Enter the current value of your estate"
                      required
                      className="form-control estate-signup-form-control"
                    />
                    <small className="estate-signup-form-text">
                      Current market value of your property
                    </small>
                  </div>
                </Col>

                <Col md={4}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Percentage to Tokenize{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <input
                      type="number"
                      name="percentageToTokenize"
                      value={formData.percentageToTokenize}
                      onChange={handleInputChange}
                      placeholder="Enter percentage (1-100)"
                      min="1"
                      max="100"
                      required
                      className="form-control estate-signup-form-control"
                    />
                    <small className="estate-signup-form-text">
                      Percentage of property value to tokenize
                    </small>
                  </div>
                </Col>

                <Col md={4}>
                  <div className="estate-signup-form-group">
                    <label className="estate-signup-form-label">
                      Payment Token{' '}
                      <span className="estate-signup-required">*</span>
                    </label>
                    <select
                      value={formData.token}
                      onChange={handleTokenChange}
                      required
                      className="form-control estate-signup-form-control estate-signup-select"
                    >
                      <option value="">Select Token</option>
                      {tokenOptions.map((token, index) => (
                        <option key={index} value={token.address}>
                          {token.name}
                        </option>
                      ))}
                    </select>
                    <small className="estate-signup-form-text">
                      Token used for transactions
                    </small>
                  </div>
                </Col>
              </Row>

              <button
                type="submit"
                className="estate-signup-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Processing Registration...
                  </>
                ) : (
                  'Register Property for Tokenization'
                )}
              </button>
            </Form>
          </div>
        </Card>
      </Container>
    </div>
  )
}

export default EstateOwnerSignup
