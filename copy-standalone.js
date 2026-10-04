/* eslint-disable */
const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  console.log('📦 Starting cross-platform standalone build asset copy...');
  
  // 1. Copy .next/static to .next/standalone/.next/static/
  const staticSrc = path.join(__dirname, '.next', 'static');
  const staticDest = path.join(__dirname, '.next', 'standalone', '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    copyDirSync(staticSrc, staticDest);
    console.log('✅ Successfully copied .next/static to standalone folder.');
  }

  // 2. Copy public to .next/standalone/public/
  const publicSrc = path.join(__dirname, 'public');
  const publicDest = path.join(__dirname, '.next', 'standalone', 'public');
  if (fs.existsSync(publicSrc)) {
    copyDirSync(publicSrc, publicDest);
    console.log('✅ Successfully copied public to standalone folder.');
  }

  console.log('🎉 Standalone asset copy completed successfully!');
} catch (error) {
  console.error('❌ Failed to copy standalone assets:', error);
  process.exit(1);
}
