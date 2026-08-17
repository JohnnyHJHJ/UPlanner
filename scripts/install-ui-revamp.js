const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'public', 'index.html');
const marker = '<script src="/ui-revamp.js"></script>';

if (!fs.existsSync(indexPath)) {
  throw new Error(`Cannot find ${indexPath}`);
}

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes(marker)) {
  if (!html.includes('</body>')) {
    throw new Error('public/index.html has no closing </body> tag');
  }
  html = html.replace('</body>', `${marker}\n</body>`);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[UPlanner] Installed unified People/Search UI revamp.');
} else {
  console.log('[UPlanner] Unified People/Search UI revamp already installed.');
}
