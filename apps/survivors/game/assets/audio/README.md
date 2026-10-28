# audio

都是 CC0，不需要署名。换声音时保持文件名不变，或者同步改 `scripts/sound.gd` 的 `EFFECTS` / `TRACKS`。

**sfx/**：Kenney Interface Sounds（<https://opengameart.org/content/interface-sounds>）

| 文件 | 原文件 | 什么时候响 |
| --- | --- | --- |
| click.ogg | click_001 | 点按钮 |
| level_up.ogg | maximize_006 | 弹出升级三选一（含融资钱袋给的免费升级） |
| pick.ogg | confirmation_001 | 选定一张升级卡 |
| xp.ogg | pluck_001 | 捡到星星（连续捡音调一路升高） |
| hit.ogg | drop_001 | 打中敌人（Wi-Fi 信号的持续伤害不响） |
| kill.ogg | glass_006 | 敌人倒下 |
| hurt.ogg | error_004 | 自己挨打 |
| heal.ogg | glass_001 | 珍珠奶茶回血 |
| magnet.ogg | maximize_009 | 磁铁 |
| alarm.ogg | bong_001 | 包围圈 / 精英 / 首领出现 |
| zap.ogg | glitch_002 | 云端部署劈下来 |
| win.ogg | confirmation_004 | 撑满 10 分钟 |
| lose.ogg | minimize_005 | 倒下 |

**music/**：Ninja Adventure（<https://github.com/pixel-boy/NinjaAdventure>）

| 文件 | 原文件 | 用在 |
| --- | --- | --- |
| title.ogg | theme_lost_village.ogg | 开始画面 |
| battle.ogg | theme_plain.ogg | 一局之中 |

原文件直接拷贝、没重新编码；两首响度差约 2 dB，在 `sound.gd` 的 `TRACKS` 里用音量补齐。
