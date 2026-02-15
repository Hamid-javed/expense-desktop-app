/**
 * Copy public and .next/static into .next/standalone so the standalone server
 * can serve static assets. Run after `next build` when using output: 'standalone'.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.error('No .next/standalone found. Run "next build" first.');
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

const publicDir = path.join(root, 'public');
const staticDir = path.join(root, '.next', 'static');
const standalonePublic = path.join(standaloneDir, 'public');
const standaloneStatic = path.join(standaloneDir, '.next', 'static');

if (fs.existsSync(publicDir)) {
  copyRecursive(publicDir, standalonePublic);
  console.log('Copied public to .next/standalone/public');
}
if (fs.existsSync(staticDir)) {
  copyRecursive(staticDir, standaloneStatic);
  console.log('Copied .next/static to .next/standalone/.next/static');
}
