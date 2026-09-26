'use strict';
// Run after a cloud build has fetched payload/ from the upstream release and
// built the overlay add-on. `npm run payload` normally does this checking, but
// a cloud runner cannot run it: the DLSS files and the RenoDX add-ons it wants
// are found on a developer's disk, not downloaded. Everything that script would
// still be able to catch here is caught here instead, by the same rules.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const scanSource = require('../src/core/scan.js').scanSource;

const ROOT = path.resolve(__dirname, '..');
const PAYLOAD = path.join(ROOT, 'payload');
const problems = [];

// 1. A payload the app itself would accept. This is the probe main.js runs at
//    launch, so a build that passes here cannot hand somebody an app that opens
//    on "the files this app installs into games are missing".
const probe = scanSource(PAYLOAD);
if (!probe.ok) problems.push(`payload is not usable: ${probe.reason || 'unknown reason'}`);
else {
  console.log(`  payload: ${probe.payload.length} streamline files, add-on ${path.basename(probe.addon || '')}`);
  if (!probe.hasNeuralRendering) problems.push('nvngx_dlssnr.dll is missing - the add-on refuses to run without it');
  // Feeder is checked the way the app checks it: every file both architectures
  // need, and every file matching the digest this release pins.
  if (!probe.feeder.ok) problems.push('the Feeder in the payload is incomplete or is not the release this build pins');
  else console.log(`  Feeder ${probe.feeder.version}: complete and digest-verified`);
}

// 2. Both install routes ship one: ReShade's Addon build is half of what the
//    app does, and a build without it installs DLSS into nothing.
const reshade = fs.existsSync(PAYLOAD) && fs.readdirSync(PAYLOAD).find((f) => /^ReShade_Setup_.*_Addon\.exe$/i.test(f));
if (!reshade) problems.push('no ReShade_Setup_*_Addon.exe in payload/ - this build could not install ReShade');
else console.log(`  ReShade: ${reshade}`);

// 3. The overlay drives Feeder's sliders only while the binary it finds is the
//    one compiled into overlay/feeder-controls.hpp. That pin was left behind by
//    an upgrade once and every slider went quietly unavailable: nothing failed,
//    nothing was logged, the panel simply did nothing. An upstream payload and
//    this source tree can drift apart the same way, so refuse to build.
const feeder = path.join(PAYLOAD, 'feeder', 'dlss5-feed.addon64');
try {
  const text = fs.readFileSync(path.join(ROOT, 'overlay', 'feeder-controls.hpp'), 'utf8');
  const bytes = (text.match(/const unsigned char hash\[\]=\{([^}]+)\}/) || [])[1];
  const size = Number((text.match(/hash_matches\(module,\s*(\d+)/) || [])[1]);
  const pinned = bytes ? bytes.split(',').map((b) => b.trim().replace(/^0x/, '')).join('') : '';
  const actual = crypto.createHash('sha256').update(fs.readFileSync(feeder)).digest('hex');
  const actualSize = fs.statSync(feeder).size;
  if (!pinned || !size) problems.push('could not read the Feeder pin out of overlay/feeder-controls.hpp');
  else if (pinned !== actual || size !== actualSize) {
    problems.push([
      'the payload ships a different Feeder than the overlay is pinned to:',
      `  overlay  ${size} bytes  ${pinned}`,
      `  payload  ${actualSize} bytes  ${actual}`,
      '  The panel would load, and its sliders would stay unavailable - silently.'
    ].join('\n'));
  } else console.log(`  Feeder pin matches the overlay (${actualSize} bytes)`);
} catch (error) {
  problems.push(`Feeder pin check failed: ${error.message}`);
}

// 4. The overlay add-on is what a game loads to draw the panel at all.
const overlay = path.join(ROOT, 'overlay-bin', 'dlss5-lab-overlay.addon64');
if (!fs.existsSync(overlay)) problems.push('overlay-bin/dlss5-lab-overlay.addon64 is missing - run npm run overlay:build');
else console.log(`  overlay add-on: ${(fs.statSync(overlay).size / 1024).toFixed(0)} KB`);

if (problems.length) {
  console.error('\nPayload verification failed:\n');
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}
console.log('\nPayload verified.');
