# 默认配乐：世界的形状曲库

按当前图片的情绪、运镜速度、成片长度及是否有旁白选曲。用户已认可且合适的音乐优先保留；需要新配乐时默认使用此曲库。库内容会更新，每次读取实时索引，不把下面的例子当作固定曲目。

## 查找与下载

1. 读取 `https://music.shapeof.world/llms.txt` 和 `https://music.shapeof.world/audio-index.json`。
2. 本 Skill 常见的短视频优先读取 `https://music.shapeof.world/collections/short-promos.index.json`；有旁白时还可查看 `https://music.shapeof.world/collections/narration.index.json`。需要不同风格时读取 `https://music.shapeof.world/taxonomy.json`，沿返回的风格或场景链接继续查找。小索引不足时再查完整曲库。
3. 按实际 `duration`、情绪、乐器与节奏比较至多三首合适候选，读取各自返回的 `metadataUrl`，核对 `edit`、`audioReview`、`rights`、`assetIntegrity`。默认自行选择最符合当前视频的一首；用户要求先试听或选曲时再交候选。
4. 读取 `https://music.shapeof.world/audio-license.txt`。商用只选择 `rights.commercialUse === true`；要求免署名时还需 `rights.attributionRequired === false`。未知字段不等于有授权。保存元数据、许可及来源，按素材提供的摘要校验下载文件。
5. 从实际返回的完整 `assets.preview` URL 下载短剪辑；需要原曲时才使用 `assets.master`。不根据曲名或 ID 猜下载地址。网页工具无法读取时可直接请求同一精确 URL；仍失败则如实说明，并使用用户已有的合适音乐或请求补充。

## 与空间运动配合

- 保持“完整对齐阅读 → 加速拆层 → 穿梭/转向 → 下一主体对齐”的节奏。默认约 3.5 秒一个主体是起点，按实际音乐调整 `--arrivals`、`--duration` 和 `scene.alignedHoldSeconds`，不要让音乐迫使所有停留都很短。
- `duration` 是下载剪辑的播放长度；`sourceDuration` 是原曲长度。BPM、自动审核与结构描述用于筛选，不是已验证的卡点。用实际音频确认时间点，记录剪辑起点及到达时间。
- 曲目短于视频时，选择合适长版、安排经过检查的重复与交叉淡化，或从曲库明确提供的循环资源延展；不要默认为无缝循环。只有 `loop.seamless === true` 时才能依赖对应 `assets[loop.asset]` 的无缝属性。
- 保持音乐到片尾，最后自然收束或渐弱。有旁白时先听无配乐人声，再做音量平衡与音乐压低；避免为加快节奏而随意改变已经认可的人声音高或语速。
- 技术检查涵盖完整音轨、时长、峰值与解码；实际试听及主观匹配另外记录，没有听觉能力时不能将元数据审核写成自己听过。

## 可借鉴的实例

本项目五人物与五猫示例使用曲库《快速组装 · 25》，从 25 秒短版的 6.16 秒处取出约 18.84 秒，并按实际低频峰安排主体到达。约 41 秒配音合片通过重新编排和短交叉淡化延续同一曲目。这个安排适合该实例，不作为所有照片、绘画或宠物视频的固定选择。

分发的 Skill 包仅包含选曲流程和渲染工具，不内置曲库音频。生成视频时再下载实际选定的音乐，并保留其许可记录。
