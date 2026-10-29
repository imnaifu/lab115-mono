# survivors

硅谷幸存者 —— Godot 4 做的割草类 roguelike（Vampire Survivors 风）。武器全自动攻击，你只管走位、捡经验、升级三选一，躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。中英双语，电脑和手机（触屏摇杆 / 陀螺仪）都能玩。

线上：<https://survivors.lab115.com>。这个目录是游戏的 Godot 工程；上一级 `apps/survivors/` 的 Dockerfile 在部署时从这里导出 Web 版并用 nginx 提供（见那里的 README）。

**游戏机制以 [`DESIGN.md`](DESIGN.md) 为准**（规则、数值、节奏、界面上该有什么，以及变更记录）。改玩法、数值或界面时，在同一次改动里更新它；下面「玩法」是简介，实现细节在后面几节。

```bash
brew install --cask godot                     # Godot 4.7
godot --path apps/survivors/game              # 直接玩
godot -e --path apps/survivors/game           # 用编辑器打开
```

## 玩法

- **操作**：WASD / 方向键 / 手柄左摇杆移动；手机按住屏幕任意处拖动（虚拟摇杆），或在「设置」里打开陀螺仪后倾斜手机（可选，默认关，默认用手指）。陀螺仪左右以真水平为准；前后以开局 / 从暂停回来时拿手机的角度为准（取开头 0.5 秒的平均），玩的时候右上角的手机按钮可随时重新校准。Esc / P / 右上角按钮暂停；升级时按数字键或点卡片；暂停或结束时按 R 重开。窗口失焦会自动暂停。
- **职业**（`jobs.gd`）：开局在开始画面选，记住上次的选择，新玩家默认程序员。程序员（回车键）、产品经理（PRD 卷筒，更肉更慢）、设计师（数位笔，更脆更快）、运维（防火墙，最肉最慢）、数据科学家（坐标轴）。职业之间只差专属武器和体质。专属武器每次升级是一对卡，两个方向二选一（比如 PRD 卷筒「更长」或「更宽」）。
- **武器**（15 把，各 5 级，分射击 / 近战 / 区域 / 召唤四类；数值和参考来源见 `DESIGN.md` 2.2）：每个职业一把专属（回车键、PRD 卷筒、数位笔、防火墙、坐标轴），另外 10 把公共：屏保、复制粘贴、机械键盘、邮件抄送、钢笔工具、Wi-Fi 信号、云端部署、拉会、无人机、外包团队。武器格 6 个，能拿的比格子多，要取舍。11 把武器满级后带着对应被动开钱袋会进化（比如回车键 + 双屏显示器 → Shift+Enter 批量提交）。
- **被动**（一局最多带 6 种，各 5 级）：加数值的有冰美式（伤害）、降噪耳机（减伤）、撸铁（生命上限）、电动滑板（移速）、双屏显示器（冷却）、人脉名片（拾取范围）、工位绿植（回血）；有自己玩法的有股票期权（拿到后每撑 1 分钟伤害再涨一点，越早拿越赚）、背锅侠（挨打时按受到伤害的几倍炸伤身边的怪）、降本增效（打死的怪有几率爆炸，能连环炸）、开源项目（打死怪有几率留下一个小炮台打 8 秒）、站会（每隔一阵震开并定住身边的怪）、午休（站着不动 1 秒后快速回血，头上冒 Zz）、猎头电话（升级时多给 1 个选项，最多 2 级）。这几个的逻辑在 `perks.gd`。
- **升级卡**：卡上除了文案，还用蓝字写出具体数字（「伤害 14 → 18 · 数量 1 → 2」，武器最多列两项；伤害和间隔已算上当前的加成，和飘出来的伤害数字对得上）。每局头两次升级保底给新武器卡（第一次至少 2 张、第二次至少 1 张），手上不到 3 把武器时新武器卡标「推荐」—— 线上数据里新手常常前几次全拿被动，只有 1 把武器，3、4 分钟就死。
- **掉落**：经验星星（蓝 / 绿 / 金按数值分档，要走近才会被吸过来，捡到才加经验；每台设备第一次掉星星时会提示一次，并在那颗星星上画一个跳动的箭头）、珍珠奶茶回 30 血、磁铁吸来全图经验、boss 必掉融资钱袋。
- **融资开奖**：捡到钱袋时暂停，老虎机在「天使轮 / A 轮 / IPO」之间转，停下的轮次决定白给几样升级（1 / 3 / 5 样，概率 75% / 20% / 5%，在 `game.gd` 的 `FUNDING_ROUNDS`）。像 Vampire Survivors 的宝箱，给的是身上已有的武器和被动各升一级，全满了才出新东西。
- **提示**：计时器下方在 boss 来之前 20 秒出现「下一个 boss 0:12」倒计时；屏幕外的 boss 在屏幕边缘用带头像的箭头指出方向；前 3 局开局 2 秒没动会在底部提示怎么移动；每局每种 boss 招式第一次出手时，底部用红字提示怎么躲。结算页写出凶手和死因（冲锋撞死、告警弹命中……），并按死法给一条建议（只带了 1、2 把武器、被几个 boss 围住、倒在 boss 招式下……）。
- **战绩图**：结算页「生成战绩图」画一张 720×1280 的竖图（`ui/share_card.gd`）：结局、存活时间、职级（按等级：10 级 L4，往上每 10 级升一级，到 L8）、击杀、最强武器、凶手、一句吐槽和二维码（`assets/art/qr_share.svg`，链接带 `?from=share`，由 `tools/make_share_qr.py` 生成）。网页上盖一层显示这张图，手机长按保存或转发，浏览器支持时有「分享」，非微信里有「保存图片」。分享不给任何奖励（微信规则禁止诱导分享）。
- **版本号**：开始画面、暂停页和结算页的右下角显示 `telemetry.gd` 的 `VERSION`，用来确认手机上是不是最新版。
- **地图**：照湾区的轮廓排布的街区 —— 起点在帕洛阿尔托 / 山景城（科技园区、Caltrain、斯坦福钟楼，楼顶挂着 Pear、Goggle、Beta、Envy、NUTFLIX、LinkedOut 这些恶搞招牌，园区草坪上还有大号落地招牌、Goggle 的恐龙骨架和 Beta 的大拇指牌，101 边上有 Out-N-In 汉堡店），往北半岛变窄，经过 SFO 跑道到旧金山（维多利亚排屋、泛美金字塔、Sailsforce 塔、叮当车和无人车，北岸是金门大桥和金门海峡），往南是圣何塞（西班牙红瓦房、Levy's 球场，往南和往东都走不完），往西是 Sand Hill Road 的金色山丘和红杉，再往西是太平洋，往东是盐田和海湾（越往南海湾越宽，到圣何塞收尾）。US-101 沿海湾一侧、I-280 沿山一侧，画成更宽的高速：双黄线、路面画着路线盾牌、隔一个街区一块绿色路牌，路上跑着无人车；Caltrain 的铁轨沿 Alma St 贯穿南北，火车隔一阵开过（车和火车会把人和怪往两侧挤开，但不扣血；火车来之前铁轨闪红）。海岸是按街区一行一行定的（`bay_area.gd` 的 `east_shore_column` / `west_shore_column`），沿海的路不会一半泡在水里。路口的街名牌用真实街名（El Camino Real、University Ave、Sand Hill Rd、旧金山的 Van Ness Ave……）。楼只有底座（沿正面墙一条 24 像素深）挡路，楼身可以绕到后面去，人在楼后时楼会变半透明；草地上的树干和海水也挡路，楼缝里的行道树不挡。一排楼之间至少留 36 像素的缝，最大的 boss 也挤得过去。玩家和怪物都过不去（404 幽灵除外，它们穿墙）；武器的投射物从楼上飞过。怪被楼挡住时按寻路图（`flow_field.gd`）绕过去，不会贴着墙卡住。右上角小地图显示整个湾区（海岸线、两条高速和 Caltrain）、你的位置、当前屏幕范围和 boss（红点），下面写着所在的区；三面是海，只有往南（和圣何塞往东）走不完，走出小地图的范围时小地图会缩小把你也装进去。
- **敌人节奏**：开局 30 秒只有慢吞吞的 Bug，之后加入又快又会拐的消息红点 → 未读邮件、会议邀请、404 幽灵（会穿过怪群）→ 技术债、宕机服务器。小怪不多（10 分钟时每秒刷约 6 只），压力主要来自每分钟一个的 boss，除了 1:00 的祖传技术债（只是放大的精英怪），每个都有自己的招式：2:00 主库宕机（脚下红圈填满后炸开、把人和小怪都震开），3:00 裁员通知（蓄力后沿红色通道冲锋），4:00 Deadline（头顶 25 秒倒计时，没按时打掉就暴走；按时打掉钱袋保底 A 轮），5:00 AI 大模型（在你身边变出一碰就碎的半透明分身），6:00 投资人（金圈里的小怪减伤一半，死后洒一圈星星），7:00 屎山代码（不停冒 Bug，死后裂成 3 坨），7:30 需求变更（闪现到你前进方向的红圈），8:00 P0 线上事故（向四周发告警弹，楼能挡），9:00 老板画饼（朝你要去的地方扔饼）+ AI 大模型。招式和数值以 `DESIGN.md` 为准。场上已有 3 个 boss 没打掉时，下一个 boss 等有 boss 倒下再出场（包围圈照常），免得打不过的人被越压越多。boss 在场时屏幕上方显示名字、血条和血量（同时有几个就显示「+N」）。前 3 分钟刷怪打折（开局是正常速率的 60%，3:00 回到满速），前 4 次升级所需经验也更少（3 / 7 / 13 / 20）。1:30 / 3:30 / 6:30 / 8:30 有包围圈事件。
- **血量**：人物脚下的血条里只写当前血量（上限看血条有多满）。
- **设置**：开始画面和暂停页的「设置」是一整页：中文 / English、音效和音乐开关；手机上还有屏幕方向（跟随手机 / 横屏）和陀螺仪开关；选择存在 `user://settings.cfg`（网页版在浏览器的 IndexedDB 里）。没选过语言的一律先显示中文。
- **横竖屏**：手机默认竖屏，布局跟着手机方向走（竖着拿是竖屏布局，横过来是横屏布局），这是同类手游（Vampire Survivors、弹壳特攻队）的默认做法，适合单手拇指操作。设置里选「横屏」的话，竖着拿时整个游戏（连加载页）转 90° 铺满屏幕，把手机横过来就是正的，竖屏锁定开着也行。电脑一律横屏，窗口比宽还高时加上下黑边。较长的屏幕会多看到一点视野。

