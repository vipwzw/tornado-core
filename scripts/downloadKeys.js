const axios = require('axios')
const path = require('path')
const fs = require('fs')
const files = ['withdraw.json', 'withdraw_proving_key.bin', 'Verifier.sol', 'withdraw_verification_key.json']
const circuitsPath = __dirname + '/../build/circuits'
const contractsPath = __dirname + '/../build/contracts'

async function downloadFile({ url, path }) {
  const writer = fs.createWriteStream(path)

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  })

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
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
    // Try to download missing files from GitHub releases
    const release = await axios.get('https://api.github.com/repos/tornadocash/tornado-core/releases/latest')
    const { assets } = release.data

    for (let asset of assets) {
      if (missingFiles.includes(asset.name)) {
        console.log(`Downloading ${asset.name} ...`)
        await downloadFile({
          url: asset.browser_download_url,
          path: path.resolve(__dirname, circuitsPath, asset.name),
        })
      }
    }
  } catch (error) {
    console.error('❌ Failed to download from GitHub releases:', error.message)
    console.log('ℹ️  This may be due to repository restrictions or network issues.')
    console.log('ℹ️  You may need to obtain these files manually or use alternative sources.')
    console.log('ℹ️  Required files:', missingFiles.join(', '))
    process.exit(1)
  }
}

main()
