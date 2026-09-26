'use strict';
// The panel's size is a contract with two ends: the app renders a frame at some
// width and the add-on accepts it or drops the connection. A disagreement does
// not look like an error - the panel simply never appears, and the game shows
// nothing about why - so the numbers are held together here rather than trusted
// to stay in step across a C++ file and a JavaScript one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const protocol = require('../src/overlay-protocol');
const preferences = require('../src/overlay-preferences');

test('a larger size renders the panel larger instead of stretching it', () => {
  assert.equal(protocol.widthFor(1), protocol.WIDTH, 'the default is the panel as it was');
  assert.equal(protocol.widthFor(2), protocol.WIDTH * 2);
  assert.equal(protocol.widthFor(protocol.MAX_SCALE), Math.round(protocol.WIDTH * protocol.MAX_SCALE));
});

test('a size nobody could draw reads as the default', () => {
  // A settings file can hold anything: written before the setting existed,
  // hand-edited, or from a build with a different range.
  for (const value of [undefined, null, '2', NaN, Infinity, 0, 0.1, 9, -1]) {
    assert.equal(protocol.scaleOf(value), 1, `${String(value)} is not a drawable size`);
  }
});

test('a frame is accepted at any drawable width and refused outside it', () => {
  const small = Buffer.alloc(protocol.MIN_WIDTH * 10 * 4);
  const wide = Buffer.alloc(protocol.MAX_WIDTH * 10 * 4);
  assert.equal(protocol.frame(small, protocol.MIN_WIDTH, 10, 1).readUInt32LE(12), protocol.MIN_WIDTH);
  assert.equal(protocol.frame(wide, protocol.MAX_WIDTH, 10, 1).readUInt32LE(12), protocol.MAX_WIDTH);
  assert.throws(() => protocol.frame(small, protocol.MIN_WIDTH - 1, 10, 1), /Invalid overlay frame/);
  assert.throws(() => protocol.frame(wide, protocol.MAX_WIDTH + 1, 10, 1), /Invalid overlay frame/);
  // The old fixed 534 is still inside the range, so an app that has not been
  // updated, or a size left at the default, keeps working.
  assert.equal(protocol.frame(Buffer.alloc(protocol.WIDTH * 10 * 4), protocol.WIDTH, 10, 1).readUInt32LE(12), protocol.WIDTH);
});