## 结构

```
project.godot          # 逻辑分辨率 640×360（手机竖拿时以 360×640 为基准），canvas_items + 非整数缩放，SVG 按 4 倍导入
scenes/main.tscn       # 只有一个挂着 game.gd 的根节点，其余都在代码里创建
scripts/
├── game.gd            # 一局的总控：分层、空间网格、敌人/掉落 tick、经验与升级、融资开奖、胜负、横竖屏切换
├── player.gd          # 移动（键盘 + 触屏摇杆 + 陀螺仪）、属性、受击无敌帧
├── enemy.gd           # 敌人（由 game.gd 统一 tick，便于用网格做互相推挤）和 boss 招式（冲刺、召唤、闪现、弹幕、扔饼）
├── hostile_shot.gd    # boss 打出来的东西：直线飞的告警弹、抛过来的饼
├── flow_field.gd      # 绕楼寻路：以玩家为中心的网格做广度优先，被楼挡住的怪顺着步数绕过去
├── spawner.gd         # 敌人数据表、按时间的刷怪配比、脚本事件
├── jobs.gd            # 五个职业：专属武器、体质；武器类型的名字和颜色
├── upgrades.gd        # 升级池：武器（类型、归属职业）/ 被动的名字、素材、每级文案、卡上的数字，武器进化，保底武器卡，钱袋给的升级，应用升级
├── perks.gd / turret.gd   # 有自己玩法的被动（股票期权、背锅侠、降本增效、开源项目的炮台、站会、午休）
├── weapons/           # weapon.gd 基类 + 15 种攻击方式（aimed / facing / bomber / strike / toss / aura / swing / poke / guides / trail / zone / orbit / squad / bounce / ricochet），各自带进化后的打法；专属武器的五种按两个方向的升级次数算数值
├── city.gd            # 地图：按坐标哈希生成街区、画地面 / 马路 / 高速 / 铁轨 / 跑道 / 盐田 / 海，楼、树和海水的碰撞
├── traffic.gd         # 高速上的无人车、铁轨上的 Caltrain（位置只由时间算出，不存状态）；撞到人和怪往两侧推开，不扣血；火车来前铁轨闪红
├── bay_area.gd        # 湾区关卡数据：分区、各区的楼和树、地标位置、街名、恶搞公司招牌
├── brand_sign.gd / street_sign.gd / freeway_sign.gd   # 楼顶招牌、路口街名牌、高速路牌（文字用游戏字体现画）
├── art.gd             # 按名字取素材、楼的裁边、配色（界面用的 Sokosoko 色板）、字体
├── lang.gd            # 中→英翻译表（代码里的中文就是原文）与语言切换
├── settings.gd        # 存设置
├── tilt.gd            # 陀螺仪：经 JavaScriptBridge 读浏览器的 deviceorientation
├── sound.gd           # 音效和音乐：挂在场景树根上（重开一局音乐不断），常见音效限频，连续捡星星音调递增；音乐和音效分两条 bus，HUD 每帧报告界面 / 血量 / 时间，音乐据此让位或提速，低血量响心跳
├── telemetry.gd       # 匿名对局数据，发到 stats.lab115.com 的 Umami（见下文「对局数据」）
├── boss_pointers.gd   # 屏幕边缘指向屏幕外 boss 的箭头
├── pickup.gd / projectile.gd / effects.gd
├── ui/hud.gd          # HUD（顶栏、boss 条和倒计时、触屏摇杆、底部提示）和开始 / 升级 / 融资开奖 / 暂停 / 结算 / 设置画面
├── ui/ui_kit.gd       # 界面控件：按钮、卡片、分段选择、开关、标签、等级点（照设计画布）
├── ui/share_card.gd   # 结算页的战绩图
└── ui/minimap.gd      # 右上角小地图
tests/smoke_test.gd    # 机器人自动玩一局的冒烟测试
tools/                 # 导出 Web 版、下载 Web 导出模板、渲染启动图和 PWA 图标、重新下载 soco-st 素材、裁剪字体、生成战绩图的二维码
assets/icons/          # PWA 图标（tools/render_icons.gd 从主角 SVG 生成；PWA 目前关着，留着以后用）
assets/art/            # 自绘 SVG（主角、敌人、武器、道具、场景、图标）
assets/fonts/          # Nunito + 思源黑体，只留游戏用到的字（tools/subset_fonts.py 生成，glyphs.txt 是字表；OFL，许可证同目录）
assets/audio/          # sfx/ 音效（按用途命名）、music/ 标题和战斗两首循环音乐（.import 里开了 loop）
assets/soco-st/        # soco-st 的楼（入库；tools/fetch_soco_st.sh 记录来源、可重新下载）
```

