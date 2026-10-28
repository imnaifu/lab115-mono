# survivors

硅谷幸存者 —— Godot 4 做的割草类 roguelike（Vampire Survivors 风）。武器全自动攻击，你只管走位、捡经验、升级三选一，躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。中英双语，电脑和手机（触屏摇杆 / 陀螺仪）都能玩。

线上：<https://survivors.lab115.com>。这个目录是游戏的 Godot 工程；上一级 `apps/survivors/` 的 Dockerfile 在部署时从这里导出 Web 版并用 nginx 提供（见那里的 README）。

```bash
brew install --cask godot                     # Godot 4.7
godot --path apps/survivors/game              # 直接玩
godot -e --path apps/survivors/game           # 用编辑器打开
```

## 玩法

- **操作**：WASD / 方向键 / 手柄左摇杆移动；手机按住屏幕任意处拖动（虚拟摇杆），或在「设置」里打开陀螺仪后倾斜手机（可选，默认关，默认用手指）。陀螺仪左右以真水平为准；前后以开局 / 从暂停回来时拿手机的角度为准（取开头 0.5 秒的平均），玩的时候右上角的手机按钮可随时重新校准。Esc / P / 右上角按钮暂停；升级时按数字键或点卡片；暂停或结束时按 R 重开。窗口失焦会自动暂停。
- **武器**（各 5 级）：回车键（敲最近的敌人，开局自带）、复制粘贴（朝面向连发，能穿过敌人）、无人机（飞出去追着附近的敌人撞，撞完弹开再找下一个）、云端部署（从云上劈屏幕里的敌人；必中，所以道数和伤害压得比别的低）、机械键盘（上抛砸落、无限穿透）、Wi-Fi 信号（身边持续伤害并推开）。无人机管中距离的散兵，Wi-Fi 管贴身的。
- **被动**（一局最多带 6 种，各 5 级）：加数值的有冰美式（伤害）、降噪耳机（减伤）、撸铁（生命上限）、电动滑板（移速）、双屏显示器（冷却）、人脉名片（拾取范围）、工位绿植（回血）；有自己玩法的有股票期权（拿到后每撑 1 分钟伤害再涨一点，越早拿越赚）、背锅侠（挨打时按受到伤害的几倍炸伤身边的怪）、降本增效（打死的怪有几率爆炸，能连环炸）、开源项目（打死怪有几率留下一个小炮台打 8 秒）、站会（每隔一阵震开并定住身边的怪）、午休（站着不动 1 秒后快速回血，头上冒 Zz）、猎头电话（升级时多给 1 个选项，最多 2 级）。这几个的逻辑在 `perks.gd`。
- **掉落**：经验星星（蓝 / 绿 / 金按数值分档，要走近才会被吸过来，捡到才加经验；每台设备第一次掉星星时会提示一次）、珍珠奶茶回 30 血、磁铁吸来全图经验、boss 必掉融资钱袋（免费升级一次）。
- **地图**：按真实湾区排布的无限街区 —— 起点在帕洛阿尔托 / 山景城（科技园区、Caltrain、斯坦福钟楼，楼顶挂着 Pear、Goggle、Beta、Envy、NUTFLIX、LinkedOut 这些恶搞招牌），往北是旧金山（维多利亚排屋、泛美金字塔、Sailsforce 塔、金门大桥、叮当车和无人车），往南是圣何塞（西班牙红瓦房），往西是 Sand Hill Road 的金色山丘和红杉，往东是盐田和海湾。路口的街名牌用真实街名（El Camino Real、University Ave、Sand Hill Rd、US-101……）。楼只有底座（沿正面墙一条 24 像素深）挡路，楼身可以绕到后面去，人在楼后时楼会变半透明；草地上的树干和海水也挡路，楼缝里的行道树不挡。一排楼之间至少留 36 像素的缝，最大的 boss 也挤得过去。玩家和怪物都过不去（404 幽灵除外，它们穿墙）；武器的投射物从楼上飞过。怪被楼挡住时按寻路图（`flow_field.gd`）绕过去，不会贴着墙卡住。右上角小地图显示整个湾区、你的位置、当前屏幕范围和 boss（红点），下面写着所在的区；地图往北、南、西是无限的，只有东边的海走不过去。
- **敌人节奏**：开局 30 秒只有慢吞吞的 Bug，之后加入又快又会拐的消息红点 → 未读邮件、会议邀请、404 幽灵（会穿过怪群）→ 技术债、宕机服务器。小怪不多（10 分钟时每秒刷约 6 只），压力主要来自每分钟一个的 boss：1:00 祖传技术债、2:00 主库宕机（这两个是放大的精英怪），3:00 裁员通知（每隔几秒原地蓄力、亮出红色预警通道，然后沿通道冲过去），4:00 Deadline，5:00 AI 大模型，6:00 投资人（每隔几秒在身边召出一圈会议邀请），7:00 起每个 boss 都带新招：7:00 屎山代码（身边不停冒 Bug，打死后裂成 3 坨小屎山），7:30 需求变更（先在你前进方向上亮红圈，然后闪现过去），8:00 P0 线上事故（原地蓄力，向一圈方向发射告警弹，楼能挡子弹），9:00 老板画饼（朝你要去的地方扔饼，落点先出阴影）+ AI 大模型。场上已有 3 个 boss 没打掉时，下一个 boss 等有 boss 倒下再出场（包围圈照常），免得打不过的人被越压越多。boss 在场时屏幕上方显示名字、血条和血量（同时有几个就显示「+N」）。前 3 分钟刷怪打折（开局是正常速率的 60%，3:00 回到满速），前 4 次升级所需经验也更少（3 / 7 / 13 / 20）。1:30 / 3:30 / 6:30 / 8:30 有包围圈事件。
- **血量**：人物脚下的血条里直接写着当前 / 上限血量。
- **设置**：开始画面和暂停页的「设置」里切换中文 / English、开关音效和音乐；手机上还有屏幕方向（竖屏 / 横屏）和陀螺仪开关；选择存在 `user://settings.cfg`（网页版在浏览器的 IndexedDB 里）。没选过语言的一律先显示中文。
- **横竖屏**：手机默认竖屏，布局跟着手机方向走（竖着拿是竖屏布局，横过来是横屏布局），这是同类手游（Vampire Survivors、弹壳特攻队）的默认做法，适合单手拇指操作。设置里选「横屏」的话，竖着拿时整个游戏（连加载页）转 90° 铺满屏幕，把手机横过来就是正的，竖屏锁定开着也行。电脑一律横屏，窗口比宽还高时加上下黑边。较长的屏幕会多看到一点视野。

