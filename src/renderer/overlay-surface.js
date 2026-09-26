'use strict';
// The surface the game receives. Preferences arrive once the window is up, so
// the first paint is English and the panel is rebuilt if the app's language is
// Chinese: every label is baked into the DOM at mount time, and a live panel
// cannot be re-labelled in place without losing the controls it just wired.
const root = document.getElementById('panel');
const mount = () => { window.mountOverlayPanel(root); window.mountOverlayLive(root); };
let previousLang = 'en';
mount();
window.overlayRuntime.onPreferences(value => {
  // overlaySetLang applies and reports back; a change means the labels in the
  // DOM are now the wrong language and the panel has to be built again.
  if (window.overlaySetLang && window.overlaySetLang(value.lang) !== previousLang) {
    previousLang = window.overlayLang();
    mount();
  }
  window.applyOverlayTheme(root, value);
  const k = value.hotkey.key, name = k >= 112 ? `F${k - 111}` : ({ 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down', 45: 'Insert', 46: 'Delete' }[k] || String.fromCharCode(k));
  root.dataset.overlayHotkey = [value.hotkey.mods & 1 ? 'Ctrl' : '', value.hotkey.mods & 2 ? 'Alt' : '', value.hotkey.mods & 4 ? 'Shift' : '', name].filter(Boolean).join(' + ');
  const footer = root.querySelector('.ol-live-hotkey');
  if (footer) footer.textContent = window.overlayP
    ? window.overlayP('{0}: show/hide · Drag header: move · Esc: close · Home: original tools', '{0}：显示/隐藏 · 拖动标题栏：移动 · Esc：关闭 · Home：原始工具', root.dataset.overlayHotkey)
    : `${root.dataset.overlayHotkey}: show/hide · Drag header: move · Esc: close · Home: original tools`;
});
