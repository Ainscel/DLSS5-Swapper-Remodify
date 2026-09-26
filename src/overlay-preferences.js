'use strict';
const fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
// The frame's bounds are the protocol's to state; a preference only chooses
// within them, so it asks rather than repeating the numbers.
const protocol=require('./overlay-protocol');
const events=new EventEmitter();
// `lang` mirrors the app's own language setting, which overlay-i18n.js turns
// into the panel's labels. Only Chinese changes anything today; every other
// code is carried through and read as English, so adding one costs nothing.
const defaults=()=>({enabled:true,theme:'green',hotkey:{key:119,mods:0},custom:null,lang:'en',uiScale:1});
function validKey(key){return Number.isInteger(key)&&((key>=48&&key<=90)||(key>=112&&key<=135)||[32,33,34,35,37,38,39,40,45,46].includes(key));}
// A custom theme is one accent colour plus a label; every other shade in the
// panel is derived from it, so there is nothing else to store or validate.
function validCustom(c){
  return c===null||c===undefined||(typeof c==='object'&&/^#[0-9a-f]{6}$/i.test(c.accent||'')&&
    typeof c.name==='string'&&c.name.trim().length>0&&c.name.length<=32);
}
function validate(v){
  if(!v||typeof v.enabled!=='boolean'||!['green','blue','purple','custom'].includes(v.theme)||!v.hotkey||!validKey(v.hotkey.key)||!Number.isInteger(v.hotkey.mods)||v.hotkey.mods<0||v.hotkey.mods>7)throw Error('Invalid overlay settings. Home and Escape are reserved; Windows-key shortcuts are not supported.');
  if(!validCustom(v.custom))throw Error('Invalid custom overlay theme. Pick a colour and give it a name.');
  // Selecting a theme that was never created would leave the panel unstyled.
  if(v.theme==='custom'&&!v.custom)throw Error('Create a custom theme before selecting it.');
  const custom=v.custom?{accent:v.custom.accent.toLowerCase(),name:v.custom.name.trim()}:null;
  // A file written before the panel had a language has no `lang`, and one
  // written by a newer build may name a language this build does not know.
  // Both read as English rather than refusing to open the overlay.
  const lang=typeof v.lang==='string'&&v.lang.length<=16?v.lang:'en';
  // How much of the panel to render, not how far to stretch it. The drawable
  // range belongs to the frame, so the protocol owns it and anything else -
  // missing, out of range, a string - reads as the default rather than
  // refusing to open the panel.
  const uiScale=protocol.scaleOf(v.uiScale);
  return {enabled:v.enabled,theme:v.theme,hotkey:{key:v.hotkey.key,mods:v.hotkey.mods},custom,lang,uiScale};
}
function read(dir){const file=path.join(dir,'overlay-preferences.json');return fs.existsSync(file)?validate(JSON.parse(fs.readFileSync(file,'utf8'))):defaults();}
function save(dir,patch){
  if(!patch||Object.keys(patch).some(k=>!['enabled','theme','hotkey','custom','lang','uiScale'].includes(k)))throw Error('Invalid overlay preference');
  const value=validate({...read(dir),...patch}),file=path.join(dir,'overlay-preferences.json'),temp=file+'.tmp';
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600});fs.renameSync(temp,file);
  events.emit('change',dir,value);return value;
}
module.exports={defaults,validate,validKey,read,save,events};
