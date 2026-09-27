# 可选场景编排

`build_v2.py --scene scene.json` 把 JSON 作为数据内嵌，无需修改渲染器。参考 [cats-scene.json](cats-scene.json)，它对应五猫实例，不带图像或音乐。

| 字段 | 用法 |
|---|---|
| motionVariant | 可选 `fold` / `dive` / `cube` / `bloom`，定义独立的空间、镜头和图层运动。不能与 families、accents、ending 混用。见 [motion-variants.md](motion-variants.md)。 |
| families | 与主体数相同的数组；每项 center=[x,y,z]、yaw=弧度、size=相对绘画大小。 |
| accents | 与主体数相同的数组；focus=[局部水平,局部竖直]，偏移镜头关注点；lift 为运镜抬升量，bank 为额外滚转弧度。可用空对象保留默认。 |
| alignedHoldSeconds | 每个到达点后保持所有层完全对齐的秒数；猫版为 1.2，省略或 0 保留原人物运镜。不得超过最短主体间隔的 45%。停留端点的速度归零，避免插值漂移；仅压缩后续穿层时间，音乐到达点和总长不变。 |
| bridgeOpacity | 0–1，连接笔触的固定透明度；细毛素材可调低，避免盖住主体。它不随影片时间改变。 |
| thread | true 时加入固定三维细毛线，可用于猫或其他需要连贯线索的画面；默认关闭。 |
| ending | 可选的三个片尾相机姿态，依次用于最后一段后部、收束起点、最后一帧；每项 eye、target 为三维坐标，roll 为弧度。不要指定时间键。 |
| outroTitle / outroSubtitle | 片尾短标题，不遮住主体。 |

局部 focus 的坐标原点是绘画中心，向右/向上为正，画幅通常宽约 3.46×size 个世界单位。橘猫爪子位于右下时可取 [0.7,-0.65]；耳朵在上方可取 [0,0.8]。这些数值依具体构图而变，不能把示例点位当成自动识别。

固定对齐视距为 6.2。任意修改布局后，先通过 `tools/inspect_motion.py --html ... --out qa/inspect --times 0 1.8 2.5 3.5 ...` 检查：每个主体的成立视点、近景掠过、旧新主体同时可见的拐角和结尾。该工具输出真实渲染联系表，不能代替动态播放。
