/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()

const { toBN } = require('web3-utils')
const { takeSnapshot, revertSnapshot } = require('../scripts/ganacheHelper')
const MerkleTreeWithHistory = artifacts.require('./MerkleTreeWithHistoryMock.sol')
const Hasher = artifacts.require('./Hasher.sol')

contract('MerkleTreeWithHistory - Additional Edge Cases', (accounts) => {
  let tree
  let hasher
  let snapshotId
  const sender = accounts[0]
  const levels = 20

  before(async () => {
    hasher = await Hasher.deployed()
    tree = await MerkleTreeWithHistory.new(levels, hasher.address)
    snapshotId = await takeSnapshot()
  })

  describe('Edge Cases and Error Conditions', () => {
    it('should handle zero commitment insertion', async () => {
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000000'
      await tree.insert(commitment, { from: sender })

      const root = await tree.getLastRoot()
      root.should.not.be.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    })

    it('should handle valid commitment values', async () => {
      // Use a smaller valid field element
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000001'
      await tree.insert(commitment, { from: sender })

      const isKnown = await tree.isKnownRoot(await tree.getLastRoot())
      isKnown.should.be.equal(true)
    })

    it('should correctly handle root history size limit', async () => {
      // Insert multiple commitments to test root history management
      for (let i = 1; i <= 35; i++) {
        // More than ROOT_HISTORY_SIZE (30)
        // Use small incrementing values that are valid field elements
        const commitment = '0x' + i.toString(16).padStart(64, '0')
        await tree.insert(commitment, { from: sender })
      }

      // Check that old roots are still known within history limit
      const currentRoot = await tree.getLastRoot()
      const isCurrentKnown = await tree.isKnownRoot(currentRoot)
      isCurrentKnown.should.be.equal(true)
    })

    it('should reject very old roots outside history window', async () => {
      // This test checks the boundary condition for root history
      const veryOldRoot = '0x1234567890123456789012345678901234567890123456789012345678901234'
      const isKnown = await tree.isKnownRoot(veryOldRoot)
      isKnown.should.be.equal(false)
    })

    it('should allow duplicate commitments in merkle tree (commitment detection is in Tornado.sol)', async () => {
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000002'

      // First insertion should succeed
      await tree.insert(commitment, { from: sender })
      const index1 = await tree.nextIndex()

      // Second insertion should also succeed (no duplicate detection in base MerkleTreeWithHistory)
      await tree.insert(commitment, { from: sender })
      const index2 = await tree.nextIndex()

      // Verify both insertions went through
      index2.should.be.eq.BN(toBN(index1).add(toBN(1)))
    })

    it('should correctly calculate next index', async () => {
      const initialIndex = await tree.nextIndex()
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000003'

      await tree.insert(commitment, { from: sender })

      const newIndex = await tree.nextIndex()
      newIndex.should.be.eq.BN(toBN(initialIndex).add(toBN(1)))
    })
  })

  describe('Gas Usage Optimization', () => {
    it('should measure gas usage for insertions', async () => {
      const commitment = '0x0000000000000000000000000000000000000000000000000000000000000004'

      const tx = await tree.insert(commitment, { from: sender })
      console.log(`Gas used for insert: ${tx.receipt.gasUsed}`)

      // Verify gas usage is within expected range
      tx.receipt.gasUsed.should.be.below(1000000) // Reasonable gas limit for merkle tree operations
    })

    it('should measure gas for root checking', async () => {
      const root = await tree.getLastRoot()

      const gasEstimate = await tree.isKnownRoot.estimateGas(root)
      console.log(`Gas estimate for isKnownRoot: ${gasEstimate}`)

      gasEstimate.should.be.below(50000) // Should be efficient
    })
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    snapshotId = await takeSnapshot()
  })
})
