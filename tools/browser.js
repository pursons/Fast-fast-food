// Petit utilitaire pour lancer Chromium avec Playwright (tests de fumée / captures d'écran)
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
exports.launch = () => pw.chromium.launch({
  executablePath: process.env.CHROME_PATH || (require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined),
  args: ['--no-sandbox'],
});
exports.URL = process.env.GAME_URL || 'http://localhost:8123/index.html';
exports.SHOTS = process.env.SHOTS_DIR || path.join(require('os').tmpdir(), 'ffrp-shots') + '/';
require('fs').mkdirSync(exports.SHOTS, { recursive: true });
