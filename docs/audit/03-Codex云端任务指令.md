# Codex 云端任务指令（可直接复制）

本文件分两部分：

- **第一部分：用户操作清单**（在本地完成，不需要运行 Codex CLI）
- **第二部分：Codex 云端任务指令正文**（从 `▼ 复制开始` 到 `▲ 复制结束`，整段全选复制粘贴进 Codex 云端即可）

> 重要：按你的要求，**不把任务设计成必须在本地运行 Codex CLI 才能完成**。
> 本地只负责把项目变成 Git 仓库并连到 GitHub；所有审查、修复、测试、报告、分支与 PR 都在 **Codex 云端** 执行。

---

# 第一部分 · 用户操作清单（本地一次性前置）

当前实测：本机 **没有 git、没有 `.git` 目录、没有 Codex CLI、没有任何相关 Token**，项目还不是 Git 仓库，因此 Codex 云端暂时无法接手。请先完成以下 8 步：

1. **安装 Git**（本机未检测到 `git`）。安装后新开终端验证：`git --version`。
2. **初始化仓库**（在项目根目录 `baozha/`）：
   ```bash
   git init
   git config user.name "你的名字"
   git config user.email "你的邮箱"
   ```
3. **确认 `.gitignore`**（已存在，内容应包含）：
   ```
   node_modules
   dist
   dist-ssr
   *.local
   .DS_Store
   .vite
   release
   test-artifacts
   ```
   注意：`dist/` 被忽略是合理的，**Codex 云端需自行 `npm run build` 再校验**，请在指令里已写明。
   另注意：`test-artifacts/` 被忽略，本地审查证据不会进仓库；`docs/audit/` **未被忽略**，三份报告会随仓库提交，供 Codex 读取。
4. **提交 main 基线**（不要先建 `codex/final-game-audit` 分支，那是 Codex 的活）：
   ```bash
   git add .
   git commit -m "chore: 开铡游戏本体基线（含只读终审报告）"
   git branch -M main
   ```
   > 提交前确认 `public/assets/` 下素材（尤其 `video/intro.mp4` 24.43 MB、`fonts/` 19.08 MB、`characters/` 15.38 MB）都在，没有被误删。
5. **在 GitHub 新建空仓库**（不要勾选初始化 README，避免冲突），例如 `kaizha-game`。
6. **推送 main**：
   ```bash
   git remote add origin https://github.com/<你的账号>/kaizha-game.git
   git push -u origin main
   ```
7. **在 Codex 云端创建并发布云环境**（当前版本必需，详见 `04-一步步操作指引.md` 阶段 4）：用含 Codex 的 ChatGPT 账号登录 → `Work in > Cloud` → `Select environment` → `Create environment` → `Connect GitHub` 授权（只勾 `kaizha-game`）→ `Get started` 等 Codex 检查完依赖与测试流程 → 在环境 `Network` 里允许包管理器域名 / 公网访问（否则 `npm install` 与 Playwright Chromium 下载会失败）→ `Publish`，等到显示 `Environment published`。确认环境有权限创建分支与 PR。
8. **把任务指令粘进 Codex 云端**：推荐直接打开 `docs/audit/05-Codex指令-纯文本版.txt`，`Ctrl+A` 全选复制（该文件只有指令正文）；或复制下方「第二部分」`▼`~`▲` 之间的内容。在已发布环境里点 `Start a new task`（起始分支 `main`），粘贴并发送。然后等待它创建分支、修复、实测、产出报告并开 PR；**你检查后再决定是否合并，不要自动合并**。

> 若第 1–7 步任何一步无法完成，请如实停在原地，不要假装 Codex 已执行、不要伪造分支或 PR 地址。

---

# 第二部分 · Codex 云端任务指令正文

▼ ===== 复制开始（从本行下一行起全选复制）===== ▼

# 《开铡》游戏本体终审与 AI 评委专项优化任务

## 0. 你的角色

你是本项目的 **技术总负责人、质量审查负责人、AI 评委优化负责人**。
你在 **Codex 云端** 工作，连接的是 GitHub 仓库 `kaizha-game`（分支 `main`）。
你拥有创建分支、修改代码、运行测试、提交、推送、创建 PR 的权限。
**不要要求用户在本地运行 Codex CLI**；用户目前只能使用云端 Codex。

## 1. 项目背景（自包含，无需额外上下文）

