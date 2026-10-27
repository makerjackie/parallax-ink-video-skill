# Parallax Ink Video Skill

将有清晰主体的照片或绘画制作成彩色手绘分层视频：镜头在同一个三维绘画空间中穿梭，笔层从不同视角散开、翻转、重组。可用于人物、宠物和其他主体；实际效果需要根据输入图像做艺术化处理与画面检查。

## 安装

将本仓库克隆到 Codex 的 Skill 目录：

```bash
git clone https://github.com/makerjackie/parallax-ink-video-skill.git ~/.codex/skills/parallax-ink-video
```

也可以下载 [v1.0.0 压缩包](https://assets.makerjackie.com/skills/parallax-ink-video/v1.0.0/parallax-ink-video-v1.0.0.zip)，解压后将 `parallax-ink-video/` 放入 Skill 目录。

完整创作流程见 [SKILL.md](SKILL.md)。`assets/starter/` 是可复制的渲染工程，`references/` 提供音乐选择、场景配置、转场方案和已验证示例说明。

## 基本流程

1. 准备 1–8 张有清楚主体的输入图像，将每个主体艺术化为独立的彩色手绘底稿。程序分层不能替代这一创作步骤。
2. 将 `assets/starter/` 复制到项目目录，安装 `requirements.txt`、Playwright Chromium 和 FFmpeg。
3. 先阅读 [`music.shapeof.world/llms.txt`](https://music.shapeof.world/llms.txt)，按 [选曲说明](references/music-selection.md) 选择适合画面的音乐；用户认可的现有配乐可以继续使用。
4. 用工具生成笔层、构建场景并渲染视频：

```bash
python tools/layers_v2.py --art assets/art/a.png assets/art/b.png --names '主体一' '主体二' --subject-kind animal --size 768 --out-dir assets/layers
python tools/build_v2.py --mode generic --manifest assets/layers/manifest.json --audio assets/music.mp3 --out output/parallax-ink.html
python tools/render.py --html output/parallax-ink.html --audio assets/music.mp3 --output output/parallax-ink-720p.mp4 --width 720 --height 1280 --fps 30 --jobs 2
```

可选的 `fold`、`dive`、`cube`、`bloom` 空间转场见 [转场说明](references/motion-variants.md)。最终交付前应检查实际视频的画面、完整停留、转场连续性及声音。

## 使用边界

- 本仓库提供 Skill 指令和渲染工具，不包含示例人物照片、猫咪图片、音乐文件或已渲染影片。
- 彩色手绘底稿需要图像生成或编辑能力；复杂背景、白毛和低对比图像可能需要人工调整分层。
- 三维效果来自透明绘画层与镜头透视，不是从单张照片恢复真实三维模型。
- [已验证示例](references/verified-example.md) 只说明做过的有限测试，不保证任意图像自动得到同等效果。

## 免费开源

本 Skill 与原创渲染工具以 MIT 许可证免费开源，见 [LICENSE](LICENSE)。模型额度及外部素材费用自备，第三方素材遵循各自许可。
