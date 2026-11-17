const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../apps/web/src/pages');
const files = fs.readdirSync(dir);
const calls = {};

files.forEach(f => {
  if (!f.endsWith('.tsx')) return;
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  // Match apiRequest patterns
  const re = /apiRequest[<>\w\[\]]*\s*\(\s*['"`]([^'"`$]+)['"`]/g;
  let match;
  const list = [];
  while ((match = re.exec(content)) !== null) {
    list.push(match[1]);
  }
  // also dynamic template strings
  const reTemp = /apiRequest[<>\w\[\]]*\s*\(\s*`([^`]+)`/g;
  while ((match = reTemp.exec(content)) !== null) {
    list.push(match[1]);
  }
  if (list.length) calls[f] = list;
});

console.log(JSON.stringify(calls, null, 2));