## 结构

```
project.godot          # 逻辑分辨率 640×360（手机竖拿时以 360×640 为基准），canvas_items + 非整数缩放，SVG 按 4 倍导入
scenes/main.tscn       # 只有一个挂着 game.gd 的根节点，其余都在代码里创建
scripts/
├── game.gd            # 一局的总控：分层、空间网格、敌人/掉落 tick、经验与升级、胜负、横竖屏切换
├── player.gd          # 移动（键盘 + 触屏摇杆 + 陀螺仪）、属性、受击无敌帧
├── enemy.gd           # 敌人（由 game.gd 统一 tick，便于用网格做互相推挤）和 boss 招式（冲刺、召唤、闪现、弹幕、扔饼）
├── hostile_shot.gd    # boss 打出来的东西：直线飞的告警弹、抛过来的饼
├── flow_field.gd      # 绕楼寻路：以玩家为中心的网格做广度优先，被楼挡住的怪顺着步数绕过去
├── spawner.gd         # 敌人数据表、按时间的刷怪配比、脚本事件
├── upgrades.gd        # 升级池：武器 / 被动的名字、素材、每级文案，应用升级
├── perks.gd / turret.gd   # 有自己玩法的被动（股票期权、背锅侠、降本增效、开源项目的炮台、站会、午休）
├── weapons/           # weapon.gd 基类 + 6 种攻击方式（aimed / facing / seeker / strike / toss / aura）
├── city.gd            # 无限地图：按坐标哈希生成街区、画地面 / 马路 / 盐田 / 海，楼和树的碰撞
├── bay_area.gd        # 湾区关卡数据：分区、各区的楼和树、地标位置、街名、恶搞公司招牌
├── brand_sign.gd / street_sign.gd   # 楼顶招牌、路口街名牌（文字用游戏字体现画）
├── art.gd             # 按名字取素材、楼的裁边、配色（界面用的 Sokosoko 色板）、字体
├── lang.gd            # 中→英翻译表（代码里的中文就是原文）与语言切换
├── settings.gd        # 存设置
├── tilt.gd            # 陀螺仪：经 JavaScriptBridge 读浏览器的 deviceorientation
├── sound.gd           # 音效和音乐：挂在场景树根上（重开一局音乐不断），常见音效限频，连续捡星星音调递增
├── telemetry.gd       # 匿名对局数据，发到 stats.lab115.com 的 Umami（见下文「对局数据」）
├── pickup.gd / projectile.gd / effects.gd
├── ui/hud.gd          # 顶栏、boss 血条、触屏摇杆、开始 / 升级 / 暂停 / 结算 / 设置面板
└── ui/minimap.gd      # 右上角小地图
tests/smoke_test.gd    # 机器人自动玩一局的冒烟测试
tools/                 # 导出 Web 版、下载 Web 导出模板、渲染启动图和 PWA 图标、重新下载 soco-st 素材、裁剪字体
assets/icons/          # PWA 图标（tools/render_icons.gd 从主角 SVG 生成；PWA 目前关着，留着以后用）
assets/art/            # 自绘 SVG（主角、敌人、武器、道具、场景、图标）
assets/fonts/          # Nunito + 思源黑体，只留游戏用到的字（tools/subset_fonts.py 生成，glyphs.txt 是字表；OFL，许可证同目录）
assets/audio/          # sfx/ 音效（按用途命名）、music/ 标题和战斗两首循环音乐（.import 里开了 loop）
assets/soco-st/        # soco-st 的楼（入库；tools/fetch_soco_st.sh 记录来源、可重新下载）
```

