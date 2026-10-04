/* eslint-disable */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('c:/FullAZ/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // matches setX(y || [])
  content = content.replace(/set([A-Z][a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_.]+)\s*\|\|\s*\[\]\s*\)/g, (match, p1, p2) => {
    changed = true;
    return `set${p1}(Array.isArray(${p2}) ? ${p2} : [])`;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
