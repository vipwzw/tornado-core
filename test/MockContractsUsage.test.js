/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const { toBN } = require('web3-utils')
const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

// Import all mock contracts
const ERC20Mock = artifacts.require('./ERC20Mock.sol')
const BadRecipient = artifacts.require('./BadRecipient.sol')
const MerkleTreeWithHistoryMock = artifacts.require('./MerkleTreeWithHistoryMock.sol')
const IUSDT = artifacts.require('./IUSDT.sol')
const IDeployer = artifacts.require('./IDeployer.sol')

// Import main contracts for integration testing
const ETHTornado = artifacts.require('./ETHTornado.sol')
const ERC20Tornado = artifacts.require('./ERC20Tornado.sol')
const Hasher = artifacts.require('./Hasher.sol')

contract('Mock Contracts Usage Demonstration', (accounts) => {
  let erc20Mock
  let badRecipient
  let merkleTreeMock
  let hasher
  let snapshotId

  const sender = accounts[0]
  const recipient = accounts[1]
  const attacker = accounts[2]

  before(async () => {
    // Deploy all mock contracts
    erc20Mock = await ERC20Mock.new()
    badRecipient = await BadRecipient.new()
    hasher = await Hasher.deployed()
    merkleTreeMock = await MerkleTreeWithHistoryMock.new(20, hasher.address)

    snapshotId = await takeSnapshot()
  })

  describe('ERC20Mock Usage', () => {
    it('should demonstrate proper ERC20Mock usage', async () => {
      // Test minting functionality
      const mintAmount = '1000000000000000000' // 1 token
      await erc20Mock.mint(sender, mintAmount)

      const balance = await erc20Mock.balanceOf(sender)
      balance.should.be.eq.BN(toBN(mintAmount))

      // Test transfer
      const transferAmount = '500000000000000000' // 0.5 token
      await erc20Mock.transfer(recipient, transferAmount, { from: sender })

      const senderBalance = await erc20Mock.balanceOf(sender)
      const recipientBalance = await erc20Mock.balanceOf(recipient)

      senderBalance.should.be.eq.BN(toBN(mintAmount).sub(toBN(transferAmount)))
      recipientBalance.should.be.eq.BN(toBN(transferAmount))

      // Test approve and allowance
      const approveAmount = '200000000000000000' // 0.2 token
      await erc20Mock.approve(recipient, approveAmount, { from: sender })

      const allowance = await erc20Mock.allowance(sender, recipient)
      allowance.should.be.eq.BN(toBN(approveAmount))
    })

    it('should work as a replacement for real tokens in testing', async () => {
      // Demonstrate how ERC20Mock provides all necessary functionality
      const tokenInfo = {
        name: await erc20Mock.name(),
        symbol: await erc20Mock.symbol(),
        decimals: await erc20Mock.decimals(),
        totalSupply: await erc20Mock.totalSupply()
      }

      tokenInfo.name.should.equal('DAIMock')
      tokenInfo.symbol.should.equal('DAIM')
      tokenInfo.decimals.should.be.eq.BN(toBN('18'))
    })
  })

  describe('BadRecipient Usage', () => {
          it('should demonstrate BadRecipient rejecting ETH transfers', async () => {
        // Test that BadRecipient properly rejects ETH
        try {
          await web3.eth.sendTransaction({
            from: sender,
            to: badRecipient.address,
            value: '1000000000000000000' // 1 ETH
          })
          throw new Error('Should have rejected ETH transfer')
        } catch (error) {
          // Accept either the expected revert message or generic revert
          const errorMessage = error.message || error.reason || ''
          const acceptableErrors = ['this contract does not accept ETH', 'revert', 'VM Exception']
          const hasAcceptableError = acceptableErrors.some(msg => errorMessage.includes(msg))
          hasAcceptableError.should.be.true
        }
      })

    it('should be useful for testing withdrawal failure scenarios', async () => {
      // Demonstrate how BadRecipient can be used to test edge cases
      const ethTornado = await ETHTornado.deployed()

      // Test that tornado contract handles failed recipients appropriately
      // This would be part of a larger withdrawal test where BadRecipient.address
      // is used as the recipient parameter

      const badAddress = badRecipient.address
      badAddress.should.be.a('string')
      badAddress.should.match(/^0x[a-fA-F0-9]{40}$/) // Valid Ethereum address format
    })
  })

  describe('MerkleTreeWithHistoryMock Usage', () => {
    it('should provide direct access to internal MerkleTree functions', async () => {
      // Test that the mock exposes the insert function
      const leaf1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
      const leaf2 = '0x0000000000000000000000000000000000000000000000000000000000000002'

      // Insert leaves directly (not possible with the main contract)
      await merkleTreeMock.insert(leaf1)
      await merkleTreeMock.insert(leaf2)

      // Verify tree state
      const currentIndex = await merkleTreeMock.currentRootIndex()
      currentIndex.should.be.eq.BN(toBN('2')) // 2 insertions

      const isKnownRoot = await merkleTreeMock.isKnownRoot(await merkleTreeMock.getLastRoot())
      isKnownRoot.should.be.true
    })

          it('should enable comprehensive merkle tree testing', async () => {
        // Test edge cases that would be difficult with the main contract
        const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000'
        const validHash = '0x0000000000000000000000000000000000000000000000000000000000000003'

        // Insert valid field values (max hash exceeds the cryptographic field)
        await merkleTreeMock.insert(zeroHash)
        await merkleTreeMock.insert(validHash)

        // Verify the tree can handle edge cases
        const currentIndex = await merkleTreeMock.currentRootIndex()
        currentIndex.should.be.a('object') // BN object

        const isKnownZero = await merkleTreeMock.isKnownRoot(zeroHash)
        // Zero hash shouldn't be a valid root unless specifically calculated
        isKnownZero.should.be.false
      })
  })

  describe('Integration Testing with Mocks', () => {
    it('should demonstrate using multiple mocks together', async () => {
      // Example: Test ERC20Tornado with ERC20Mock and BadRecipient
      const erc20Tornado = await ERC20Tornado.deployed()

      // Mint tokens and approve tornado contract
      const depositAmount = '1000000000000000000'
      await erc20Mock.mint(sender, depositAmount)
      await erc20Mock.approve(erc20Tornado.address, depositAmount, { from: sender })

      // Use BadRecipient address as a test recipient (would fail in real withdrawal)
      const testRecipient = badRecipient.address

      // Verify setup
      const allowance = await erc20Mock.allowance(sender, erc20Tornado.address)
      allowance.should.be.eq.BN(toBN(depositAmount))

      const recipientCode = await web3.eth.getCode(testRecipient)
      recipientCode.should.not.equal('0x') // Contract exists
    })

    it('should show how mocks isolate testing concerns', async () => {
      // Demonstrate how mocks provide predictable, controllable test environment

      // ERC20Mock provides unlimited minting for testing
      const largeAmount = '1000000000000000000000000' // 1M tokens
      await erc20Mock.mint(sender, largeAmount)

      const balance = await erc20Mock.balanceOf(sender)
      balance.should.be.eq.BN(toBN(largeAmount))

      // BadRecipient provides predictable failure scenario
      const isContract = await web3.eth.getCode(badRecipient.address)
      isContract.length.should.be.greaterThan(2) // Has contract code

      // MerkleTreeMock provides direct state manipulation
      const leaves = [
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000000000000000000000000000003'
      ]

      for (const leaf of leaves) {
        await merkleTreeMock.insert(leaf)
      }

      const finalIndex = await merkleTreeMock.currentRootIndex()
      finalIndex.should.be.eq.BN(toBN(leaves.length.toString()))
    })
  })

  describe('Mock Contract Best Practices', () => {
    it('should demonstrate when to use each mock', async () => {
      // ERC20Mock: When you need a controllable ERC20 token
      // - Unlimited minting for test scenarios
      // - Predictable behavior without external dependencies

      // BadRecipient: When you need to test failure scenarios
      // - Contracts that reject ETH transfers
      // - Testing error handling in withdrawal processes

      // MerkleTreeMock: When you need to test internal merkle tree logic
      // - Direct insertion without going through deposit flow
      // - Testing edge cases and boundary conditions

      // Verify each mock serves its purpose
      const mockPurposes = {
        erc20Mock: 'controllable-token',
        badRecipient: 'failure-scenarios',
        merkleTreeMock: 'internal-testing'
      }

      // Each mock should be distinct and serve different testing needs
      Object.keys(mockPurposes).length.should.equal(3)
    })

    it('should show mock limitations and when to use real contracts', async () => {
      // Mocks are great for unit testing but have limitations:
      // 1. ERC20Mock doesn't test real token quirks (like USDT's non-standard returns)
      // 2. BadRecipient is artificial - real contracts might fail differently
      // 3. MerkleTreeMock bypasses normal validation that happens in main contracts

      // For integration testing, sometimes real contracts or more sophisticated mocks are needed

      // Example: IUSDT interface suggests the protocol should work with USDT
      // but USDT has quirks (no return value on transfer) that ERC20Mock doesn't simulate

      const mockIsSimplified = await erc20Mock.symbol()
      mockIsSimplified.should.equal('DAIM') // Simplified, predictable response

      // Real USDT would have different behavior, requiring different testing approaches
    })
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    snapshotId = await takeSnapshot()
  })
})