**换皮 / 加城市**：攻击方式的脚本按「怎么打」命名，名字和素材都在数据表里 —— 敌人在 `spawner.gd` 的 `ENEMY_TYPES`，武器和被动在 `upgrades.gd`，地图（分区、地标、街名、招牌）在 `bay_area.gd`。新加的中文文案要同步加进 `lang.gd` 的 `EN`；文案里有字体还没收的字时，重跑 `tools/subset_fonts.py`（CI 的 `check-project.mjs` 会查出漏掉的字）。

**恶搞招牌**：故意不用任何真实 logo —— 名字和图标都是自己画的谐音梗，避免商标和版权问题。加新招牌改 `bay_area.gd` 的 `BRANDS`。

**调数值**主要改三处：`spawner.gd` 的 `ENEMY_TYPES` / `WAVES` / `EVENTS` 和刷怪速率，`weapons/*.gd` 顶部的等级表（改了记得同步 `upgrades.gd` 的卡片文案），`game.gd` 的 `xp_to_next()`。改完把 `telemetry.gd` 的 `VERSION` 改成当天日期，线上数据才分得清改前改后。

## 对局数据

线上每一局都会匿名上报到自建的 Umami（stats.lab115.com，和 daily 共用一个实例），用来看难度和平衡：
- `run_start`：设备（手机 / 电脑）、屏幕尺寸、横竖屏、语言、陀螺仪 / 音效 / 音乐开关，以及这台设备之前玩过几局。
- `run_end`：结局（`win` / `died` / `restart` 从暂停页重开 / `quit` 中途关页面）、存活秒数、等级、击杀、最后伤到玩家的怪（死了就是凶手）、武器和被动等级、各武器伤害占比（`dmg_*`，百分比）、选卡顺序、每 30 秒一个「秒:等级/血量/敌人数」的时间线、遇到和打掉的 boss 数、平均和最差帧率。每局带一个随机 id，用来去重。

不记录任何身份信息和位置。中途关页面的局：游戏每 10 秒把进度存进 localStorage，关页面时由网页发出去（Umami 用 keepalive 发送）；App 内置浏览器常常来不及发，所以关页面时发完不删存档，下次打开时再补发一次才删 —— 同一局可能收到两条 `run_end`，查数据时按 `run` 去重、取 `seconds` 最大的那条。上报只在 survivors.lab115.com 上发生（Umami 脚本的 `data-domains`），编辑器、本地导出和冒烟测试都不会发。网页这边的代码在 `export_presets.cfg` 的 `html/head_include` 里。

## 素材

