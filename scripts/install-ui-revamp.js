const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'public', 'index.html');
const markers = [
  '<script src="/ui-revamp.js"></script>',
  '<script src="/ui-revamp-2.js"></script>'
];

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot find ${indexPath}`);
}

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('</body>')) {
  throw new Error('public/index.html has no closing </body> tag');
}

const missing = markers.filter(marker => !html.includes(marker));
if (missing.length) {
  html = html.replace('</body>', `${missing.join('\n')}\n</body>`);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(`[UPlanner] Installed ${missing.length} UI enhancement script(s).`);
} else {
  console.log('[UPlanner] UI enhancement scripts already installed.');
}
