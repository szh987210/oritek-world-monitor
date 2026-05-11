const fs = require('fs');
const ts = Date.now().toString(36);
const htmlPath = 'dist/index.html';
if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html not found! Run build first.');
  process.exit(1);
}
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/(assets\/index-[^."]+\.(?:js|css))/g, '$1?t=' + ts);
fs.writeFileSync(htmlPath, html);
console.log('Cache-bust applied: t=' + ts);
// Show the changed lines
html.split('\n').forEach(line => {
  if (line.includes('assets/')) console.log(line.trim());
});
