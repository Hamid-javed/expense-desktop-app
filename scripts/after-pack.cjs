const { rcedit } = require('rcedit');
const path = require('path');
const fs = require('fs');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.resolve(__dirname, '..', 'build', 'icon.ico');

  if (!fs.existsSync(exePath)) {
    console.warn('afterPack: exe not found:', exePath);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn('afterPack: icon not found:', iconPath);
    return;
  }

  await rcedit(exePath, { icon: iconPath });
  console.log('afterPack: icon embedded into', exeName);
};
