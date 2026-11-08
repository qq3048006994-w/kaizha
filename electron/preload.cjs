// 桌面版预加载脚本：保持最小权限，游戏数据仍由浏览器 localStorage 保存在用户数据目录。
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('kaizha', {
  isDesktop: true,
  platform: process.platform,
})