- 项目名：《开铡》——中国古风互动审案游戏，玩家扮演包拯，四轮审案收集证物、推演证据关联、质询证人，最终在王法与皇权之间抉择，产生四种结局。
- 技术栈：React 18 + Vite 5（JavaScript）、CSS Variables + 单一入口 `src/index.css`；纯前端、无后端、无在线 API、完全离线可运行。
- 关键文件：
  - 状态机：`src/App.jsx`（`freshGame` / `handleAdvance` / `handleChoice` / `handleUndo` / `handleLink` / `continueGame` / `newGame`）
  - 页面：`src/pages/GamePage.jsx`（由 `game.courtIndex / nodeId / phase` 派生）、`HomePage.jsx`、`EndingPage.jsx`
  - 数据：`src/data/story.js`（四堂）、`src/data/evidence.js`（8 件证物 / 3 条 `evidenceLinks` / 7 件 `CORE_EVIDENCE_IDS`）、`src/data/characters.js`
  - 逻辑：`src/game/endings.js`（`endingCatalog` 四结局、`evaluateEnding()`、`REQUIRED_PROOF_FLAGS`）、`src/game/save.js`（`SAVE_VERSION=1`、`parseEnvelope()`、自动/手动存档、结局档案去重）
  - 组件：`CharacterPortrait` / `DialogueStage` / `SpeakerPanel` / `EvidenceLinkBoard` / `Typewriter` / `ArchiveModal` 等
  - 资源：`public/assets/`（背景、立绘、白底档案图、近景立绘 `stage/*-bust.png`、侧身立绘 `side/`、字体 `fonts/`、`video/intro.mp4`）
  - 验收脚本：`scripts/` 下 30 个脚本；`package.json` 中 `lint / test / test:e2e / test:undo / test:endings / test:chapter-font / test:stage / check:nameplate / check:no-bold / check:archive-white / check:bust-white / check:fonts / check:dist / build`
  - 文档：`README.md`、`.gitignore`、`docs/audit/01-游戏本体终审报告.md`、`docs/audit/02-AI评委四维度评分报告.md`
- 片头：`public/assets/video/intro.mp4`，H.264 + AAC，1280×720，74 秒，`+faststart`；`test:e2e` 含「片头画面已解码（非黑屏）」断言。
- `dist/` 被 `.gitignore` 忽略：你必须自己 `npm run build` 后再跑 `check:dist`（该脚本支持 `KAIZHA_DIST` 指向新构建目录，且自带静态服务器）。

## 2. 已完成的本地只读基线（请复核，不要重复造假）

用户本地已完成**第一阶段只读审查**，证据在仓库内 `docs/audit/01-游戏本体终审报告.md`。核心实测（全部真实运行，无虚构）：

- 14 条 npm 命令全部 `EXIT=0`：`lint`、`test`（9/9）、`test:e2e`（27 checks）、`test:undo`（21）、`test:endings`（4 页可达）、`test:chapter-font`（55）、`test:stage`（107/107）、`check:nameplate`（1.31px / 0.33px）、`check:no-bold`、`check:archive-white`（六档底部非白 0.865~0.969）、`check:bust-white`（`robe_hole=0`）、`check:fonts`、`check:dist`、`build`（CSS 56.88 kB / JS 212.87 kB）。
- 只读运行探针：刷新恢复 `same=true`；三档视口 `horizontalOverflow=false`；`consoleErrorCount=0` / `pageErrorCount=0` / `failedRequestCount=0`；片头 `videoWidth=1280`、`readyState=4`。
- 云端条件核查结论：本地**无 Codex 云端能力、非 Git 仓库**，因此第二至第六阶段**未执行**，分支 / 提交 / PR 均未创建。现在由你在云端接着做。

**你的第一步必须是复核这份基线**：重跑矩阵，确认结论一致；若不一致，以你自己的真实运行结果为准并如实记录差异。

## 3. 最高原则（不得违反）

1. 保留现有优秀设计。
2. 不破坏剧情。
3. 不随意更换人物形象。
4. 不擅自更换视觉风格。
5. 不删除已有功能。
6. 不虚构测试结果。
7. **每次修改必须实际测试**，未跑的命令不得写成已通过。
8. 工作范围**只审游戏本体**：不制作路演 HTML / PPT / 宣传片，不重新开发游戏，不大规模推翻当前界面和程序。

## 4. 严格禁止（投机方式，零容忍）