**换皮 / 加城市**：攻击方式的脚本按「怎么打」命名，名字和素材都在数据表里 —— 敌人在 `spawner.gd` 的 `ENEMY_TYPES`，武器和被动在 `upgrades.gd`，地图（分区、地标、街名、招牌）在 `bay_area.gd`。新加的中文文案要同步加进 `lang.gd` 的 `EN`；文案里有字体还没收的字时，重跑 `tools/subset_fonts.py`（CI 的 `check-project.mjs` 会查出漏掉的字）。

**恶搞招牌**：故意不用任何真实 logo —— 名字和图标都是自己画的谐音梗，避免商标和版权问题。加新招牌改 `bay_area.gd` 的 `BRANDS`。

**调数值**主要改三处：`spawner.gd` 的 `ENEMY_TYPES` / `WAVES` / `EVENTS` 和刷怪速率，`weapons/*.gd` 顶部的等级表（改了记得同步 `upgrades.gd` 的卡片文案），`game.gd` 的 `xp_to_next()`。**每次上线**都把 `telemetry.gd` 的 `VERSION` 升一号（当天日期，同一天再上线就加 `.2`、`.3`……），线上数据才分得清改前改后，开始画面上显示的版本号也才对得上每次部署。

## 对局数据

线上每一局都会匿名上报到自建的 Umami（stats.lab115.com，和 daily 共用一个实例），用来看难度和平衡：
- `game_ready`：每次打开页面、开始画面出来时发一次，带 `load_ms`（从开始加载页面算起的毫秒数）。有浏览量没有它的，就是加载时流失的人。
- `run_start`：职业（`job`）、设备（手机 / 电脑）、屏幕尺寸、横竖屏、语言、陀螺仪 / 音效 / 音乐开关、这台设备之前玩过几局、`from`（链接上的 `?from=`，战绩图二维码带进来的是 `share`），页面打开后的第一局还带 `page_ms`（开局时距离打开页面多久）。
- `run_end`：职业（`job`）、结局（`win` / `died` / `restart` 从暂停页重开或换职业 / `quit` 中途关页面）、存活秒数、等级、击杀、最后伤到玩家的怪（死了就是凶手）和那一下是怎么打中的（`killer_how`：contact / charge / bullet / pie）、武器和被动等级、进化了的武器（`evolved`）、各武器伤害占比（`dmg_*`，百分比，只有打出过伤害的才有）、选卡顺序（专属武器的方向卡记成 `prd:b` 这样）、`offered`（每张卡被拿出来几次，和选卡顺序一起算选中率）、`chests`（钱袋开出的轮次）、每 30 秒一个「秒:等级/血量/敌人数」的时间线、遇到和打掉的 boss 数、结束时所在的区（`district`）、平均和最差帧率。每局带一个随机 id，用来去重。
- `js_error`：网页和引擎的脚本错误（引擎的错误经 `console.error` 打出来），每次打开页面最多 5 条。

