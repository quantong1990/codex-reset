# Quota Cycle · 限额刷新周期计算器

> 输入你一天开启工作的时间，自动算出一天里每个「限额窗口」的最佳刷新时间点，并生成可直接交给 AI Agent 执行的自动化提示词。
>
> Enter the time you start work each day, and Quota Cycle computes the best refresh moments for every daily "quota window", then generates an automation prompt you can hand straight to an AI Agent.

![Quota Cycle 页面预览 / Page preview](preview.png)

*页面效果 / Page preview — 默认 09:00 起点，把 24 小时切分为五个衔接的 5 小时限额窗口，并实时生成可一键复制的激活提示词。*

---

## 背景 | Background

Codex、Claude Code 等 Agent 的订阅都按**滚动 5 小时窗口**计量：窗口从你的第一条消息开始计时，而不是从你坐下干活开始。于是常出现尴尬局面——工作三小时就用完额度，却只能干等两小时等窗口重置。

Subscriptions for Agents like Codex and Claude Code are metered by **rolling 5-hour windows**: the window starts counting from your first message, not from when you actually sit down to work. The awkward result is common — you burn through the quota in three hours of work, then are forced to idle for two hours waiting for the window to reset.

**Quota Cycle** 把这个问题产品化：以 24 小时表盘为单位，把一天切成若干衔接的限额窗口，并输出一段**激活提示词**——交给后台 Agent，让它每天在固定时间点打招呼、激活新的限额窗口即可。

**Quota Cycle** turns this into a product: it uses a 24-hour dial to split the day into consecutive quota windows, then outputs an **activation prompt** — hand it to a background Agent, and it will greet you and trigger a fresh quota window at fixed times every day.

---

## 使用场景 | Use Case

> Codex 和 Claude Code 等 Agent 的订阅都按滚动 5 小时窗口计量，窗口从你的第一条消息开始计时，而不是从你坐下干活开始。不想工作三小时就用完额度、只能白白干等两小时的尴尬情况，下面的限额激活方式就非常适合你：

> Subscriptions for Agents like Codex and Claude Code are metered by rolling 5-hour windows — the window starts counting from your first message, not from when you sit down to work. Nobody wants to burn the quota in three hours of work and then be forced to idly wait two hours for the reset. The quota-activation routine below is exactly for you:

1. **你习惯 9 点开始工作。** Agent 会自动在 7:00 发第一条消息激活窗口（7:00–12:00）。9 点工作到 12 点午饭休息，相当于 3 小时里用满 5 小时的额度。
   **You usually start work at 9.** The Agent automatically sends its first message at 7:00 to activate the window (7:00–12:00). You work 9 to 12 then take lunch — burning a full 5-hour quota within just 3 hours of actual work.

2. **12 点–14 点，午饭午休。** Agent 会自动在 12:02 发第二条消息激活窗口（12:02–17:02）。延迟两分钟是为了确保不被网络波动影响激活。14 点开始工作到 17 点，同样 3 小时里用满 5 小时的额度。
   **12:00–14:00, lunch break.** The Agent automatically sends its second message at 12:02 to activate the window (12:02–17:02). The 2-minute delay guards against network jitter breaking the activation. You work 14:00 to 17:00, again burning the full 5-hour quota in 3 hours.

3. **17 点–19 点，该下班吃晚饭了。** Agent 会自动在 17:04 发第三条消息激活窗口（17:04–22:04）。此时无论你是计划下班回家，还是选择加班到八九点，都可以在这段时间畅用新的 5 小时窗口。
   **17:00–19:00, time to leave for dinner.** The Agent automatically sends its third message at 17:04 to activate the window (17:04–22:04). Whether you head home or work late into the evening, you have a fresh 5-hour window to use freely.

4. **22 点，你回到家洗漱完。** Agent 会自动在 22:06 发第四条消息激活窗口（22:06–03:06）。此时你还有些事情想处理，或者想用 AI 做点什么，都可以拥有新的 5 小时窗口。
   **22:00, back home and washed up.** The Agent automatically sends its fourth message at 22:06 to activate the window (22:06–03:06). If you still have things to handle or want to use AI for something, you get yet another fresh 5-hour window.

5. **凌晨深夜，你已经睡了。** Agent 会默默等待，不随便激活，直到第二天 7:00，又是额度满满的一天！
   **Late at night you're already asleep.** The Agent waits silently and does not activate randomly — until the next day at 7:00, when it's another day with a full quota!

> 这套节奏对应的工具设置：开始时间 **7:00**、限额时长 **5 小时**、消差延时 **2 分钟**，提示词即生成上面的 `【07:00】【12:02】【17:04】【22:06】`。
>
> This rhythm maps to the tool settings: start time **7:00**, quota duration **5 hours**, stagger **2 minutes** — which generates the `【07:00】【12:02】【17:04】【22:06】` schedule above.

---

## 核心功能 | Core Features

- **限额时长可调**：2–12 小时，默认 5 小时。
  **Adjustable quota duration:** 2–12 hours, default 5.
- **24 小时自适应填充**：完整窗口不足 6 个时循环重复（第一个重复标「第二天 Day 2」）；多出 1 段用「回流段」收尾（不激活，让精力回血）；窗口数超过 6 个时自动换行。
  **24-hour adaptive fill:** if there are fewer than 6 full windows, they cycle and repeat (the first repeat is tagged "Day 2"); any remainder becomes a "return segment" (inactive, a mental reset); more than 6 windows wrap to new rows automatically.