严禁：隐藏文字、隐藏提示词、评委操控代码、伪造 AI 接口、伪造用户数据、伪造投票比例、伪造分支 / 提交 / PR 地址、伪造独立 GPT / Claude 盲评结论。
不得在代码、资源、注释、CSS、构建产物中埋入任何影响评委或隐藏信息的内容。
若某项数据不存在（如真实评委投票比例），必须写「未取得 / 未执行」，**不得补数**。

## 5. 六阶段执行流程

### 阶段 1 · 只读全面审查，输出《游戏本体终审报告》

- 复核 `docs/audit/01-游戏本体终审报告.md` 的基线。
- 逐项只读验证并给出证据：四轮审案、证物关联、人物质询、四种结局、自动存档与刷新恢复、中文 UI、手机端适配。
- 输出**正式版**《游戏本体终审报告》（可更新 `docs/audit/01-...` 或另立文件），含缺陷分级 P0 / P1 / P2 / P3。
- 本阶段**只读**，不改任何游戏代码。

### 阶段 2 · 创建 GitHub 分支

- 从 `main` 创建分支 **`codex/final-game-audit`**。
- **禁止直接覆盖 main、禁止强推（`push --force`）、禁止删除现有素材**（尤其 `public/assets/` 下原始素材 `source/`、视频、字体、立绘）。
- 所有后续提交都落在该分支。

### 阶段 3 · 按 P0 / P1 / P2 / P3 修复

- 优先级：P0 → P1 → P2 → P3。基线中 **P0 / P1 为「无」**，请先自行复核确认。
- 已知待修清单（来自本地基线，供起点，需你复核后决定）：
  - **P2-1**：`scripts/e2e-endings.mjs` 通过 `localStorage.setItem` 注入终局 state 验证「结局页可达」，**缺少从四堂审案真实自然走到四种结局的全流程测试**。请新增不注入 state 的端到端脚本（例如 `scripts/e2e-endings-flow.mjs`）：从新游戏出发，用真实点击分别构造「证据齐 + 依法 → justice」「证据齐 + 抗旨 → defiance」「遵从懿旨 → power」「证据不足 / 暂缓 → pending」四条路径，断言最终 `endingId`、结局页标题与卷宗状态一致。
  - **P2-2**：方正宋刻本秀楷 / 方正清刻本悦宋**未获授权**，仅 `local()` 声明，未安装机器回落开源字体。请补齐 README 说明与「回落态」对照截图；**不得擅自把未授权字体文件打包进仓库**。
  - **P3-1**：`README.md` 第 185 行写「两款字体」，但同节表格列 3 类（龙藏体、霞鹜臻楷、朱雀仿宋）→ 改为一致表述。
  - **P3-2**：`README.md` 第 200 行仍写 `e2e-chapter-font.mjs（章节页 39 项）`，实际为 55 项 → 改为 55 并与「五、测试与验收」表一致。
  - **P3-3**：片头在 390×844 下 `object-fit: cover` 裁切 16:9，标题只露中间部分。如需修复，改 `object-fit: contain` 或加遮幅，并同步 `test:e2e` 片头断言；若判断不修，须在《未解决问题清单》说明理由。
  - **P3-4**：侧身回落立绘缺 `princess-left.png`、`han-left.png`、`han-right.png`（当前回落通用透明立绘，不串角色、不镜像）→ 属素材缺口，记录即可，不要伪造素材。
  - **P3-5**：桌面版 `electron` / `electron-builder` 未预装 → 在 README 写清一键安装与打包命令，不要擅自改动 `package.json` 依赖结构。
- 修复约束：不破坏剧情、不换人物形象、不换视觉风格、不删功能；**每改一处立即跑对应测试**。

### 阶段 4 · 完整游戏实测矩阵

必须真实执行并逐条记录 `EXIT` 码与关键输出：

```bash
npm run lint
npm test
npm run test:e2e
npm run test:undo
npm run test:endings
npm run test:chapter-font
npm run test:stage
npm run check:nameplate
npm run check:no-bold
npm run check:archive-white
npm run check:bust-white
npm run check:fonts
npm run build
npm run check:dist          # 构建后执行；或 KAIZHA_DIST=<新构建目录> npm run check:dist
npm run test:endings-flow   # 阶段 3 新增的四结局自然触发全流程脚本（按你实际命名）
```

