const snarkjs = require('snarkjs')

// Compatibility layer for websnark utils
// The tornado tests expect these functions but they don't exist in websnark 0.0.4
// This module provides the missing functions by combining snarkjs witness generation with websnark proof generation

async function genWitnessAndProve(groth16, input, circuit, proving_key) {
  try {
    console.log('Generating witness from circuit and input...')

    // Create a circuit instance to generate witness using snarkjs
    const circuitObj = new snarkjs.Circuit(circuit)
    const witness = circuitObj.calculateWitness(input)

    console.log('Witness generated, length:', witness.length)
    console.log('Sample witness values:', {
      first: witness[0],
      type: typeof witness[0],
      constructor: witness[0]?.constructor?.name,
    })

    console.log('Converting witness to binary format for websnark...')

    // Convert witness to the binary format expected by websnark
    const witnessBuffer = new ArrayBuffer(witness.length * 32)
    const witnessView = new Uint8Array(witnessBuffer)

    // Convert each witness element to 32-byte little-endian format
    for (let i = 0; i < witness.length; i++) {
      // Convert to snarkjs bigInt (which returns native BigInt)
      let value = snarkjs.bigInt(witness[i])

      // Convert to bytes in little-endian format using snarkjs.bigInt static methods
      for (let j = 0; j < 32; j++) {
        // Use snarkjs.bigInt.shr and snarkjs.bigInt.and static methods
        const shifted = snarkjs.bigInt.shr(value, j * 8)
        const masked = snarkjs.bigInt.and ? snarkjs.bigInt.and(shifted, 0xff) : shifted & 0xffn
        witnessView[i * 32 + j] = Number(masked)
      }
    }

    console.log('Generating proof with websnark groth16.proof...')

    // Generate proof using websnark (which expects binary witness and proving key)
    const proofData = await groth16.proof(witnessBuffer, proving_key)

    console.log('Proof generated successfully')

    // The proof from websnark should already be in the right format
    // But we need to add public signals
    const result = {
      ...proofData,
      publicSignals: witness.slice(1, circuitObj.nPubInputs + 1), // public signals are witness[1..nPubInputs]
    }

    console.log('Returning proof data:', {
      has_pi_a: !!result.pi_a,
      has_pi_b: !!result.pi_b,
      has_pi_c: !!result.pi_c,
      publicSignals_length: result.publicSignals?.length,
    })

    return result
  } catch (error) {
    console.error('Error in genWitnessAndProve:', error)
    console.error('Error stack:', error.stack)
    throw new Error(`genWitnessAndProve failed: ${error.message}`)
  }
}

function toSolidityInput(proofData) {
  try {
    // Handle both stringified and unstringified proof data
    let proof = proofData
    if (typeof proofData === 'string') {
      proof = JSON.parse(proofData)
    }

    console.log('Converting proof to Solidity input format:', {
      has_pi_a: !!proof.pi_a,
      has_pi_b: !!proof.pi_b,
      has_pi_c: !!proof.pi_c,
      has_publicSignals: !!proof.publicSignals,
    })

    // Ensure the proof is in the right format
    if (typeof proof.pi_a !== 'undefined') {
      // Convert the proof to the format expected by the Solidity verifier
      const proofArray = [
        proof.pi_a[0].toString(),
        proof.pi_a[1].toString(),
        proof.pi_b[0][1].toString(),
        proof.pi_b[0][0].toString(),
        proof.pi_b[1][1].toString(),
        proof.pi_b[1][0].toString(),
        proof.pi_c[0].toString(),
        proof.pi_c[1].toString(),
      ]

      // Convert to hex strings with proper padding
      const proofHex = proofArray.map((x) => {
        let hex = snarkjs.bigInt(x).toString(16)
        // Pad to 64 characters (32 bytes)
        while (hex.length < 64) {
          hex = '0' + hex
        }
        return '0x' + hex
      })

      return {
        proof: proofHex,
        publicSignals: proof.publicSignals || [],
      }
    } else {
      throw new Error('Invalid proof format in toSolidityInput')
    }
  } catch (error) {
    console.error('Error in toSolidityInput:', error)
    throw error
  }
}

module.exports = {
  genWitnessAndProve,
  toSolidityInput,
}
