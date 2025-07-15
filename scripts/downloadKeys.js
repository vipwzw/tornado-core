const path = require('path')
const fs = require('fs')
const files = ['withdraw.json', 'withdraw_proving_key.bin', 'Verifier.sol', 'withdraw_verification_key.json']
const circuitsPath = __dirname + '/../build/circuits'
const contractsPath = __dirname + '/../build/contracts'
const releasePath = __dirname + '/../release'

function copyFile(sourcePath, destPath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath)
    const writeStream = fs.createWriteStream(destPath)

    readStream.on('error', reject)
    writeStream.on('error', reject)
    writeStream.on('finish', resolve)

    readStream.pipe(writeStream)
  })
}

async function main() {
  // Create directories if they don't exist
  if (!fs.existsSync(circuitsPath)) {
    fs.mkdirSync(circuitsPath, { recursive: true })
  }
  if (!fs.existsSync(contractsPath)) {
    fs.mkdirSync(contractsPath, { recursive: true })
  }

  // Check which files are missing
  const missingFiles = files.filter((file) => {
    const filePath = path.resolve(__dirname, circuitsPath, file)
    return !fs.existsSync(filePath)
  })

  if (missingFiles.length === 0) {
    console.log('✅ All required files are already present:')
    files.forEach((file) => {
      const filePath = path.resolve(__dirname, circuitsPath, file)
      const stats = fs.statSync(filePath)
      console.log(`  - ${file} (${Math.round((stats.size / 1024 / 1024) * 100) / 100} MB)`)
    })
    return
  }

  console.log(`Found ${missingFiles.length} missing files: ${missingFiles.join(', ')}`)

  try {
    // Copy missing files from local release directory
    for (const fileName of missingFiles) {
      const sourcePath = path.resolve(__dirname, releasePath, fileName)
      const destPath = path.resolve(__dirname, circuitsPath, fileName)

      if (fs.existsSync(sourcePath)) {
        console.log(`Copying ${fileName} from local release directory...`)
        await copyFile(sourcePath, destPath)
      } else {
        console.error(`❌ File ${fileName} not found in release directory: ${sourcePath}`)
        process.exit(1)
      }
    }
  } catch (error) {
    console.error('❌ Failed to copy files from release directory:', error.message)
    console.log('ℹ️  Make sure the release directory contains all required files.')
    console.log('ℹ️  Required files:', missingFiles.join(', '))
    process.exit(1)
  }
}

main()
