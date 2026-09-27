---
name: parallax-ink-video
description: 将一张或多张有清楚主体的人像、宠物照片或绘画，制作成彩色手绘分层、镜头在共享三维空间穿梭重组的有声视频。用于“线稿拆开后从另一视角重新拼成主体”的效果，支持示例创作及用户图片。
---

# Parallax Ink Video

先做艺术底稿，再按绘画内容拆层，将笔层放入三维空间，最后用连续镜头和音乐生成真正的视频。已获用户认可的起点是约 19 秒、五主体的快速折返版；按新主体选择固定空间或运动笔层，设计不同变化。实例与验收范围见 [verified-example.md](references/verified-example.md)。

## 素材与艺术化

- 接受 1–8 个清楚主体，先保存来源。真实人物/宠物来自用户素材或已核对来源；用户允许举例时可以生成示例，并注明生成内容。群像和名画只提取实际存在的主体。
- 每个主体准备一张独立、方形、至少 512 像素的彩色手绘。保留可辨识特征，采用暖纸、石墨细线、疏密变化的排线及适合原图的冷暖颜色。照片需先通过图像编辑/生成能力艺术化；程序提边不能代替这个阶段。
- 多主体在姿态、大小和表情上形成差异。动物可用耳尖、胡须、爪子、毛色和视线设计构图；避免全部变成相同正面证件照。细毛和近景推荐 768 像素以上底稿/贴图。

## 工程与导出

复制自包含 [assets/starter](assets/starter) 到新项目，安装其中 requirements.txt、Playwright Chromium 和 FFmpeg。默认按下方选曲流程从 `music.shapeof.world` 获取适合当前视频的配乐，剪辑为 `assets/music.mp3`；用户指定或认可的已有配乐优先。执行：

```bash
python tools/layers_v2.py --art assets/art/a.png assets/art/b.png --names '主体一' '主体二' --subject-kind animal --size 768 --out-dir assets/layers
python tools/build_v2.py --mode generic --manifest assets/layers/manifest.json --audio assets/music.mp3 --out output/parallax-ink.html
python tools/render.py --html output/parallax-ink.html --audio assets/music.mp3 --output output/parallax-ink-720p.mp4 --width 720 --height 1280 --fps 30 --jobs 2
```

- `--subject-kind person|animal|object` 按实际主体选择，默认 person。animal 会保留成片毛发，避免逐根毛分层造成透明碎点；object 使用更宽的内容区域。它们是颜色/边缘分解，不是准确解剖分割。白毛、复杂背景和低对比素材需单独检查透明层。
- 默认每主体约 3.5 秒，片尾 1.34 秒。音乐须与总长匹配；`--block-seconds`、`--duration` 调整时长，`--arrivals 0 ...` 输入按实际音频确认的主体到达点。不要沿用旧版每人 6.4 秒的慢轮播默认值。
- 一图只做该主体的拆层、穿越和回看；多图可使用折返空间、翻页、纵深通道或正交房间。对齐视点下曲面笔层拼成完整绘画，侧向视点下分开。保持素材与笔层身份连续；动画方式按用户方向选择，淡化可以与真实空间位移配合。
- 通过 `--scene scene.json` 可安排主体大小/位置、关注特征、滚转、细线及片尾；字段和猫咪示例见 [scene-options.md](references/scene-options.md)。这些是可选艺术方向，默认人体示例不强加猫爪或毛线。
- 用户要多种转场时，使用 [motion-variants.md](references/motion-variants.md) 的四种独立空间方案。分别交付真实视频，并可做同步四宫格方便比较。实验方案与已认可的默认运镜分开保留。
- 确认短段真实运动后导出 1080×1920。HTML 内嵌贴图与音乐，可离线打开；`__renderAt(t)` 确定性采帧，并对快速掠过做短快门模糊。保留源图、分层、场景参数和最终 MP4。

## 运镜与声音

- 完整主体要留出可辨认的阅读时间。猫版采用 `scene.alignedHoldSeconds: 1.2`，对齐期间保持校准视点，再侧移拆开 → 近景掠过 → 看见拐角 → 下一主体对齐；快速穿层与对齐停留分别调节。拐角必须同时看见前一主体的侧面笔层与下一主体；不要用一次遮挡掩盖整图切换。
- 变化来自真实构图：小主体从大主体边缘露出，沿耳尖向上转，贴近爪子掠过，最后回到完整表情。静态底稿的抬爪/打哈欠是姿态，不宣称为动物肢体逐帧动画。
- 默认配乐来源为 `https://music.shapeof.world`。先读其 `llms.txt`，再按 [music-selection.md](references/music-selection.md) 从实际曲库索引选择、核对并下载；不要求用户先提供音乐，也不把示例中的一首曲子固定用于所有图片。用户认可且合适的现有音乐延续至片尾；被否定的旧曲要换。不要从参考片提取音乐。
- 以实际音频的节奏安排到达/掠过/收束，曲库 BPM 仅是估计。保存剪辑起点和卡点依据；峰值检测与自动审核不能冒充人工试听。结尾保留自然收束或做合适淡出，不能提前无声或生硬截断。
- 配音仅在用户需要时添加。先用同一句短文、无音乐和无变速的音频让用户试听；选定音色后生成全文，按实际配音调整字幕，并在说话时降低配乐。若环境有 `mj-tts` 可复用；没有时使用可用 TTS，不把该私有工具或密钥当作 Skill 的运行前提。当前人物＋猫咪示例的用户选用了白桦，其他视频不强制继承此选择。

## 验收与交付

运行 `python tools/verify_v2.py --html output/parallax-ink.html --out qa`，检查基础网格、确定性、完整停留、离线播放/跳转/拖动。固定空间模式检查世界坐标不变；翻页和散层模式检查实际变换与配置一致，不把它们报告为固定世界几何。用 `__setLayerVisibility('cool-shadow')` 等独立查看图层，确认没有纸白矩形或完整展示时的特征丢失。

再检查实际 MP4 的 ffprobe 信息、全片解码、开始/每次转向/结尾的连续帧及音轨完整性；有听觉能力时实际试听，否则明示缺口。交付可播放 MP4、源码/HTML 和简短验证结果。区分工程通过、已看画面、已试听和用户认可；不承诺任意输入都能自动达到同等艺术质量。
