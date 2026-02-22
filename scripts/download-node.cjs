/**
 * Download portable Node.js runtime for Windows to bundle with Electron app.
 * This ensures the app works on systems without Node.js installed.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const nodeDir = path.join(root, 'build', 'node-runtime');
const nodeExe = path.join(nodeDir, 'node.exe');

// Node.js version to bundle (LTS version)
const NODE_VERSION = '20.18.0';
const NODE_ARCH = 'x64'; // or 'x86' for 32-bit

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function extractZip(zipPath, extractTo) {
  // Use PowerShell to extract zip on Windows
  try {
    const powershellCmd = `powershell -Command "Expand-Archive -Path '${zipPath.replace(/\\/g, '/')}' -DestinationPath '${extractTo.replace(/\\/g, '/')}' -Force"`;
    execSync(powershellCmd, { stdio: 'inherit' });
  } catch (err) {
    // Fallback: try using built-in Node.js zlib (requires additional handling)
    // For now, just throw the error
    throw new Error(`Failed to extract zip: ${err.message}`);
  }
}

async function run() {
  // Skip if already downloaded
  if (fs.existsSync(nodeExe)) {
    console.log('Node.js runtime already downloaded at', nodeExe);
    return;
  }

  console.log(`Downloading Node.js ${NODE_VERSION} for Windows ${NODE_ARCH}...`);

  const url = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-${NODE_ARCH}.zip`;
  const zipPath = path.join(root, 'build', `node-v${NODE_VERSION}-win-${NODE_ARCH}.zip`);
  const extractDir = path.join(root, 'build');

  // Create build directory
  if (!fs.existsSync(path.join(root, 'build'))) {
    fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  }

  try {
    // Download
    console.log('Downloading from', url);
    await downloadFile(url, zipPath);
    console.log('Download complete');

    // Extract
    console.log('Extracting...');
    await extractZip(zipPath, extractDir);
    console.log('Extraction complete');

    // Move node.exe to node-runtime directory
    const extractedNodeDir = path.join(extractDir, `node-v${NODE_VERSION}-win-${NODE_ARCH}`);
    if (!fs.existsSync(nodeDir)) {
      fs.mkdirSync(nodeDir, { recursive: true });
    }

    fs.renameSync(
      path.join(extractedNodeDir, 'node.exe'),
      nodeExe
    );

    // Keep only node.exe, remove everything else (including node_modules/npm)
    // to significantly reduce size as the standalone server doesn't need them.
    console.log('Keeping only node.exe in runtime...');

    // Cleanup
    fs.rmSync(extractedNodeDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    console.log('Node.js runtime ready at', nodeExe);
  } catch (err) {
    console.error('Failed to download Node.js:', err);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
