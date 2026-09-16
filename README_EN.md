# codex-reset · Quota Refresh Cycle Calculator

> 📘 中文版 / Chinese version: [README.md](README.md)

> ⭐ **Like this project?** Drop a [Star on GitHub](https://github.com/quantong1990/codex-reset) to support it and help more people find it.

> Enter the time you start work each day, and codex-reset computes the best refresh moments for every daily "quota window", then generates an automation prompt you can hand straight to an AI Agent.

![codex-reset page preview](preview.png)

*Page preview — with the default 09:00 start, the 24 hours are split into five consecutive 5-hour quota windows, and a copy-ready activation prompt is generated live.*

---

## Background

Subscriptions for Agents like Codex and Claude Code are metered by **rolling 5-hour windows**: the window starts counting from your first message, not from when you actually sit down to work. The awkward result is common — you burn through the quota in three hours of work, then are forced to idle for two hours waiting for the window to reset.

**codex-reset** turns this into a product: it uses a 24-hour dial to split the day into consecutive quota windows, then outputs an **activation prompt** — hand it to a background Agent, and it will greet you and trigger a fresh quota window at fixed times every day.

---

## Use Case

> Subscriptions for Agents like Codex and Claude Code are metered by rolling 5-hour windows — the window starts counting from your first message, not from when you sit down to work. Nobody wants to burn the quota in three hours of work and then be forced to idly wait two hours for the reset. The quota-activation routine below is exactly for you:

1. **You usually start work at 9.** The Agent automatically sends its first message at 7:00 to activate the window (7:00–12:00). You work 9 to 12 then take lunch — burning a full 5-hour quota within just 3 hours of actual work.
2. **12:00–14:00, lunch break.** The Agent automatically sends its second message at 12:00 to activate the window (12:00–17:00). You work 14:00 to 17:00, again burning the full 5-hour quota in 3 hours.
3. **17:00–19:00, time to leave for dinner.** The Agent automatically sends its third message at 17:00 to activate the window (17:00–22:00). Whether you head home or work late into the evening, you have a fresh 5-hour window to use freely.
4. **22:00, back home and washed up.** The Agent automatically sends its fourth message at 22:00 to activate the window (22:00–03:00). If you still have things to handle or want to use AI for something, you get yet another fresh 5-hour window.
5. **Late at night you're already asleep.** The Agent waits silently and does not activate randomly — until the next day at 7:00, when it's another day with a full quota!

* To guard against network jitter breaking the activation, each activation time in the prompt is shifted back by 2 minutes, i.e. 【07:00】【12:02】【17:04】【22:06】.

> This rhythm maps to the tool settings: start time **7:00**, quota duration **5 hours**, stagger **2 minutes** — which generates the `【07:00】【12:02】【17:04】【22:06】` schedule above.

---

## Core Features

- **Adjustable quota duration:** 2–12 hours, default 5.
- **24-hour adaptive fill:** if there are fewer than 6 full windows, they cycle and repeat (the first repeat is tagged "Day 2"); any remainder becomes a "return segment" (inactive, a mental reset); more than 6 windows wrap to new rows automatically.
- **Disconnect mode:** when off, the 24 hours auto-chain; when on, the 5 sessions are independent and any clock can be dragged without affecting the others.
- **Rest mode:** activates the Agent early, rests for the first N hours then concentrates output — compressing the 5-hour window into a shorter effective work block.
- **Draggable hands:** drag the black (activate) / gold (end) / red (rest) hands on each clock to shift the window.
- **Stagger delay:** the i-th activation point in the prompt = window start + i × delay (default 2 min), giving a buffer so the next activation doesn't fail because the previous window hasn't released yet.
- **Live prompt + one-click copy:** times track the clocks and skip return segments; the prompt is editable, and the copy button copies everything in the box.

### Example Prompt

With default 09:00 / 5h / stagger 2 min:

```
设置定时任务，每天在以下固定时间（以我电脑的时区为准）：【09:00】【14:02】【19:04】【00:06】，向我发送一句话："窗口已激活"。
```

Set the stagger to 5 minutes and it becomes `【09:00】【14:05】【19:10】【00:15】` (see the 7:00 variant in the Use Case above).

---

## How to Use

1. Set the start time in "输入你开始工作的时间" (your work start time);
2. Toggle **Rest mode** / **Disconnect** as needed, and adjust **Quota duration** and **Stagger**;
3. Drag the clock hands to fine-tune windows;
4. The "激活提示词" (activation prompt) at the bottom updates live — click **一键复制** (copy) and hand it to your Agent.

---

## Run Locally

Zero-dependency, no-build static page. **Either works:**

- Just double-click `index.html` to open it in a browser;
- Or run a local static server:
  ```bash
  cd codex-reset
  python3 -m http.server 8765
  # Open http://localhost:8765/ in your browser
  ```

### Run Tests

```bash
node test.js
```

A Node assertion suite covers window splitting, return segments, cycle repeats, and activation-time generation.

---

## Tech Stack

- Pure **HTML + CSS + vanilla JS** — no framework, no bundler.
- Clocks and highlight arcs are drawn with inline **SVG**.
- State and rendering are separated; a single `state` source of truth drives the whole repaint.
- Prompt time tokens use an "in-place replace" strategy: after you edit the text, changing clocks only updates the times and keeps the rest of your wording.

---

## Project Structure

```
codex-reset/
├── index.html    # page structure (options / clocks / prompt)
├── style.css     # warm visual theme and layout
├── app.js        # state, SVG clock rendering, dragging, prompt logic
├── test.js       # pure-logic unit tests (node test.js)
├── README.md     # Chinese documentation (default)
└── README_EN.md  # English documentation
```

Directory layout:
- `index.html` — page structure (options / clocks / prompt)
- `style.css` — warm visual theme and layout
- `app.js` — state, SVG clock rendering, dragging, prompt logic
- `test.js` — pure-logic unit tests (`node test.js`)
- `README.md` — Chinese documentation (default)
- `README_EN.md` — English documentation

---

## Live Demo

- Live preview: https://quantong1990.github.io/codex-reset/
- Source: https://github.com/quantong1990/codex-reset

---

## Notes

This is a personal productivity tool demonstrating the idea of "productizing the billing-window rhythm and automating it with Agents." If you work in AI product, feel free to reach out.