- **断开衔接模式**：关闭时 24 小时自动首尾衔接；开启后 5 个 Session 各自独立，可单独拖动任意时钟而不影响其它。
  **Disconnect mode:** when off, the 24 hours auto-chain; when on, the 5 sessions are independent and any clock can be dragged without affecting the others.
- **休息模式**：提前激活 Agent，前 N 小时休息、后段集中输出，把 5 小时窗口压缩成更短的有效工作段。
  **Rest mode:** activates the Agent early, rests for the first N hours then concentrates output — compressing the 5-hour window into a shorter effective work block.
- **指针可拖动**：直接拖时钟上的黑针（激活）/ 金针（结束）/ 红针（休息分隔）来平移窗口。
  **Draggable hands:** drag the black (activate) / gold (end) / red (rest) hands on each clock to shift the window.
- **消差延时（stagger）**：提示词里第 i 个激活点 = 窗口起点 + i × 延时（默认 2 分钟），给激活留缓冲，避免上一个窗口尚未释放、下一个激活因延迟而失败。
  **Stagger delay:** the i-th activation point in the prompt = window start + i × delay (default 2 min), giving a buffer so the next activation doesn't fail because the previous window hasn't released yet.
- **激活提示词实时生成 + 一键复制**：时间随时钟联动、回流段自动跳过；提示词可手动修改，复制按钮复制框内全部内容。
  **Live prompt + one-click copy:** times track the clocks and skip return segments; the prompt is editable, and the copy button copies everything in the box.

### 提示词示例 | Example Prompt

默认 09:00 / 5h / 消差延时 2min 时：

With default 09:00 / 5h / stagger 2min:

```
设置定时任务，每天在以下固定时间点【09:00】【14:02】【19:04】【00:06】，向我打一声招呼，激活当前的5小时限额窗口。以上自动化全部保持每天启用，对话后台静默执行，不主动打开新的可见对话窗口，仅在失败或需要处理时补充说明。
```

消差延时调到 5 分钟时，对应变为 `【09:00】【14:05】【19:10】【00:15】`（见上文使用场景的 7:00 版本）。

Set the stagger to 5 minutes and it becomes `【09:00】【14:05】【19:10】【00:15】` (see the 7:00 variant in the Use Case above).

---

## 使用方法 | How to Use

1. 在「输入你开始工作的时间」设置起点；
   Set the start time in "输入你开始工作的时间" (your work start time).
2. 按需开关 **休息模式** / **断开衔接**，调节 **限额时长** 与 **消差延时**；
   Toggle **Rest mode** / **Disconnect** as needed, and adjust **Quota duration** and **Stagger**.
3. 拖动时钟指针微调窗口；
   Drag the clock hands to fine-tune windows.
4. 页面底部的「激活提示词」会自动跟着变，点 **一键复制** 即可交给你的 Agent。
   The "激活提示词" (activation prompt) at the bottom updates live — click **一键复制** (copy) and hand it to your Agent.

---

## 本地运行 | Run Locally

纯静态页面，零依赖、无构建步骤。**任选其一：**

Zero-dependency, no-build static page. **Either works:**

- 直接双击 `index.html` 用浏览器打开即可；
  Just double-click `index.html` to open it in a browser.
- 或起一个本地静态服务器：
  Or run a local static server:
  ```bash
  cd quota-cycle
  python3 -m http.server 8765
  # 浏览器访问 http://localhost:8765/
  # Open http://localhost:8765/ in your browser
  ```

### 运行测试 | Run Tests

```bash
node test.js
```

逻辑部分用 Node 做断言测试（窗口切分、回流段、循环重复、激活时间生成等）。

A Node assertion suite covers window splitting, return segments, cycle repeats, and activation-time generation.

---

## 技术栈 | Tech Stack

- 纯 **HTML + CSS + 原生 JS**，无框架、无打包工具；
  Pure **HTML + CSS + vanilla JS** — no framework, no bundler.
- 时钟与高亮弧使用内联 **SVG** 绘制；
  Clocks and highlight arcs are drawn with inline **SVG**.
- 状态与渲染分离，`state` 单一数据源驱动整页重绘；
  State and rendering are separated; a single `state` source of truth drives the whole repaint.
- 提示词时间令牌采用「原地替换」策略，用户手动改过文案后，调时钟只更新时间、保留其它文字。
  Prompt time tokens use an "in-place replace" strategy: after you edit the text, changing clocks only updates the times and keeps the rest of your wording.

---

## 项目结构 | Project Structure

```
quota-cycle/
├── index.html    # 页面结构（选项区 / 时钟容器 / 提示词区）
├── style.css     # 暖米色视觉风格与布局
├── app.js        # 状态、SVG 时钟渲染、拖动、提示词生成逻辑
├── test.js       # 纯逻辑单元测试（node test.js）
└── README.md
```

Directory layout / 目录说明:
- `index.html` — page structure (options / clocks / prompt)
- `style.css` — warm visual theme and layout
- `app.js` — state, SVG clock rendering, dragging, prompt logic
- `test.js` — pure-logic unit tests (`node test.js`)

---

## 在线演示 | Live Demo

- 实时预览 / Live preview: https://quantong1990.github.io/quota-cycle/
- 源码仓库 / Source: https://github.com/quantong1990/quota-cycle

---

## 备注 | Notes

本项目为个人效率工具，用于演示「把计费窗口节奏产品化、并用 Agent 自动化执行」这一思路。如果你也在做 AI 产品方向相关工作，欢迎交流。

This is a personal productivity tool demonstrating the idea of "productizing the billing-window rhythm and automating it with Agents." If you work in AI product, feel free to reach out.
