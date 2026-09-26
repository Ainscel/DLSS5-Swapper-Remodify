'use strict';
// The in-game panel is drawn by Chromium, so it can render Chinese. The native
// side of the add-on (the status card and ReShade's own tab) cannot: ReShade
// hands ImGui a font atlas with no CJK glyphs, and Chinese there would come out
// as empty boxes. Those strings stay English on purpose - see overlay/README.md.
//
// English is the key, not an index. Markup passes the Chinese text beside it
// for readability, while values that arrive from the game over the bridge -
// RenoDX control names, Feeder field names, choice options - are looked up by
// the English text RenoDX and the Feeder actually publish.
(function () {
const zh = {
  // ---- panel chrome (overlay-panel.js) ----
  'DLSS 5 SWAPPER CONTROLS': 'DLSS 5 换装器控制',
  'DLSS 5 SWAPPER · INJECTED TOOLS': 'DLSS 5 换装器 · 注入工具',
  'PREVIEW': '预览',
  'CONNECTED': '已连接',
  'NOT CONNECTED': '未连接',
  'LIVE RESHADE': 'RESHADE 实时',
  'DISCONNECTED': '未连接',
  'Preview only': '仅预览',
  'RenoDX live': 'RenoDX 实时',
  'Waiting for RenoDX': '等待 RenoDX',
  'Shows DLSS 5 On/Off over the game': '在游戏画面上显示 DLSS 5 开/关',
  'DLSS ON': 'DLSS 开启',
  'ON-SCREEN STATUS': '屏幕状态显示',
  'GLOBAL CONTROLS': '全局控制',
  'Tone Intensity': '色调强度',
  'MODEL AUTOMASK': '模型自动遮罩',
  'SDK required': '需要 SDK',
  'DEVELOPER MASKING': '开发者遮罩',
  'Demo groups': '演示分组',
  'MODELS': '模型',
  'Preview selection': '预览选择',
  'MORE RENODX CONTROLS': '更多 RenoDX 控件',
  'FEEDER CONTROLS': 'FEEDER 控件',
  'NR STYLE': 'NR 风格',
  'Show RenoDX extras': '显示 RenoDX 扩展',
  'Show Feeder controls': '显示 Feeder 控件',
  'Live tools': '实时工具',
  'DLSS controls': 'DLSS 控件',
  'Preview: Feeder + RenoDX': '预览：Feeder + RenoDX',
  'Preview: RenoDX': '预览：RenoDX',
  'ReShade shader effects': 'ReShade 着色器效果',
  'On-screen status card': '屏幕状态卡片',
  // ---- demo group labels ----
  'Pitcher': '水罐',
  'Grapes': '葡萄',
  'Bottles': '瓶子',
  // ---- status notes ----
  'Waiting for game connection': '等待游戏连接',
  'RenoDX controls unavailable.': 'RenoDX 控件不可用。',
  'Unavailable': '不可用',
  'RenoDX character mask': 'RenoDX 角色遮罩',
  'Design preview; no game connection.': '设计预览；未连接游戏。',
  // ---- RenoDX control names (sent by renodx-ui-bridge.hpp) ----
  'Structure Intensity': '结构强度',
  'Global Tone Intensity': '全局色调强度',
  'Enable DLSS Neural Rendering': '启用 DLSS 神经渲染',
  'Automatic / Character Mask': '自动 / 角色遮罩',
  'Character/Skin Structure': '角色/皮肤结构',
  'Overall Intensity': '总体强度',
  'Local Tone Intensity': '局部色调强度',
  'Diffuse White (nits)': '漫反射白（尼特）',
  'Motion Scale X Multiplier': '运动缩放 X 倍数',
  'Motion Scale Y Multiplier': '运动缩放 Y 倍数',
  'NR UI Correction': 'NR UI 校正',
  'Enable Upscaling (WIP)': '启用超分（开发中）',
  'NR Preset': 'NR 预设',
  'NR Style': 'NR 风格',
  'Depth Convention': '深度约定',
  // ---- RenoDX choice options ----
  'Default': '默认',
  'Preset #1': '预设 #1',
  'Preset #2': '预设 #2',
  'Preset #3': '预设 #3',
  'Natural': '自然',
  'Cinematic': '电影感',
  'Use game NGX flag': '使用游戏 NGX 标志',
  'Force normal depth': '强制法线深度',
  'Force inverted depth': '强制反转深度',
  // ---- Feeder control names (feeder-controls.hpp + feedChoices) ----
  'Feeder enabled (original panel)': 'Feeder 启用（原始面板）',
  'Work resolution (%)': '工作分辨率 (%)',
  'Work sharpness': '工作锐度',
  'Motion scale X': '运动缩放 X',
  'Motion scale Y': '运动缩放 Y',
  'HDR contract': 'HDR 合约',
  'Depth convention': '深度约定',
  'Work upscale': '工作分辨率放大',
  'HDR10 bridge': 'HDR10 桥接',
  'HDR paper white (nits)': 'HDR 纸张白（尼特）',
  'Upscale (0 bilinear, 1 FSR1, 2 DLSS SR)': '放大方式（0 双线性，1 FSR1，2 DLSS SR）',
  'Depth convention (-1 auto, 0 normal, 1 inverted)': '深度约定（-1 自动，0 法线，1 反转）',
  'HDR10 bridge (-1 auto, 0 off, 1 on)': 'HDR10 桥接（-1 自动，0 关，1 开）',
  // ---- Feeder choice options ----
  'Auto': '自动',
  'Force SDR': '强制 SDR',
  'Force HDR': '强制 HDR',
  'Normal': '法线',
  'Inverted': '反转',
  'Bilinear': '双线性',
  'FSR 1': 'FSR 1',
  'DLSS SR (experimental)': 'DLSS SR（实验性）',
  'Off': '关',
  'On': '开',
  // ---- reasons reported by the native side ----
  'Feeder is not loaded': 'Feeder 未加载',
  'Unsupported Feeder binary (this build drives x64 v0.15.1)': '不支持的 Feeder 二进制（本构建仅支持 x64 v0.15.1）',
  'Feeder cfg reloads every 60 delivered frames. Work resolution/filter/sharpness and the HDR10 bridge: DX11 only. NR is separate.': 'Feeder 配置每交付 60 帧重新加载一次。工作分辨率/滤镜/锐度与 HDR10 桥接仅支持 DX11。NR 是独立的。',
  'Enable Feeder and select an active mode in its original page. Disabled/inert Feeder does not reload cfg.': '请在 Feeder 原始页面中启用 Feeder 并选择一个可用模式。已禁用/未生效的 Feeder 不会重新加载配置。',
  'Feeder cfg changed or write failed; retry': 'Feeder 配置已变更或写入失败；请重试',
  'Bridge is off': '桥接已关闭'
};
// Multi-word sentences are translated in place at the call site; the table
// above only carries whole labels, so anything missing falls back to English.
let lang = 'en';
window.overlaySetLang = code => { lang = /^zh/i.test(String(code || '')) ? 'zh' : 'en'; return lang; };
window.overlayLang = () => lang;
window.overlayT = (en, translation) => {
  if (lang !== 'zh') return en;
  if (translation !== undefined) return translation;
  return Object.prototype.hasOwnProperty.call(zh, en) ? zh[en] : en;
};
// Choice options arrive as one array; keep the index mapping intact so the
// value the panel sends back still means the same option to RenoDX.
window.overlayList = list => (lang === 'zh' && Array.isArray(list) ? list.map(item => window.overlayT(item)) : list);
// "Model A · Default" and friends: pick the template, then fill the parts, so
// the two languages can order the words differently.
window.overlayP = (en, translation, ...parts) =>
  window.overlayT(en, translation).replace(/\{(\d+)\}/g, (_, i) => (parts[i] === undefined ? '' : parts[i]));
})();