不记录任何身份信息和位置。中途关页面的局：游戏每 10 秒把进度存进 localStorage，关页面或页面被切到后台时由网页发出去（Umami 用 keepalive 发送；手机常常先把页面切到后台、之后直接杀掉，不触发关页面事件）；App 内置浏览器常常来不及发，所以关页面时发完不删存档，下次打开时再补发一次才删 —— 同一局可能收到两条 `run_end`，查数据时按 `run` 去重、取 `seconds` 最大的那条。上报只在 survivors.lab115.com 上发生（Umami 脚本的 `data-domains`），编辑器、本地导出和冒烟测试都不会发。网页这边的代码在 `export_presets.cfg` 的 `html/head_include` 里。

## 素材

- 角色、敌人、武器、道具、场景和图标都是手写的 SVG（`assets/art/`），粗描边平涂风格。新增素材照着现有的写：64×64 viewBox、描边色 `#2f3542`（和界面文字同一个墨色）、线宽 3.5。
- 界面照设计画布「硅谷幸存者 · 界面设计」（Sokosoko 设计规范，仿 soco-st.com 的风格）：米白底、白卡片、墨色文字和描边、能点的都是胶囊形；主按钮是暖黄（`#f7c948`）加墨色硬阴影，每屏一个；暂停游戏的对话框用深色遮罩，结算和设置是整页。竖屏按 360 宽和设计稿一比一，横屏排成两栏。色值在 `art.gd`，控件在 `ui/ui_kit.gd`，规则见 `DESIGN.md` 第 4 节。
- 楼来自 [ソコスト（soco-st.com）](https://soco-st.com/guide)：可商用、可用于游戏、不需署名，但**禁止把图片本身当免费 / 图库素材再分发**，也禁止以它为底稿另画、拿去喂 AI。PNG 放在 `assets/soco-st/` 里入了库，好让部署时直接构建；仓库是公开的，原图因此能被直接下载，这是有意接受的风险。
- 字体：标题和数字用 [Nunito](https://github.com/googlefonts/nunito)（圆体，只有拉丁字母），其余和所有中文用 [思源黑体 / Noto Sans SC](https://github.com/notofonts/noto-cjk)，都是 SIL OFL 1.1。两个都是可变字体，一个文件出所有字重；完整的思源黑体有 17 MB，`tools/subset_fonts.py` 只留脚本字符串里用到的字（约 400 个），两个加起来不到 200 KB：
  ```bash
  python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools
  /tmp/fonttools/bin/python tools/subset_fonts.py
  ```
- 音效：Kenney 的 Interface / Sci-Fi / Digital / RPG 几个音效包（CC0，取自 OpenGameArt），加一个自己合成的心跳，按用途改了名，来源和原文件名对照见 `assets/audio/README.md`。音乐：[Ninja Adventure](https://github.com/pixel-boy/NinjaAdventure) 的 theme_lost_village（标题）和 theme_plain（战斗），CC0。都不需要署名，游戏里也不写出处。

## 测试

机器人会躲最近的怪、顺路捡掉落、随机选升级，跑完打印统计（含 1 / 3 / 5 / 7.5 / 10 分钟时的等级、各武器伤害占比、最慢一帧）；出现脚本错误时看输出里的 `SCRIPT ERROR`，基本不变量不满足时退出码为 1。

```bash
cd apps/survivors/game
godot --headless --path . --import                                                       # 首次或新增脚本后，生成类缓存
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=610          # 普通一局
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=610 --god    # 无敌跑满 10 分钟，压测性能
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=90 --restart-at=40   # 验证重开
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=180 --god --all-weapons=5   # 职业能拿的武器全满级，看各自的伤害占比
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=610 --job=pm   # 用某个职业玩一局
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=90 --job=ops --only-perks   # 升级只拿被动，只看开局武器本身的强度
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=30 --god --job=ops --evolve   # 职业能拿的武器全部满级并进化
godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=60 --god --perks=standup:5,cost_cut:5 --boss=incident,pie_boss   # 开局带上这些被动、把这些 boss 叫到身边
```

截图要去掉 `--headless`（会在屏幕上弹窗口；macOS 上窗口被挡住或屏幕休眠时 Godot 会停止渲染，之后的截图都停在那一帧，所以加 `--always-on-top`，并尽量让一次截图的局短一点）：

```bash
godot --always-on-top --fixed-fps 60 --path . -s tests/smoke_test.gd -- --lang=zh --seconds=80 --god --die-at=75 --pause-at=40 --shots=/tmp/shots --shot-every=30
```

截图时加 `--share` 还会把结算页的战绩图存成 `shot_share.png`（同时有 `--pause-at` 时存暂停页「分享」的进行中战绩图 `shot_share_pause.png`），开出钱袋时会截 `shot_chest.png`（想早点开出来，可以加 `--boss=techdebt_elite --all-weapons=5`）。

测试默认静音（加 `--sound` 才放音效和音乐：没人听，而且退出时还在放的音频会被报成资源泄漏）。截图时会额外截开始画面、第一次升级、暂停和结算界面；加 `--window=405x720 --handheld` 看手机竖着拿时的样子（再加 `--orientation=landscape` 看选了横屏时转 90° 的样子），`--lang=en` 截英文，`--hold-hp=0.2` 让血量停在 20%（看低血量时血条的颜色和闪烁），`--shot-every` 小于 1 秒时文件名带小数秒，`--teleport=X,Y` 开局把角色传到某处看某个区（比如 `--teleport=-280,-1600` 是旧金山的排屋，`--teleport=1700,400` 是海边）。

## 发布

push 到 main 就行：Coolify 构建 `apps/survivors/Dockerfile` 时会下载 Godot、从这个目录导出 Web 版（`tools/export_web.sh`），不需要在本地导出、也不提交导出产物。

导出脚本会把游戏包改名成带内容哈希的 `index-<哈希>.pck`，并改写 `index.html` 里的 `GODOT_CONFIG.mainPack` 指向它：页面只会加载和自己同一次导出的包，nginx 也可以让浏览器永久缓存这个包（`index.html` 本身每次都校验）。脚本还把 `VERSION` 写进 `version.txt`：一个开着的标签页从后台切回来时，如果线上已经是新版本、而且没有正在进行的一局，网页会自动刷新到新版本（代码在 `export_presets.cfg` 的对局数据脚本里）。

想在本地先看 Web 版：装好 Web 导出模板后跑 `./tools/export_web.sh`，产物在 `apps/survivors/public/`（不入库），用任意静态服务器打开。模板用 `python3 tools/fetch_web_templates.py 4.7.2 "$HOME/Library/Application Support/Godot/export_templates/4.7.2.stable"` 装（只下 Web 那 20 MB，不下完整的 1.3 GB）。

**PWA 目前关着**（`export_presets.cfg` 的 `progressive_web_app/enabled=false`，图标和其余配置都还在）。之前开过一阵，那时访问过的浏览器里还留着缓存优先的 service worker，所以导出脚本会把 `tools/service_worker_removal.js` 放在原来的 `index.service.worker.js` 位置：老浏览器检查更新时会换上它，它清空缓存并注销自己；网页外壳里也有一段兜底脚本做同样的事。这些老访客发版后第一次打开还是旧版，再打开就恢复正常。以后要重新开 PWA，把开关打开，并把导出脚本里复制这个文件的那行去掉。

## 已知限制

- 首次加载约 16 MB（gzip 后：引擎 wasm 10 MB + 游戏包 6.2 MB，其中音乐约 1.8 MB）；之后游戏包没变就直接用浏览器缓存，wasm 按 ETag 复用。
- 数值是用机器人粗调的（机器人只会躲怪，不会利用地形），手感以真人为准；线上的对局数据（见「对局数据」）是之后调数值的主要依据。
- 陀螺仪只在手机浏览器（HTTPS）里出现；iOS 会弹窗要权限，微信等内置浏览器支持程度不一。
