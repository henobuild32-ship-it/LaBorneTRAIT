/* eslint-disable */
// Genère les icônes PWA de LaBorneTRAIT à partir du logo officiel.
// Usage : node generate-icons.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT = path.join('public', 'trait-logo.png');
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// ratio = part de la canvas occupée par le logo (le reste est du blanc plein)
async function makeSquare(size, ratio, outFile) {
  const inner = Math.round(size * ratio);
  const pad = Math.round((size - inner) / 2);
  await sharp(INPUT)
    .flatten({ background: WHITE })
    .resize(inner, inner, { fit: 'contain', background: WHITE })
    .extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: WHITE,
    })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  console.log('  ->', outFile, `${size}x${size}`);
}

async function generate() {
  if (!fs.existsSync(INPUT)) {
    console.error('Logo introuvable :', INPUT);
    process.exit(1);
  }

  console.log('Génération des icônes PWA à partir de', INPUT);
  await makeSquare(192, 0.94, path.join('public', 'icon-192x192.png'));
  await makeSquare(512, 0.94, path.join('public', 'icon-512x512.png'));
  await makeSquare(512, 0.68, path.join('public', 'icon-maskable-512.png'));
  await makeSquare(180, 0.88, path.join('public', 'apple-touch-icon.png'));
  console.log('Icônes générées.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
