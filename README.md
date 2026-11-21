# PixelSweep · 软玻璃休闲像素磁盘清理工具

面向 **Windows 10/11** 与 **macOS (Apple Silicon + Intel 通用)** 的轻量化原生桌面清理工具（基于 Tauri v2 + Rust）。

## 核心特性
1. **苹果风软玻璃磨砂 UI**：macOS 调用原生 `NSVisualEffectView (HudWindow)` + 透明叠加标题栏；Windows 自动调用原生 `Mica / Acrylic` 磨砂特效，支持浅霜玻璃与暗夜磨砂双主题切换。
2. **多策略安全清理 + 权限报警审核**：
   - 分项扫描用户临时目录、浏览器缓存、显卡着色器/开发工具缓存、系统级目录及大文件雷达，支持自定义任意目录深度排查。
   - **后端硬编码系统核心目录防误删护栏**，禁止触碰 Windows `System32/WinSxS` 及 macOS `/System` 等核心区。
   - 清理前强制触发**安全审视与权限报警弹窗**，支持「先移入系统回收站/废纸篓」或「直接彻底删除」，并附带独立「清空系统回收站/废纸篓」按钮。
3. **内置星露谷田园风像素小人动画**：纯代码 Canvas 零依赖绘制，自动跟随状态切换（听歌晃动飘音符 / 举放大镜扫盘 / 权限报警审视 / 挥扫帚清扫扬尘 / 完成庆祝）。
4. **本地音乐文件夹休闲播放器**：默认扫描系统 `Music` 文件夹（支持随时切换任意本地目录），支持 MP3 / FLAC / WAV / M4A / OGG，边听歌边清扫。

## 云端自动打包（无需本地配环境）
将本项目推送到你的 GitHub 仓库后，执行以下任一方式即可在 5–10 分钟内于 **Releases** 页面直接下载 Windows `.exe`/`.msi` 与 macOS Universal `.dmg` 安装包：
1. 推送版本标签：`git tag v1.0.0 && git push origin v1.0.0`
2. 或在仓库 **Actions** 页面选择 `Build & Release PixelSweep` 点击 **Run workflow**。
