# audio

都是 CC0，不需要署名。换声音时保持文件名不变，或者同步改 `scripts/sound.gd` 的 `EFFECTS` / `TRACKS`。

**sfx/**：Kenney 的几个音效包，都取自 OpenGameArt：[Interface Sounds](https://opengameart.org/content/interface-sounds)、[Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds)、[Digital SFX](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc)、[RPG Sounds](https://opengameart.org/content/50-rpg-sound-effects)；心跳是自己合成的。

| 文件 | 来源 | 原文件 | 什么时候响 |
| --- | --- | --- | --- |
| click.ogg | Interface | click_001 | 点按钮 |
| level_up.ogg | Interface | maximize_006 | 弹出升级三选一（含融资钱袋给的免费升级） |
| pick.ogg | Interface | confirmation_001 | 选定一张升级卡 |
| xp.ogg | Interface | pluck_001 | 捡到星星（连续捡音调一路升高） |
| hit.ogg | Interface | drop_001 | 打中敌人（Wi-Fi 信号的持续伤害不响） |
| kill.ogg | Interface | glass_006 | 小怪倒下（精英和 boss 用 boss_down） |
| hurt.ogg | Interface | error_004 | 自己挨打 |
| heal.ogg | Interface | glass_001 | 珍珠奶茶回血 |
| magnet.ogg | Interface | maximize_009 | 磁铁 |
| alarm.ogg | Interface | bong_001 | 包围圈 / 精英 / 首领出现 |
| zap.ogg | Interface | glitch_002 | 云端部署劈下来 |
| win.ogg | Interface | confirmation_004 | 撑满 10 分钟；融资开出 IPO |
| lose.ogg | Interface | minimize_005 | 倒下 |
| windup.ogg | Sci-Fi | forceField_000 | boss 蓄力：裁员通知冲刺、P0 告警弹、主库宕机冲击 |
| blink.ogg | Digital | phaseJump1 | 需求变更闪现之前 |
| clones.ogg | Sci-Fi | computerNoise_000 的前 0.9 秒 | AI 大模型放幻觉分身之前 |
| summon.ogg | Sci-Fi | slime_000 | 屎山代码身边冒出一圈 Bug |
| lob.ogg | RPG | cloth1 | 老板画饼扔饼 |
| boss_fire.ogg | Sci-Fi | laserLarge_000 | P0 线上事故的告警弹射出 |
| quake.ogg | Sci-Fi | explosionCrunch_000 | 主库宕机的冲击落下 |
| boss_down.ogg | Sci-Fi | explosionCrunch_004 | 精英 / boss 倒下（音乐同时让一下） |
| heartbeat.ogg | 合成 | — | 血量低于 35% 时一直响，越低越快 |
| ultimate.ogg | Digital | powerUp1 | 放大招 |
| corner.ogg | Interface | confirmation_003 | 屏保 Logo 撞角 |
| block.ogg | Sci-Fi | impactMetal_002 | 防火墙挡住子弹 |
| reel_tick.ogg | Interface | tick_001 | 融资开奖转盘每跳一格 |
| payout.ogg | RPG | handleCoins | 融资到账（IPO 以外） |
| standup.ogg | RPG | bookClose | 站会震晕周围的怪 |

Interface / Sci-Fi / RPG 的原文件本来就是 ogg，直接拷贝。Digital 的原文件是 mp3、computerNoise 截了一段、心跳是合成的，这几个用 ffmpeg 自带的 Vorbis 编码器转成 ogg（Homebrew 的 ffmpeg 没带 libvorbis），峰值调到 -1 dB：

```bash
ffmpeg -i phaseJump1.mp3 -af "volume=14.2dB" -ar 44100 -ac 2 -c:a vorbis -strict -2 -q:a 6 blink.ogg
```

心跳是两下衰减的低音（90 / 80 Hz 加两个泛音，手机外放听得见），用 ffmpeg 生成后同样转码：

```bash
ffmpeg -f lavfi -i "aevalsrc='min(1,t/0.004)*(if(lt(t,0.2),(sin(2*PI*90*t)+0.5*sin(2*PI*180*t)+0.3*sin(2*PI*270*t))*exp(-t*22),0)+if(gte(t,0.2),0.7*(sin(2*PI*80*(t-0.2))+0.5*sin(2*PI*160*(t-0.2))+0.3*sin(2*PI*270*(t-0.2)))*exp(-(t-0.2)*22),0))':s=44100:d=0.55" heartbeat.wav
```

新加的声音按「最响的 50 毫秒」和原有的对齐过音量：boss 的预警音在打中声和警报之间，boss 倒下和大招接近升级声。

**music/**：Ninja Adventure（<https://github.com/pixel-boy/NinjaAdventure>）

| 文件 | 原文件 | 用在 |
| --- | --- | --- |
| title.ogg | theme_lost_village.ogg | 开始画面 |
| battle.ogg | theme_plain.ogg | 一局之中 |

原文件直接拷贝、没重新编码；两首响度差约 2 dB，在 `sound.gd` 的 `TRACKS` 里用音量补齐。

音乐和音效各走一条 bus（`Music` / `Effects`，定义在 `game/default_bus_layout.tres`，Godot 启动时自动加载）。**别在代码里用 `AudioServer.add_bus()` 加 bus**：Godot 4.7.2 的网页版会把运行时加的 bus 排错位置，再设 send 就把所有 bus（连 Master）接成一个环，整个游戏没声音（10-28 线上出过一次）。暂停、升级、融资开奖时音乐压低 8 dB，血量越低压得越多（最多 8 dB），boss 倒下时让 10 dB 再慢慢回来，最后一分钟音乐提速到 1.05 倍。网页版用浏览器自己的音频播放，只认 bus 音量、不认 bus 上的效果器，所以「让位」只调音量、不加滤波。
