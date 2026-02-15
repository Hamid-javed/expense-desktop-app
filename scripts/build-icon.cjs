/**
 * Generate build/icon.ico from public/logo.png for Windows exe and desktop shortcut.
 * Run before electron-builder so the installer and shortcut use the app logo.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'public', 'logo.png');
const buildDir = path.join(root, 'build');
const iconPath = path.join(buildDir, 'icon.ico');

if (!fs.existsSync(logoPath)) {
  console.error('public/logo.png not found.');
  process.exit(1);
}

async function run() {
  let pngToIco;
  try {
    pngToIco = (await import('png-to-ico')).default;
  } catch (e) {
    console.error('png-to-ico not found. Install devDependency: npm i -D png-to-ico');
    process.exit(1);
  }

  const buf = await pngToIco(logoPath);
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(iconPath, buf);
  console.log('Wrote build/icon.ico from public/logo.png');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
