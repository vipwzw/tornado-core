const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const files = ['withdraw.json', 'withdraw_proving_key.bin', 'Verifier.sol', 'withdraw_verification_key.json']
const circuitsPath = __dirname + '/../build/circuits'
const contractsPath = __dirname + '/../build/contracts'

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // cyan
    success: '\x1b[32m', // green
    warning: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
    reset: '\x1b[0m', // reset
  }

  const color = colors[type] || colors.info
  console.log(`${color}${message}${colors.reset}`)
}

function generateCircuitFiles() {
  log('🔧 Generating circuit files...', 'info')

  try {
    // Create directories if they don't exist
    if (!fs.existsSync(circuitsPath)) {
      fs.mkdirSync(circuitsPath, { recursive: true })
    }
    if (!fs.existsSync(contractsPath)) {
      fs.mkdirSync(contractsPath, { recursive: true })
    }

    log('📦 Step 1: Compiling circuit...', 'info')
    execSync('npm run build:circuit:compile', { stdio: 'inherit' })

    log('🔑 Step 2: Generating proving and verification keys...', 'info')
    execSync('npm run build:circuit:setup', { stdio: 'inherit' })

    log('🔧 Step 3: Converting proving key to binary format...', 'info')
    execSync('npm run build:circuit:bin', { stdio: 'inherit' })

    log('📝 Step 4: Generating Verifier contract...', 'info')
    execSync('npm run build:circuit:contract', { stdio: 'inherit' })

    log('✅ Circuit files generated successfully!', 'success')
    return true
  } catch (error) {
    log(`❌ Failed to generate circuit files: ${error.message}`, 'error')
    return false
  }
}

async function main() {
  log('🚀 Tornado Core Circuit File Generator', 'info')
  log('===================================', 'info')

  // Check which files are missing
  const missingFiles = files.filter((file) => {
    const filePath = path.resolve(circuitsPath, file)
    return !fs.existsSync(filePath)
  })

  if (missingFiles.length === 0) {
    log('✅ All required files are already present:', 'success')
    files.forEach((file) => {
      const filePath = path.resolve(circuitsPath, file)
      const stats = fs.statSync(filePath)
      const sizeMB = Math.round((stats.size / 1024 / 1024) * 100) / 100
      log(`  - ${file} (${sizeMB} MB)`, 'info')
    })
    return
  }

  log(`📋 Found ${missingFiles.length} missing files: ${missingFiles.join(', ')}`, 'warning')

  // Generate all circuit files
  const success = await generateCircuitFiles()

  if (success) {
    log('\n📊 Generated files:', 'success')
    files.forEach((file) => {
      const filePath = path.resolve(circuitsPath, file)
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        const sizeMB = Math.round((stats.size / 1024 / 1024) * 100) / 100
        log(`  ✅ ${file} (${sizeMB} MB)`, 'success')
      } else {
        log(`  ❌ ${file} (not found)`, 'error')
      }
    })
  } else {
    log('❌ Circuit file generation failed!', 'error')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { generateCircuitFiles }
