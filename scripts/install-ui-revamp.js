import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, '..', 'public', 'index.html');

const markers = [
  '<script src="/ui-revamp.js"></script>',
  '<script src="/ui-revamp-2.js"></script>',
  '<script src="/ui-next.js"></script>',
  '<script src="/ui-privacy.js"></script>',
  '<script src="/ui-priority.js"></script>',
  '<script src="/ui-gap-fixes.js"></script>',
  '<script src="/ui-compare-filters.js"></script>',
  '<script src="/ui-tour-fix.js"></script>',
  '<script src="/ui-signup-username.js"></script>',
  '<script src="/ui-schedule-stats.js"></script>',
  '<script src="/ui-identity.js"></script>'
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