- 角色、敌人、武器、道具、场景和图标都是手写的 SVG（`assets/art/`），粗描边平涂风格。新增素材照着现有的写：64×64 viewBox、描边色 `#2f3542`（和界面文字同一个墨色）、线宽 3.5。
- 界面照 Sokosoko 设计规范（仿 soco-st.com 的风格）：米白底上放白色面板、墨色文字、能点的都是胶囊形、只用一个暖黄（`#f7c948`）标最重要的东西 —— 每屏一个黄色主按钮、标题下的荧光笔条、经验条。默认扁平，只有升级卡悬停时有阴影。色值在 `art.gd`，控件样式在 `hud.gd` 的 `_build_theme()`。
- 楼来自 [ソコスト（soco-st.com）](https://soco-st.com/guide)：可商用、可用于游戏、不需署名，但**禁止把图片本身当免费 / 图库素材再分发**，也禁止以它为底稿另画、拿去喂 AI。PNG 放在 `assets/soco-st/` 里入了库，好让部署时直接构建；仓库是公开的，原图因此能被直接下载，这是有意接受的风险。
- 字体：标题和数字用 [Nunito](https://github.com/googlefonts/nunito)（圆体，只有拉丁字母），其余和所有中文用 [思源黑体 / Noto Sans SC](https://github.com/notofonts/noto-cjk)，都是 SIL OFL 1.1。两个都是可变字体，一个文件出所有字重；完整的思源黑体有 17 MB，`tools/subset_fonts.py` 只留脚本字符串里用到的字（约 400 个），两个加起来不到 200 KB：
  ```bash
  python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools
  /tmp/fonttools/bin/python tools/subset_fonts.py
  ```
- 音效：Kenney 的 [Interface Sounds](https://opengameart.org/content/interface-sounds)（CC0），按用途改了名，原文件名对照见 `assets/audio/README.md`。音乐：[Ninja Adventure](https://github.com/pixel-boy/NinjaAdventure) 的 theme_lost_village（标题）和 theme_plain（战斗），CC0。都不需要署名，游戏里也不写出处。

## 测试

机器人会躲最近的怪、顺路捡掉落、随机选升级，跑完打印统计（含 1 / 3 / 5 / 7.5 / 10 分钟时的等级、各武器伤害占比、最慢一帧）；出现脚本错误时看输出里的 `SCRIPT ERROR`，基本不变量不满足时退出码为 1。

```bash
cd apps/survivors/game
godot --headless --path . --import                                                       # 首次或新增脚本后，生成类缓存
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=610          # 普通一局
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=610 --god    # 无敌跑满 10 分钟，压测性能
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=90 --restart-at=40   # 验证重开
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=180 --god --all-weapons=5   # 6 把武器全满级，看各自的伤害占比
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=60 --god --perks=standup:5,cost_cut:5 --boss=incident,pie_boss   # 开局带上这些被动、把这些 boss 叫到身边
```

截图要去掉 `--headless`（会弹窗口；macOS 上窗口被挡住时 Godot 会停止渲染，所以加 `--always-on-top`）：

```bash
godot --always-on-top --fixed-fps 60 --path . -s tests/smoke_test.gd -- --lang=zh --seconds=80 --god --die-at=75 --pause-at=40 --shots=/tmp/shots --shot-every=30
```

测试默认静音（加 `--sound` 才放音效和音乐：没人听，而且退出时还在放的音频会被报成资源泄漏）。截图时会额外截开始画面、第一次升级、暂停和结算界面；加 `--window=405x720 --handheld` 看手机竖着拿时的样子（再加 `--orientation=landscape` 看选了横屏时转 90° 的样子），`--lang=en` 截英文，`--teleport=X,Y` 开局把角色传到某处看某个区（比如 `--teleport=-280,-1600` 是旧金山的排屋，`--teleport=1700,400` 是海边）。

## 发布

push 到 main 就行：Coolify 构建 `apps/survivors/Dockerfile` 时会下载 Godot、从这个目录导出 Web 版（`tools/export_web.sh`），不需要在本地导出、也不提交导出产物。

想在本地先看 Web 版：装好 Web 导出模板后跑 `./tools/export_web.sh`，产物在 `apps/survivors/public/`（不入库），用任意静态服务器打开。模板用 `python3 tools/fetch_web_templates.py 4.7.2 "$HOME/Library/Application Support/Godot/export_templates/4.7.2.stable"` 装（只下 Web 那 20 MB，不下完整的 1.3 GB）。

**PWA 目前关着**（`export_presets.cfg` 的 `progressive_web_app/enabled=false`，图标和其余配置都还在）。之前开过一阵，那时访问过的浏览器里还留着缓存优先的 service worker，所以导出脚本会把 `tools/service_worker_removal.js` 放在原来的 `index.service.worker.js` 位置：老浏览器检查更新时会换上它，它清空缓存并注销自己；网页外壳里也有一段兜底脚本做同样的事。这些老访客发版后第一次打开还是旧版，再打开就恢复正常。以后要重新开 PWA，把开关打开，并把导出脚本里复制这个文件的那行去掉。

## 已知限制

- 首次加载约 16 MB（gzip 后：引擎 wasm 10 MB + 游戏包 6.2 MB，其中音乐约 1.8 MB），之后浏览器按 ETag 复用。
- 数值是用机器人粗调的（机器人只会躲怪，不会利用地形），手感以真人为准；线上的对局数据（见「对局数据」）是之后调数值的主要依据。
- 陀螺仪只在手机浏览器（HTTPS）里出现；iOS 会弹窗要权限，微信等内置浏览器支持程度不一。