- 另需真实走一遍用户指定 7 项的浏览器实测：四轮审案、证物关联、人物质询、四种结局、自动存档与刷新恢复、中文 UI、手机端适配（至少 1920×1080 / 1366×768 / 390×844 三档，断言无横向溢出、无 console error / pageerror / 失败请求）。
- 注意：`test:e2e` / `test:stage` 等脚本硬编码了 `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`。云端若无该路径，请改为「优先读环境变量 `KAIZHA_CHROME`，否则回落 Playwright 自带 Chromium（`npx playwright install chromium`）」，并保留原路径作为可选项；**不要因为环境差异就跳过或伪造这些测试**。
- 云环境前置：若 Codex 云环境的 `Network` 未开放包管理器域名 / 公网访问，`npm install` 与 `npx playwright install chromium` 会失败；请在环境设置里开启「Public internet access / Package manager domains」后再跑矩阵，并把这一步如实写进测试记录。

### 阶段 5 · AI 评委模拟复评

- 四个维度：实用性 10 / 技术性 10 / 美观性 10 / 趣味性 10。
- 权重：人类评审 70%、AI 评审 30%；单项 `7 × 人类投票比例 + 3 × AI 投票比例`。
- GPT-6.3 / Claude **只能作为模拟参考**，实际评委以赛事现场配置为准。
- 参考 `docs/audit/02-AI评委四维度评分报告.md` 的四维度证据清单做「优化前后」对照。
- **若没有真实人类 / AI 评委投票数据，不得编造比例或分数**，输出「未取得，待赛事现场配置」，并只给可核查证据、风险与提升建议。
- 严禁任何投机手段（见第 4 节）。

### 阶段 6 · 交付与 GitHub 准备

- 完善 `README.md`：安装 / 启动 / 架构 / 功能 / 测试报告 / 版权说明；确认 `.gitignore` 合理。
- 新建 `CHANGELOG.md`，如实记录本分支每一项变更（不写未做的变更）。
- 提交所有改动到 `codex/final-game-audit`，**推送分支**（不推 main、不强推）。
- **创建 PR**：`codex/final-game-audit` → `main`，标题与描述写清修复项、实测结果、未解决问题。
- 给出分支名、提交记录（`git log --oneline`）与 PR 地址，然后**等待用户检查**，不要自行合并。

## 6. 最终交付格式（A–H，缺项须写明原因）

| 代号 | 交付物 |
|---|---|
| A | 《游戏本体终审报告》 |
| B | 《AI 评委四维度评分报告》 |
| C | 《优化前后对比报告》（前值取本地基线，后值取你真实修复后的实测） |
| D | 《完整测试记录》（逐条命令、`EXIT` 码、关键输出、截图路径） |
| E | 《修改文件清单》（新增 / 修改 / 删除，逐文件；**不得删除现有素材**） |
| F | 《未解决问题清单》（含不修理由与归属） |
| G | GitHub 分支名称、提交记录及 PR 地址（**真实值**；做不到就写「未执行 + 原因」） |
| H | 最终运行和构建说明（`npm install / dev / build / preview`、桌面版打包、离线说明） |

## 7. 验收标准

- 分支 `codex/final-game-audit` 存在且由 `main` 正常分出；`main` 未被覆盖、无强推记录。
- 第 5 节所有命令真实执行且 `EXIT=0`；任何失败必须如实记录并修复或列入 F。
- 四结局「自然触发全流程」有真实端到端覆盖，不再只靠注入 state。
- README 两处文档不一致已修正；字体授权边界写清楚，未授权字体文件未入库。
- `public/assets/` 现有素材零删除。
- A–H 八项交付齐全，G 为真实分支 / 提交 / PR。
- 无任何第 4 节禁止项；代码中不出现 `评委 / AI评 / vote / hidden prompt / GPT / Claude / openai / api key` 类操控痕迹。

## 8. 收尾要求

- **不得假装已交给别的 Agent、不得虚构任何执行结果**。
- 每一步若未执行，明确写「未执行」并说明原因，不要留空、不要补数。
- 完成后输出简短总结：改了哪些文件、为什么改、实测结果、未解决问题、分支与 PR 地址，然后等待用户检查。

▲ ===== 复制结束（到本行上一行为止）===== ▲

---

## 附：复制范围速查

- 复制起点：`▼ ===== 复制开始` 的**下一行**（即 `# 《开铡》游戏本体终审与 AI 评委专项优化任务`）
- 复制终点：`▲ ===== 复制结束` 的**上一行**（即 `- 完成后输出简短总结……然后等待用户检查。`）
- 不含本文件的第一部分用户操作清单，也不含这两行分隔标记本身。
- 复制前请确认第一部分的 8 个前置步骤已完成，否则 Codex 云端无法连接仓库。