test('the add-on accepts exactly the widths the app can send', () => {
  const source = fs.readFileSync(path.join(__dirname, '../overlay/overlay.cpp'), 'utf8');
  const number = name => Number((source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`)) || [])[1]);
  assert.equal(number('min_frame_width'), protocol.MIN_WIDTH, 'the app could render a frame the add-on drops');
  assert.equal(number('max_frame_width'), protocol.MAX_WIDTH, 'the add-on would drop a frame at the largest size');
  assert.equal(number('max_height'), protocol.MAX_HEIGHT, 'a tall panel at a large size would be refused');
});

// The rest drives the bridge itself. Outside Electron, require('electron')
// hands back a path string, so its ipcMain listeners are stubbed before the
// bridge is loaded - the same shape overlay-bridge-takeover.test.js uses.
const net = require('node:net');
const electronPath = require.resolve('electron');
require.cache[electronPath] = {
  id: electronPath, filename: electronPath, loaded: true, children: [], paths: [],
  exports: { ipcMain: { on() {}, removeListener() {} } }
};
const startBridge = require('../src/overlay-bridge.js');

// Records the paint handler and what was sent to the page, and pretends the
// panel laid out to 320 points.
class PaintedWindow {
  constructor() {
    this.handlers = {};
    this.sent = [];
    this.contentSize = null;
    this.webContents = {
      on: (name, fn) => { this.handlers[name] = fn; }, once() {}, setFrameRate() {},
      invalidate() {}, send() {}, setWindowOpenHandler() {}, enableDeviceEmulation() {},
      sendInputEvent: event => this.sent.push(event),
      executeJavaScript: async () => 320,
      isDestroyed: () => false
    };
  }
  loadFile() { return Promise.resolve(); }
  setContentSize(width, height) { this.contentSize = { width, height }; }
  on() {}
  destroy() { this.destroyed = true; }
  isDestroyed() { return Boolean(this.destroyed); }
}

const settle = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
const packet = (action, x, y, value) => {
  const buffer = Buffer.alloc(20);
  [protocol.INPUT_MAGIC, action, x, y, value].forEach((n, i) => buffer.writeInt32LE(n | 0, i * 4));
  return buffer;
};
// A stand-in for the image Chromium hands the paint handler: it reports the
// raster size the window produces and can be resized to the frame's.
const paintedImage = (width, height) => ({
  getSize: () => ({ width, height }),
  resize: ({ width: w, height: h }) => ({
    getSize: () => ({ width: w, height: h }),
    toBitmap: () => Buffer.alloc(w * h * 4)
  })
});

test('a larger panel size reaches the game as a larger frame', async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-swapper-scale-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  fs.writeFileSync(path.join(userData, 'overlay-preferences.json'),
    JSON.stringify({ enabled: true, theme: 'green', hotkey: { key: 119, mods: 0 }, custom: null, uiScale: 2 }));
  let window = null;
  const live = await startBridge({ BrowserWindow: class extends PaintedWindow { constructor() { super(); window = this; } }, userData });
  t.after(() => live.close());

  // The panel lays out at 320 points, so at 2x it is rendered 640 pixels tall.
  assert.deepEqual(window.contentSize, { width: protocol.WIDTH * 2, height: 640 },
    'the surface is rendered at the size rather than stretched to it');

  const socket = await net.connect(live.pipeName);
  await new Promise(resolve => socket.on('connect', resolve));
  socket.write(packet(0, 0, 0, protocol.HELLO_VALUE));
  await settle();

  // The raster comes back bigger than the frame on a scaled desktop, which is
  // what keeps the text sharp: it is always reduced, never enlarged.
  const frames = [];
  socket.on('data', data => frames.push(data));
  window.handlers.paint(null, null, paintedImage(protocol.WIDTH * 4.5, 1440));
  await settle();

  // The hello is answered before anything else, so the frame is what follows
  // that reply on the wire.
  const buffer = Buffer.concat(frames);
  const frame = buffer.subarray(buffer.readUInt32LE(0) === protocol.FRAME_MAGIC ? 0 : protocol.helloReply(protocol.HELLO_VALUE).length);
  assert.ok(frame.length > 24, 'a frame reached the game');
  assert.equal(frame.readUInt32LE(0), protocol.FRAME_MAGIC);
  assert.equal(frame.readUInt32LE(12), protocol.WIDTH * 2, 'the frame is the size that was asked for');
  assert.equal(frame.readUInt32LE(16), 640, 'and so is its height');
  assert.equal(frame.readUInt32LE(20), protocol.WIDTH * 2 * 640 * 4);

  // A pointer over the panel arrives in frame pixels, because that is what the
  // add-on draws and hit-tests. The page is laid out in the panel's own 534, so
  // it has to come back down or every click lands somewhere else.
  socket.write(packet(1, protocol.WIDTH * 2, 640, 0));
  await settle();
  const move = window.sent.filter(e => e.type === 'mouseMove').pop();
  assert.ok(move, 'the move reached the page');
  assert.deepEqual({ x: move.x, y: move.y }, { x: protocol.WIDTH, y: 320 }, 'in the layout\'s own coordinates');
});

test('the size reaches a running panel without a restart', async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-swapper-live-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  let window = null;
  const live = await startBridge({ BrowserWindow: class extends PaintedWindow { constructor() { super(); window = this; } }, userData });
  t.after(() => live.close());
  assert.equal(window.contentSize.width, protocol.WIDTH, 'it starts at the panel\'s own size');
  const { events } = require('../src/overlay-preferences');
  events.emit('change', userData, { enabled: true, theme: 'green', hotkey: { key: 119, mods: 0 }, custom: null, uiScale: 1.5 });
  assert.equal(window.contentSize.width, protocol.WIDTH * 1.5, 'and follows the choice as it is made');
});

test('a preferences file written before the size existed still opens', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-overlay-size-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'overlay-preferences.json'),
    JSON.stringify({ enabled: true, theme: 'green', hotkey: { key: 119, mods: 0 }, custom: null }));
  assert.equal(preferences.read(dir).uiScale, 1, 'the panel opens at its own size rather than refusing');
  assert.equal(preferences.save(dir, { uiScale: 2 }).uiScale, 2);
  assert.equal(preferences.read(dir).uiScale, 2, 'and the choice survives a reload');
  // An undrawable size falls back instead of refusing to save: the file, not
  // the person, is what got it wrong.
  assert.equal(preferences.save(dir, { uiScale: 99 }).uiScale, 1);
  assert.equal(preferences.read(dir).uiScale, 1);
});
