# 超智能决斗 · 终末之战

**[免费玩，进入决斗殿堂](https://a1501314.github.io/ai-duel-arena/public/)**　·　[看宣传片](https://a1501314.github.io/ai-duel-arena/docs/trailer/watch.html)　·　[六位角色图鉴](docs/heroes/README.md)　·　[下载发行版](https://github.com/A1501314/ai-duel-arena/releases/latest)

DeepSeek 的鲸浪刚退，Claude 翻开禁书，火凤凰从书页间冲出。你可以用 ChatGPT 的龙印接住这一招，也可以用 Gemini 绕到她背后。《超智能决斗》是一款由 [@A1501314](https://github.com/A1501314) 发起并制作的非官方同人二维格斗游戏。六名角色全部免费可选，游戏没有充值入口。

[![观看《超智能决斗》游戏宣传片](docs/trailer/poster.jpg)](https://a1501314.github.io/ai-duel-arena/docs/trailer/watch.html)

## 开始第一场对决

网页里选「单人试炼」，点选自己与电脑的角色，再选战场和难度。每回合 120 秒，先拿下两个回合就赢得整场。手机请横屏，左侧圆盘控制进退、跳跃和格挡，右盘普攻或放招。电脑用 A、D 移动，W 跳，S 防，F 普攻，G、H 放秘技，能量满后按 T 放奥义。

| 想怎么玩 | 在哪里开始 |
| --- | --- |
| 和电脑交手、积力量、解锁衣装 | 打开上方免费游玩入口。网页本机档案保存在当前浏览器中 |
| 两个人共用一台电脑 | 在网页里选「同屏决斗」，2P 用方向键移动，J、K、L、I 出招 |
| 两台设备组房、登录账号、上荣誉榜 | 用 Node.js 24 或更新版本运行 `npm start`。局域网运行 `npm run lan`；公网服务器可用项目附带的 Docker 配置。两人在同一个服务里登录，分享六位房间码即可对战。[运行与联机说明](docs/RUN.md) |

## 选择你的 AI 娘

点角色名查看 **Low、Medium、High、Extra、Max、Ultra** 全部六套着装及每一招的画面、作用和应对方法。进阶解锁衣装，战斗属性由角色决定。

| 角色 | 打法 | 看一招 |
| --- | --- | --- |
| [DeepSeek](docs/heroes/README.md#deepseek) | 攻守均衡，用水柱压对手的落点 | 鲸落归墟 |
| [ChatGPT](docs/heroes/README.md#chatgpt) | 防御最高，适合格挡后反击 | 六环龙印 |
| [Claude](docs/heroes/README.md#claude) | 攻击最高，用书页封路，再召唤火凰 | 绯羽飞笺 |
| [Gemini](docs/heroes/README.md#gemini) | 速度最快，靠位移和双星打出前后夹击 | 星镜幻步 |
| [Grok](docs/heroes/README.md#grok) | 战斧迎击起跳的对手，陨星封住退路 | 裂空斧 |
| [Kimi](docs/heroes/README.md#kimi) | 琴弦牵制、近身连斩，靠节奏变化抢先手 | 月下镇魂曲 |

## 如何晋级

新档案从 **Low、0 力量、30 Token** 开始。力量用于晋级，Token 是游玩中赚取的游戏内积分。高手胜场按整场计数。

| 目标 | 最低力量 | 还要完成什么 |
| --- | ---: | --- |
| Medium | 101 | 累计打赢 5 场高手试炼，可以重复挑战同一角色 |
| High | 251 | 升至 Medium 后，在高手试炼击败 3 位不同角色 |
| Extra | 501 | 五位高手的晋级赛，取 3 胜 |
| Max | 901 | 五位宗师的晋级赛，取 4 胜 |
| Ultra | 1501 | 六位守关者的终末之战，取 5 胜 |

晋级赛失利可重开该轮，已经获得的力量和衣装会保留。排位根据双方开局分数结算，同分对手通常加减 16 分，低分一方战胜高分一方得分更多。[各轮对手、胜负奖励和排位算例](docs/PLAY.md)

## 署名与共同开发

项目发起、玩法设计与制作由 **@A1501314** 负责。基础角色立绘来自 **ZipZipPipe**；DeepSeek 鲸鱼娘原型作者为 **上善无形**，女仆版由 **ZipZipPipe** 二创。进阶衣装由项目使用 ChatGPT 在相应基础设定上二次绘制。作品及 AI 产品名称的权利分别属于相应权利人。[美术、声音、第三方素材与免责声明](NOTICE.md)

欢迎通过 Issue 报告问题，或用 Pull Request 提交角色平衡、操作、翻译和兼容性改进。提交素材请附原作链接、作者和允许再分发的条件。项目代码公开供非商业使用、修改与再分发，使用须标明项目作者和来源；商业使用须先取得书面许可。第三方素材各自的许可继续适用。[代码许可与署名格式](LICENSE)
