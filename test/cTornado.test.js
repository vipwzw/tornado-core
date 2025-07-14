/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const { toBN } = require('web3-utils')
const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const cTornado = artifacts.require('./cTornado.sol')
const Verifier = artifacts.require('./Verifier.sol')
const Hasher = artifacts.require('./Hasher.sol')
const ERC20Mock = artifacts.require('./ERC20Mock.sol')

contract('cTornado', (accounts) => {
  let tornado
  let verifier
  let hasher
  let compToken
  let targetToken
  let snapshotId
  const sender = accounts[0]
  const operator = accounts[1]
  const denomination = '1000000000000000000' // 1 ether
  const merkleTreeHeight = 20

  before(async () => {
    verifier = await Verifier.deployed()
    hasher = await Hasher.deployed()
    compToken = await ERC20Mock.new() // Mock COMP token
    targetToken = await ERC20Mock.new() // Target ERC20 token

    tornado = await cTornado.new(
      compToken.address,
      verifier.address,
      hasher.address,
      denomination,
      merkleTreeHeight,
      targetToken.address
    )
    snapshotId = await takeSnapshot()
  })

    describe('#constructor', () => {
    it('should initialize correctly', async () => {
      const compAddress = await tornado.comp()
      compAddress.should.be.equal(compToken.address)

      const governanceAddress = await tornado.governance()
      governanceAddress.should.be.equal('0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce')

      const tokenAddress = await tornado.token()
      tokenAddress.should.be.equal(targetToken.address)
    })

    it('should reject zero address for COMP token', async () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000'

      try {
        await cTornado.new(
          zeroAddress, // Invalid COMP address
          verifier.address,
          hasher.address,
          denomination,
          merkleTreeHeight,
          targetToken.address
        )
        throw new Error('Should have thrown')
      } catch (error) {
        error.reason.should.include('Invalid COMP token address')
      }
    })
  })

  describe('#claimComp', () => {
    it('should transfer COMP tokens to governance', async () => {
      const compAmount = '1000000000000000000' // 1 COMP

      // Mint COMP tokens to the tornado contract
      await compToken.mint(tornado.address, compAmount)

      const initialGovernanceBalance = await compToken.balanceOf('0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce')
      const initialTornadoBalance = await compToken.balanceOf(tornado.address)

      initialTornadoBalance.should.be.eq.BN(toBN(compAmount))

      // Claim COMP tokens
      await tornado.claimComp({ from: accounts[0] })

      const finalGovernanceBalance = await compToken.balanceOf('0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce')
      const finalTornadoBalance = await compToken.balanceOf(tornado.address)

      finalTornadoBalance.should.be.eq.BN(toBN('0'))
      finalGovernanceBalance.should.be.eq.BN(toBN(initialGovernanceBalance).add(toBN(compAmount)))
    })

    it('should handle zero COMP balance gracefully', async () => {
      const initialBalance = await compToken.balanceOf(tornado.address)
      initialBalance.should.be.eq.BN(toBN('0'))

      // Should not fail even with zero balance
      await tornado.claimComp({ from: accounts[0] })

      const finalBalance = await compToken.balanceOf(tornado.address)
      finalBalance.should.be.eq.BN(toBN('0'))
    })

    it('should allow anyone to call claimComp', async () => {
      const compAmount = '500000000000000000' // 0.5 COMP
      await compToken.mint(tornado.address, compAmount)

      // Different accounts should be able to trigger claim
      await tornado.claimComp({ from: accounts[1] })
      await tornado.claimComp({ from: accounts[2] })
      await tornado.claimComp({ from: accounts[9] })

      const finalBalance = await compToken.balanceOf(tornado.address)
      finalBalance.should.be.eq.BN(toBN('0'))
    })
  })

  describe('ERC20Tornado Functionality', () => {
        it('should inherit deposit functionality', async () => {
      // Use a properly formatted commitment (32 bytes hex string)
      const commitment = '0x1234567890123456789012345678901234567890123456789012345678901234'
      await targetToken.mint(sender, denomination)
      await targetToken.approve(tornado.address, denomination, { from: sender })

      const { logs } = await tornado.deposit(commitment, { from: sender })

      logs[0].event.should.be.equal('Deposit')
      logs[0].args.commitment.should.be.equal(commitment)
      logs[0].args.leafIndex.should.be.eq.BN(toBN('0'))
    })

    it('should inherit token functionality', async () => {
      const tokenAddress = await tornado.token()
      tokenAddress.should.be.equal(targetToken.address)

      const denominationValue = await tornado.denomination()
      denominationValue.should.be.eq.BN(toBN(denomination))
    })
  })

  describe('Governance Integration', () => {
    it('should have correct governance address', async () => {
      const governanceAddress = await tornado.governance()
      governanceAddress.should.be.equal('0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce')
    })

    it('should transfer COMP to governance on claim', async () => {
      const compAmount = '2000000000000000000' // 2 COMP
      await compToken.mint(tornado.address, compAmount)

      const governanceBalanceBefore = await compToken.balanceOf('0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce')

      await tornado.claimComp({ from: sender })

      const governanceBalanceAfter = await compToken.balanceOf('0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce')
      governanceBalanceAfter.should.be.eq.BN(toBN(governanceBalanceBefore).add(toBN(compAmount)))
    })
  })

  describe('Edge Cases', () => {
    it('should handle large COMP amounts', async () => {
      const largeAmount = '1000000000000000000000' // 1000 COMP
      await compToken.mint(tornado.address, largeAmount)

      await tornado.claimComp({ from: sender })

      const balance = await compToken.balanceOf(tornado.address)
      balance.should.be.eq.BN(toBN('0'))
    })

    it('should handle multiple claims in sequence', async () => {
      const amounts = ['100000000000000000', '200000000000000000', '300000000000000000']

      for (const amount of amounts) {
        await compToken.mint(tornado.address, amount)
        await tornado.claimComp({ from: sender })

        const balance = await compToken.balanceOf(tornado.address)
        balance.should.be.eq.BN(toBN('0'))
      }
    })
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    snapshotId = await takeSnapshot()
  })
})
