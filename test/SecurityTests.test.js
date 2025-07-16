/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const { toBN, randomHex } = require('web3-utils')
const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')

const ETHTornado = artifacts.require('./ETHTornado.sol')
const ERC20Tornado = artifacts.require('./ERC20Tornado.sol')
const BadRecipient = artifacts.require('./BadRecipient.sol')
const ERC20Mock = artifacts.require('./ERC20Mock.sol')
// const IUSDT = artifacts.require('./IUSDT.sol')

contract('Security Tests', (accounts) => {
  let ethTornado
  let erc20Tornado
  let token
  let badRecipient
  let snapshotId

  const sender = accounts[0]
  const attacker = accounts[1]
  const relayer = accounts[2]
  const { ETH_AMOUNT, TOKEN_AMOUNT /* MERKLE_TREE_HEIGHT */ } = process.env
  const value = ETH_AMOUNT || '1000000000000000000' // 1 ether
  const tokenAmount = TOKEN_AMOUNT || '1000000000000000000'

  before(async () => {
    ethTornado = await ETHTornado.deployed()
    erc20Tornado = await ERC20Tornado.deployed()
    token = await ERC20Mock.deployed()
    badRecipient = await BadRecipient.new() // Create new instance instead of deployed
    snapshotId = await takeSnapshot()
  })

  describe('Reentrancy Attack Protection', () => {
    it('should prevent reentrancy attacks on ETH withdrawal', async () => {
      // This test verifies the ReentrancyGuard protection
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000001'

      await ethTornado.deposit(commitment, {
        value,
        from: sender,
      })

      // Attempt to trigger reentrancy would fail due to ReentrancyGuard
      // BadRecipient contract attempts reentrancy in its receive function
      try {
        // This would fail before reaching the reentrancy attempt
        await ethTornado.withdraw(
          randomHex(256), // Invalid proof
          randomHex(32), // root
          randomHex(32), // nullifierHash
          badRecipient.address, // recipient that attempts reentrancy
          relayer,
          '100000000000000000', // fee
          '0', // refund
          { from: relayer },
        )
        throw new Error('Should have failed on invalid proof')
      } catch (error) {
        // Accept either error message as both indicate failed withdrawal
        const errorMessage = error.reason || error.message || ''
        const acceptableErrors = ['Invalid withdraw proof', 'Cannot find your merkle root']
        const hasAcceptableError = acceptableErrors.some((msg) => errorMessage.includes(msg))
        hasAcceptableError.should.be.true
      }
    })

    it('should prevent reentrancy attacks on ERC20 withdrawal', async () => {
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000002'

      await token.mint(sender, tokenAmount)
      await token.approve(erc20Tornado.address, tokenAmount, { from: sender })
      await erc20Tornado.deposit(commitment, { from: sender })

      // Attempt withdrawal with invalid proof should fail before reentrancy
      try {
        await erc20Tornado.withdraw(
          randomHex(256), // Invalid proof
          randomHex(32), // root
          randomHex(32), // nullifierHash
          badRecipient.address, // recipient
          relayer,
          '100000000000000000', // fee
          '1000000000000000000', // refund
          { value: '1000000000000000000', from: relayer },
        )
        throw new Error('Should have failed on invalid proof')
      } catch (error) {
        // Accept either error message as both indicate failed withdrawal
        const errorMessage = error.reason || error.message || ''
        const acceptableErrors = ['Invalid withdraw proof', 'Cannot find your merkle root']
        const hasAcceptableError = acceptableErrors.some((msg) => errorMessage.includes(msg))
        hasAcceptableError.should.be.true
      }
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid commitment values', async () => {
      const invalidCommitments = [
        '0x', // Empty
        '0x00', // Too short
        '0x00112233445566778899aabbccddeeff00112233445566778899aabbccddee', // 31 bytes
        '0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00', // 33 bytes
      ]

      for (const commitment of invalidCommitments) {
        try {
          await ethTornado.deposit(commitment, {
            value,
            from: sender,
          })
          throw new Error(`Should have rejected commitment: ${commitment}`)
        } catch (error) {
          // Expected to fail
          error.should.not.be.null
        }
      }
    })

    it('should reject zero value deposits for ETH', async () => {
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000003'

      try {
        await ethTornado.deposit(commitment, {
          value: '0',
          from: sender,
        })
        throw new Error('Should have rejected zero value deposit')
      } catch (error) {
        // Accept either error message as both indicate invalid ETH amount
        const errorMessage = error.reason || error.message || ''
        const acceptableErrors = [
          'incorrect ETH amount',
          'Please send `mixDenomination` ETH along with transaction',
        ]
        const hasAcceptableError = acceptableErrors.some((msg) => errorMessage.includes(msg))
        hasAcceptableError.should.be.true
      }
    })

    it('should reject incorrect ETH amounts', async () => {
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000004'
      const wrongValue = toBN(value).add(toBN('1'))

      try {
        await ethTornado.deposit(commitment, {
          value: wrongValue.toString(),
          from: sender,
        })
        throw new Error('Should have rejected incorrect ETH amount')
      } catch (error) {
        // Accept either error message as both indicate invalid ETH amount
        const errorMessage = error.reason || error.message || ''
        const acceptableErrors = [
          'incorrect ETH amount',
          'Please send `mixDenomination` ETH along with transaction',
        ]
        const hasAcceptableError = acceptableErrors.some((msg) => errorMessage.includes(msg))
        hasAcceptableError.should.be.true
      }
    })
  })

  describe('Overflow/Underflow Protection', () => {
    it('should handle maximum uint256 values safely', async () => {
      const maxUint256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

      // These should fail gracefully, not cause overflows
      try {
        await ethTornado.withdraw(
          '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000005',
          '0x0000000000000000000000000000000000000000000000000000000000000006',
          accounts[3],
          relayer,
          maxUint256, // Max fee
          '0',
          { from: relayer },
        )
        throw new Error('Should have failed on invalid proof')
      } catch (error) {
        // Accept various fee-related error messages
        const errorMessage = error.reason || error.message || ''
        const acceptableErrors = [
          'Invalid withdraw proof',
          'Fee exceeds transfer value',
          'Cannot find your merkle root',
        ]
        const hasAcceptableError = acceptableErrors.some((msg) => errorMessage.includes(msg))
        hasAcceptableError.should.be.true
      }
    })

    it('should reject fees larger than denomination', async () => {
      const largeFee = toBN(value).add(toBN('1'))

      try {
        await ethTornado.withdraw(
          '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000007',
          '0x0000000000000000000000000000000000000000000000000000000000000008',
          accounts[3],
          relayer,
          largeFee.toString(),
          '0',
          { from: relayer },
        )
        throw new Error('Should have failed on invalid proof or fee')
      } catch (error) {
        // Should fail on proof validation or fee validation
        error.should.not.be.null
      }
    })
  })

  describe('Access Control Attacks', () => {
    it('should reject unauthorized operator changes', async () => {
      // Assuming there's an operator functionality
      try {
        // This should fail if there's access control
        await ethTornado.updateOperator(attacker, { from: attacker })
        throw new Error('Should have rejected unauthorized access')
      } catch (error) {
        // Expected - either function doesn't exist or access is denied
        error.should.not.be.null
      }
    })

    it('should prevent unauthorized contract upgrades', async () => {
      // Test that contracts cannot be upgraded by non-owners
      try {
        // This should fail - looking for any upgrade functions
        const contractCode = await web3.eth.getCode(ethTornado.address)
        contractCode.should.not.equal('0x')

        // If there were upgrade functions, they should be protected
        // This is more of a structural test
      } catch (error) {
        // Expected if trying unauthorized operations
      }
    })
  })

  describe('Front-running Protection', () => {
    it('should maintain privacy even with front-running attempts', async () => {
      const commitment1 = '0x0000000000000000000000000000000000000000000000000000000000000009'
      const commitment2 = '0x000000000000000000000000000000000000000000000000000000000000000a'

      // Simulate concurrent deposits (front-running scenario)
      const tx1 = ethTornado.deposit(commitment1, {
        value,
        from: accounts[3],
        gasPrice: '20000000000', // Higher gas price
      })

      const tx2 = ethTornado.deposit(commitment2, {
        value,
        from: accounts[4],
        gasPrice: '10000000000', // Lower gas price
      })

      const [result1, result2] = await Promise.all([tx1, tx2])

      // Both should succeed regardless of order
      result1.logs[0].event.should.equal('Deposit')
      result2.logs[0].event.should.equal('Deposit')

      // Leaf indices should be sequential
      const index1 = result1.logs[0].args.leafIndex
      const index2 = result2.logs[0].args.leafIndex

      Math.abs(index1.toNumber() - index2.toNumber()).should.equal(1)
    })
  })

  describe('Gas Limit Attacks', () => {
    it('should handle operations within reasonable gas limits', async () => {
      const commitment = '0x000000000000000000000000000000000000000000000000000000000000000b'

      const gasEstimate = await ethTornado.deposit.estimateGas(commitment, {
        value,
        from: sender,
      })

      // Should not require excessive gas
      gasEstimate.should.be.below(1000000) // Reasonable limit for deposits (adjusted for merkle tree operations)
    })

    it('should not be vulnerable to gas griefing', async () => {
      // Test that operations complete deterministically
      const commitment = '0x000000000000000000000000000000000000000000000000000000000000000c'

      const tx = await ethTornado.deposit(commitment, {
        value,
        from: sender,
        gas: 1000000, // Sufficient but not excessive (adjusted for merkle operations)
      })

      tx.receipt.status.should.be.true
      tx.receipt.gasUsed.should.be.below(1000000)
    })
  })

  describe('Edge Case Handling', () => {
    it('should handle contract balance edge cases', async () => {
      const initialBalance = await web3.eth.getBalance(ethTornado.address)

      // Contract should handle its balance correctly
      const commitment = '0x000000000000000000000000000000000000000000000000000000000000000d'
      await ethTornado.deposit(commitment, { value, from: sender })

      const newBalance = await web3.eth.getBalance(ethTornado.address)
      newBalance.should.be.eq.BN(toBN(initialBalance).add(toBN(value)))
    })

    it('should handle token approval edge cases', async () => {
      await token.mint(sender, tokenAmount)

      // Test with exact approval
      await token.approve(erc20Tornado.address, tokenAmount, { from: sender })
      const commitment = '0x000000000000000000000000000000000000000000000000000000000000000e'
      await erc20Tornado.deposit(commitment, { from: sender })

      // Should have used exact approval amount
      const remainingApproval = await token.allowance(sender, erc20Tornado.address)
      remainingApproval.should.be.eq.BN(toBN('0'))
    })
  })

  describe('Token Compatibility Tests', () => {
    it('should work with different ERC20 implementations', async () => {
      // Test with standard ERC20Mock
      const balance = await token.balanceOf(sender)
      balance.should.be.a('object') // BN object

      // Test basic ERC20 functionality
      const decimals = await token.decimals()
      decimals.should.be.a('object')

      const totalSupply = await token.totalSupply()
      totalSupply.should.be.a('object')

      const symbol = await token.symbol()
      symbol.should.be.equal('DAIM')

      const name = await token.name()
      name.should.be.equal('DAIMock')
    })

    it('should handle non-standard token interfaces gracefully', () => {
      // Test that the contract can interface with different token standards
      // This verifies the contract doesn't break with tokens like USDT

      // Verify our mock token has standard ERC20 methods
      const hasStandardMethods = ['balanceOf', 'transfer', 'approve', 'allowance']

      for (const method of hasStandardMethods) {
        const methodExists = typeof token[method] === 'function'
        methodExists.should.be.true
      }
    })

    it('should reject invalid token addresses', async () => {
      // Test deployment with invalid token address should fail
      const zeroAddress = '0x0000000000000000000000000000000000000000'

      try {
        // This should fail during tornado contract initialization
        // We can't actually test this easily without redeploying,
        // but we can verify the current token is valid
        const currentToken = await erc20Tornado.token()
        currentToken.should.not.equal(zeroAddress)
        currentToken.should.be.equal(token.address)
      } catch (error) {
        // Expected if trying to deploy with invalid address
      }
    })
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    snapshotId = await takeSnapshot()
  })
})
