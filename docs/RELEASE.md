# Tornado Core Release Guide

This guide covers how to create and publish releases for the Tornado Core project. All release files are automatically generated during the build process - no pre-existing files are required.

## Quick Start

### Option 1: Automatic Release (Recommended)

```bash
# Create and push a release tag
git tag v2.1.0
git push origin v2.1.0
```

The GitHub Actions workflow will automatically:

1. Generate all circuit files
2. Build contracts and CLI
3. Run tests
4. Create GitHub release with all artifacts

### Option 2: Local Release Script

```bash
# Check if ready for release
npm run release:check

# Prepare and create release
npm run release 2.1.0
```

### Option 3: Manual GitHub UI

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Enter version (e.g., `v2.1.0`)
4. Click **Run workflow**

## File Generation Process

All release files are automatically generated during the build process:

### Circuit Files (Generated from `circuits/`)

- **`withdraw.json`** - Circuit definition (compiled from `circuits/withdraw.circom`)
- **`withdraw_proving_key.bin`** - Binary proving key (converted from JSON format)
- **`withdraw_proving_key.json`** - JSON proving key (generated during setup)
- **`withdraw_verification_key.json`** - Verification key (generated during setup)
- **`Verifier.sol`** - Solidity verifier contract (generated from verification key)
- **`tornado.params`** - Parameters file (copy of proving key in binary format)

### Build Process Steps

1. **Circuit Compilation**: `npm run build:circuit:compile`
2. **Key Generation**: `npm run build:circuit:setup`
3. **Binary Conversion**: `npm run build:circuit:bin`
4. **Contract Generation**: `npm run build:circuit:contract`

### Additional Files

- **`tornado-core-cli.js`** - Browser-compatible CLI bundle
- **`*_flat.sol`** - Flattened contract files
- **`*.tar.gz`** - Compressed archives of build directories

## Version Standards

Follow [Semantic Versioning](https://semver.org/):

- **Major** (`3.0.0`): Breaking changes
- **Minor** (`2.1.0`): New features, backwards compatible
- **Patch** (`2.0.1`): Bug fixes, backwards compatible
- **Pre-release** (`2.1.0-beta.1`): Development versions

## Environment Setup

### Required Dependencies

```bash
# Install Node.js dependencies
yarn install

# The build process will automatically generate all required files
npm run build:circuit
```

### File Verification

Check that all files are generated correctly:

```bash
npm run release:check
```

Expected output:

```
✓ build/circuits/withdraw.json (19.9MB)
✓ build/circuits/withdraw_proving_key.bin (13.8MB)
✓ build/circuits/withdraw_verification_key.json (0.0MB)
✓ build/circuits/Verifier.sol (0.0MB)
```

## Release Methods

### 1. Git Tag Method (Automatic)

```bash
# Ensure working directory is clean
git status

# Create and push tag
git tag v2.1.0
git push origin v2.1.0
```

### 2. Local Script Method

```bash
# Dry run to preview actions
npm run release:dry

# Create actual release
npm run release 2.1.0
```

Options:

- `--skip-tests` - Skip test execution
- `--skip-build` - Skip build process
- `--dry-run` - Show what would be done

### 3. Manual GitHub Actions

1. Navigate to repository **Actions** tab
2. Select **Release** workflow
3. Click **Run workflow**
4. Enter version and run

## Generated Release Content

Each release includes:

| File                             | Size     | Description                        |
| -------------------------------- | -------- | ---------------------------------- |
| `tornado.params`                 | ~14MB    | Proving parameters for zk-SNARK    |
| `withdraw.json`                  | ~20MB    | Circuit definition and constraints |
| `withdraw_proving_key.bin`       | ~14MB    | Binary proving key                 |
| `Verifier.sol`                   | ~9KB     | Solidity verifier contract         |
| `withdraw_verification_key.json` | ~4KB     | Verification key                   |
| `tornado-core-cli.js`            | Variable | Browser-compatible CLI             |

## Troubleshooting

### Build Failures

**Error**: `Circuit compilation failed`

```bash
# Clean and rebuild
rm -rf build/
npm run build:circuit
```

**Error**: `Missing ceremony keys`

```bash
# Download required keys
yarn download
```

### Test Failures

**Error**: `Ganache connection failed`

```bash
# Ensure port 8545 is free
kill $(lsof -ti:8545)
npm run ci:ganache:start
```

### Release Issues

**Error**: `Working directory not clean`

```bash
# Commit or stash changes
git add .
git commit -m "chore: prepare for release"
```

**Error**: `Invalid version format`

```bash
# Use proper semver format
npm run release v2.1.0  # ✓ Correct
npm run release 2.1.0   # ✓ Also correct
npm run release release-2.1.0  # ✗ Invalid
```

## Security Considerations

- Circuit files are generated deterministically
- No pre-existing secrets or keys are required
- All ceremony files are downloaded from trusted sources
- Build process is reproducible across environments

## Pre-Release Checklist

- [ ] All tests passing
- [ ] Version number updated
- [ ] Changelog updated
- [ ] Working directory clean
- [ ] Circuit files build successfully
- [ ] No linting errors

## Post-Release Checklist

- [ ] Release appears on GitHub
- [ ] All artifacts uploaded
- [ ] Download links working
- [ ] Documentation updated
- [ ] Community notified

## GitHub Permissions

Required repository permissions:

- **Contents**: Write (for creating releases)
- **Actions**: Write (for workflow execution)
- **Metadata**: Read (for repository access)

## Support

For release issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review GitHub Actions logs
3. Verify all dependencies are installed
4. Ensure Node.js version compatibility (>=24.0.0)
