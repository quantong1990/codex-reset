/* =========================================================
   codex-reset · 限额刷新周期计算器
   - 限额窗口时长可调（2~12h），默认 5h
   - 自动用 N 个完整窗口 + 1 个回流段凑满 24h；不足 6 个时钟时循环重复
   - 断开衔接后可独立拖动每个 Session
   ========================================================= */

const SVG_NS = 'http://www.w3.org/2000/svg';
const DAY_MINUTES = 24 * 60;        // 24h = 1440 分钟

// Node 测试环境下没有 document，做兼容守卫（浏览器下行为完全一致）
const $hour   = typeof document !== 'undefined' ? document.getElementById('hour')    : null;
const $minute = typeof document !== 'undefined' ? document.getElementById('minute')  : null;
const $nowBtn = typeof document !== 'undefined' ? document.getElementById('now-btn') : null;
const $clocks = typeof document !== 'undefined' ? document.getElementById('clocks')  : null;
const $earlyToggle = typeof document !== 'undefined' ? document.getElementById('early-toggle') : null;
const $indepToggle = typeof document !== 'undefined' ? document.getElementById('independent-toggle') : null;
const $duration = typeof document !== 'undefined' ? document.getElementById('duration') : null;
const $stagger = typeof document !== 'undefined' ? document.getElementById('stagger') : null;
const $promptText = typeof document !== 'undefined' ? document.getElementById('prompt-text') : null;
const $copyBtn = typeof document !== 'undefined' ? document.getElementById('copy-btn') : null;

/* ---------- 全局状态 ----------
   time      输入时间 T（分钟，0..1439），始终显示在输入框 = Session I 红针位置
   restOn    休息模式开关
   restLeads 各 Session 独立的休息时长（分钟，60..240），下标 0..3 对应 Session I~IV
             Session VI（Day 2）与 Session I 是同一窗口，共享下标 0
   slotHours 每个限额窗口时长（小时，2..12），默认 5
   independent 断开衔接开关：关闭时 24h 循环自动衔接；开启时 5 个 Session 各自独立
   starts    独立模式下 5 个 Session 的区块起点
   staggerMinutes 消差延时：提示词中第 i 个激活时间 = 黑针时间 + i × 该值（分钟）
   dragShift 累计整点偏移，用于小时级吸附拖动 */
const state = {
  time: 9 * 60,
  restOn: false,
  restLeads: [120, 120, 120, 120],
  slotHours: 5,
  independent: false,
  starts: [9 * 60, 14 * 60, 19 * 60, 0 * 60, 5 * 60],
  staggerMinutes: 2
};

function slotMinutes() { return state.slotHours * 60; }
function maxRestLead() { return Math.max(60, Math.min(240, slotMinutes() - 60)); }

/* ---------- 时间分段计算 ---------- */
/* 罗马数字：支持 1..12 */
function toRoman(n) {
  const map = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  return map[n] || String(n);
}

/* 根据起始时间和当前限额时长，生成覆盖 24h 的最小 unique 窗口序列
   返回数组元素：{ start, end, index(1-based), isReturn, durationMinutes } */
function buildUniqueSlots(start) {
  const dur = slotMinutes();
  const slots = [];
  let cursor = start % DAY_MINUTES;
  let remaining = DAY_MINUTES;
  let idx = 1;
  while (remaining >= dur) {
    const rawEnd = cursor + dur;
    slots.push({
      start: cursor % DAY_MINUTES,
      end: rawEnd > DAY_MINUTES ? rawEnd - DAY_MINUTES : rawEnd,
      index: idx,
      isReturn: false,
      durationMinutes: dur
    });
    cursor = (cursor + dur) % DAY_MINUTES;
    remaining -= dur;
    idx++;
  }
  if (remaining > 0) {
    // 回流段：收尾剩余时长，回到起始点
    slots.push({
      start: cursor % DAY_MINUTES,
      end: (cursor + remaining) % DAY_MINUTES,
      index: idx,
      isReturn: true,
      durationMinutes: remaining
    });
  }
  return slots;
}

/* 为兼容旧测试保留的接口：默认 5h，返回 6 个时钟 */
function buildSlots(hour, minute, slotHours = 5) {
  const saved = state.slotHours;
  state.slotHours = slotHours;
  const start = hour * 60 + minute;
  const unique = buildUniqueSlots(start);
  const slots = buildDisplaySlots(unique);
  state.slotHours = saved;
  return slots;
}

/* 由独立模式下的 5 个区块起点生成 6 个时钟（VI 复制 I） */
function buildIndependentSlots() {
  const dur = slotMinutes();
  const slots = state.starts.map((start, i) => {
    const rawEnd = start + dur;
    return {
      start: start % DAY_MINUTES,
      end: rawEnd > DAY_MINUTES ? rawEnd - DAY_MINUTES : rawEnd,
      index: i + 1,
      sourceIndex: i + 1,
      isReturn: false,
      durationMinutes: dur,
      isDay2: false
    };
  });
  slots.push({ ...slots[0], index: 6, sourceIndex: 1, isReturn: false, durationMinutes: dur, isDay2: true });
  return slots;
}

/* 把 unique 窗口扩展为展示用的 6 个时钟：unique 不足 6 时循环重复，
   第一个重复项标记为 Day 2；unique >= 6 时直接返回（会换行） */
function buildDisplaySlots(unique) {
  const withSource = unique.map(s => ({ ...s, sourceIndex: s.index, isDay2: false }));
  if (withSource.length >= 6) return withSource;
  const out = withSource.slice();
  let pos = 0;
  while (out.length < 6) {
    const src = withSource[pos % withSource.length];
    out.push({
      ...src,
      index: out.length + 1,
      isDay2: pos === 0 && src.sourceIndex === 1   // 第一个循环重复的 Session I 标 Day 2
    });
    pos++;
  }
  return out;
}

/* Session I 的区块起点：输入时间 = 红针位置，起点要往前扣掉休息时长 */
function sessionIStart() {
  return state.restOn
    ? (state.time - state.restLeads[0] + DAY_MINUTES) % DAY_MINUTES
    : state.time;
}

const pad2 = n => String(n).padStart(2, '0');

function formatMinShort(mins) {
  // 1440 视为 24:00（自然日结束），其他用 HH:MM
  if (mins === DAY_MINUTES) return '24:00';
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function fmtHourLabel(mins) {
  // 直接以 24h 制的小时数显示（2 位）
  return pad2(Math.floor(mins / 60));
}

/* ---------- 时钟角度换算 ----------
   把 24h 时间投到 12h 表盘上：(hour % 12) * 30
   12 点位 = 顶部（数学 -90°），顺时针每小时 +30° */
function hourToAngleRad(h) {
  return ((h % 12) * 30 - 90) * Math.PI / 180;
}

/* ---------- SVG 元素工厂 ---------- */
function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) {
    if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
  }
  return node;
}

function addCircle(svg, cx, cy, r, fill, stroke, strokeWidth) {
  svg.appendChild(el('circle', {
    cx: cx, cy: cy, r: r, fill: fill, stroke: stroke,
    'stroke-width': strokeWidth || 0
  }));
}

function addLine(svg, x1, y1, x2, y2, stroke, strokeWidth, linecap) {
  svg.appendChild(el('line', {
    x1: x1, y1: y1, x2: x2, y2: y2,
    stroke: stroke, 'stroke-width': strokeWidth,
    'stroke-linecap': linecap || 'butt'
  }));
}

function addText(svg, x, y, content, attrs) {
  const t = el('text', Object.assign({
    x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'central'
  }, attrs));
  t.textContent = content;
  svg.appendChild(t);
}

/* ---------- 绘制高亮弧（阴影遮罩） ---------- */
function drawHighlightArc(svg, startHourFrac, endHourFrac, opacity = 0.55, color = '#c4a46c') {
  // 用绝对偏移计算（避免 %12 后丢失 wrap 信息）
  // 例如 start=22, end=27 → 弧从 10 点跨过 12 走到 3 点
  const sa = hourToAngleRad(startHourFrac);
  const ea = hourToAngleRad(endHourFrac);
  const r  = 46;
  const sx = 100 + r * Math.cos(sa);
  const sy = 100 + r * Math.sin(sa);
  const ex = 100 + r * Math.cos(ea);
  const ey = 100 + r * Math.sin(ea);
  // 弧总是 <180°，方向顺时针（sweep-flag = 1）
  svg.appendChild(el('path', {
    d: `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`,
    fill: 'none',
    stroke: color,
    'stroke-width': 16,
    'stroke-linecap': 'round',
    opacity: opacity
  }));
}

/* ---------- 绘制短时针 + 末端时间胶囊 ---------- */
function drawHand(svg, hourFrac, labelMins, isStart) {
  const angle = hourToAngleRad(hourFrac);
  const len = 50;
  const tipX = 100 + len * Math.cos(angle);
  const tipY = 100 + len * Math.sin(angle);

  const color = isStart ? '#1f1d1a' : '#a78966';
  const labelColor = '#fdfaf4';

  // 短时针
  addLine(svg, 100, 100, tipX, tipY, color, 5.5, 'round');

  // 末端胶囊（圆点 + 文字）——可拖动（data-dial = 按下时的表盘小时 0..11）
  svg.appendChild(el('circle', {
    cx: tipX, cy: tipY, r: 17, fill: color,
    'data-hand': '1',
    'data-kind': isStart ? 'start' : 'end',
    'data-dial': String(Math.round(hourFrac) % 12)
  }));
  addText(svg, tipX, tipY, fmtHourLabel(labelMins), {
    'font-family': "'Inter', sans-serif",
    'font-size': 13,
    'font-weight': 700,
    fill: labelColor,
    'letter-spacing': '0.04em'
  });
}

/* ---------- 提前激活：用户时刻的特殊标记 ---------- */
function drawSpecialMarker(svg, hourFrac, labelMins) {
  const angle = hourToAngleRad(hourFrac);
  const len = 50;
  const tipX = 100 + len * Math.cos(angle);
  const tipY = 100 + len * Math.sin(angle);

  // 赭红色短针 + 双色胶囊，和起始（墨）/ 结束（金）形成三色区分；同样可拖动
  addLine(svg, 100, 100, tipX, tipY, '#a94f2c', 5.5, 'round');
  svg.appendChild(el('circle', {
    cx: tipX, cy: tipY, r: 17, fill: '#a94f2c', stroke: '#f4ede4', 'stroke-width': 2.5,
    'data-hand': '1',
    'data-kind': 'red',
    'data-dial': String(Math.round(hourFrac) % 12)
  }));
  addText(svg, tipX, tipY, fmtHourLabel(labelMins), {
    'font-family': "'Inter', sans-serif",
    'font-size': 13,
    'font-weight': 700,
    fill: '#fdfaf4',
    'letter-spacing': '0.04em'
  });
}

/* ---------- 组合单个时钟 ---------- */
function createClockSVG(slot) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('clock-svg');

  // 表盘外环 + 装饰内环
  addCircle(svg, 100, 100, 92, 'none', '#1f1d1a', 2);
  addCircle(svg, 100, 100, 80, 'none', '#d4c8b0', 1);

  // 12 个小时刻度 + 数字
  for (let h = 0; h < 12; h++) {
    const a = hourToAngleRad(h);
    const isMajor = h % 3 === 0;
    const ox = 100 + 85 * Math.cos(a);
    const oy = 100 + 85 * Math.sin(a);
    const ix = 100 + 77 * Math.cos(a);
    const iy = 100 + 77 * Math.sin(a);
    addLine(svg, ox, oy, ix, iy,
      isMajor ? '#1f1d1a' : '#a78966',
      isMajor ? 2.4 : 1.1);

    // 数字标号（外移 + 加大，避开指针胶囊）
    const nx = 100 + 70 * Math.cos(a);
    const ny = 100 + 70 * Math.sin(a);
    addText(svg, nx, ny, h === 0 ? '12' : String(h), {
      'font-family': "'Cormorant Garamond', Georgia, serif",
      'font-size': 16,
      'font-weight': 600,
      fill: '#3a2f25'
    });
  }

  // 高亮弧（阴影遮罩）
  if (slot.earlyUser !== undefined) {
    // 休息模式：前 2h 为休息段——指针色（墨黑）的浅色版；用户时刻之后保持原样
    drawHighlightArc(svg, slot.start / 60, slot.earlyUser / 60, 0.14, '#1f1d1a');
    drawHighlightArc(svg, slot.earlyUser / 60, slot.end / 60, 0.55);
  } else {
    drawHighlightArc(svg, slot.start / 60, slot.end / 60);
  }

  // 两根短时针 + 时间胶囊
  drawHand(svg, slot.start / 60, slot.start, true);
  drawHand(svg, slot.end   / 60, slot.end,   false);

  // 用户输入时刻的特殊标记（仅提前激活时的第一个时钟）
  if (slot.earlyUser !== undefined) {
    drawSpecialMarker(svg, slot.earlyUser / 60, slot.earlyUser);
  }

  // 中心枢轴
  addCircle(svg, 100, 100, 6, '#1f1d1a', 'none', 0);
  addCircle(svg, 100, 100, 2.4, '#a78966', 'none', 0);

  // 给所有可拖胶囊标记所属 Session，用于拖动时定位
  svg.querySelectorAll('[data-hand]').forEach(c => {
    c.setAttribute('data-clock', String(slot.sourceIndex));
    if (slot.isDay2) c.setAttribute('data-day2', '1');
  });

  return svg;
}

/* ---------- 渲染整排 6 个 ---------- */
function renderClocks() {
  const early = state.restOn;
  let slots;

  if (state.independent) {
    // 独立模式：5 个 Session 各自起点；VI 复制 I
    slots = buildIndependentSlots();
  } else {
    // 衔接模式：生成覆盖 24h 的 unique 窗口，不足 6 个时循环重复
    const effMin = sessionIStart();
    const unique = buildUniqueSlots(effMin);
    slots = buildDisplaySlots(unique);
  }

  if (early) {
    slots.forEach(slot => {
      if (slot.isReturn) return;          // 回流段没有红针
      const src = slot.sourceIndex;
      if (slot.isDay2) {
        // Day 2 复制：红针与 Session I 一致
        slot.earlyUser = state.independent
          ? (state.starts[0] + state.restLeads[0]) % DAY_MINUTES
          : state.time;
      } else if (src === 1) {
        // Session I 红针 = 输入时间（激活时间）
        slot.earlyUser = state.time;
      } else if (src >= 2 && src <= 4) {
        // Session II~IV：红针 = 各自起点 + 各自休息时长
        const lead = state.restLeads[src - 1];
        slot.earlyUser = state.independent
          ? (state.starts[src - 1] + lead) % DAY_MINUTES
          : (slot.start + lead) % DAY_MINUTES;
      }
      // src >= 5 不设置红针
    });
  }
  $clocks.innerHTML = '';

  slots.forEach(slot => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    if (!state.independent && slot.isReturn) card.classList.add('is-rest');

    if (slot.isDay2) {
      const tag = document.createElement('span');
      tag.className = 'day2-tag';
      tag.innerHTML = 'Day <em>2</em>';
      card.appendChild(tag);
    }

    const phase = document.createElement('div');
    phase.className = 'phase';
    if (slot.isDay2) {
      phase.innerHTML = `第二天`;
    } else if (slot.earlyUser !== undefined) {
      phase.innerHTML = `Session <em>${toRoman(slot.sourceIndex)}</em> · 休息模式`;
    } else if (!state.independent && slot.isReturn) {
      // 衔接模式回流段
      phase.innerHTML =
        `Session <em>${toRoman(slot.sourceIndex)}</em> · 回流段` +
        `<span class="rest-icon" tabindex="0" role="button" ` +
        `aria-label="回流段说明" title="">!` +
        `<span class="rest-tip">回流段不激活 Agent，休息一下，让精力回到最佳状态！</span>` +
        `</span>`;
    } else {
      phase.innerHTML = `Session <em>${toRoman(slot.sourceIndex)}</em>`;
    }
    card.appendChild(phase);

    card.appendChild(createClockSVG(slot));

    const range = document.createElement('div');
    range.className = 'range';
    range.innerHTML =
      `${formatMinShort(slot.start)}` +
      `<span class="range-arrow">→</span>` +
      `${formatMinShort(slot.end)}`;
    card.appendChild(range);

    // 休息模式：时钟下方标注休息时段（浅墨色小徽章）
    if (slot.earlyUser !== undefined) {
      const rest = document.createElement('div');
      rest.className = 'rest-period';
      rest.innerHTML =
        `<span class="rest-swatch"></span>休息时间 ` +
        `${formatMinShort(slot.start)} → ${formatMinShort(slot.earlyUser)}`;
      card.appendChild(rest);
    }

    $clocks.appendChild(card);
  });

  updatePrompt();   // 提示词时间随时钟联动
}

function clamp(v, min, max) {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/* ---------- 状态 ↔ 输入框同步 ---------- */
function syncInputs() {
  $hour.value   = pad2(Math.floor(state.time / 60));
  $minute.value = pad2(state.time % 60);
}

function applyState() {
  syncInputs();
  renderClocks();
}

/* ---------- 激活提示词 ----------
   提示词时间 = 各时钟黑针（窗口起点）+ 累计消差延时：第 i 个 + i × staggerMinutes
   回流段与 Day 2 重复时钟不参与激活，自动跳过 */
function staggeredTimes(starts, stagger) {
  return starts.map((s, i) => (s + i * stagger) % DAY_MINUTES);
}

function activationStartMinutes() {
  if (state.independent) {
    // 独立模式：5 个 Session 各自起点（Day 2 复制不算）
    return state.starts.map(s => ((s % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
  }
  // 衔接模式：unique 窗口序列，跳过回流段
  return buildUniqueSlots(sessionIStart())
    .filter(s => !s.isReturn)
    .map(s => s.start);
}

function activationTimes() {
  return staggeredTimes(activationStartMinutes(), state.staggerMinutes);
}

function buildPromptText() {
  const times = activationTimes().map(t => `【${formatMinShort(t)}】`).join('');
  return `设置定时任务，每天在以下固定时间（以我电脑的时区为准）：${times}，向我发送一句话："窗口已激活"。`;
}

/* 用户手动改过文案后置为 dirty：之后时钟变化只原地替换【HH:MM】时间令牌，
   保留用户的其它修改；令牌数量对不上（窗口数变化等结构调整）时回退为整体重建 */
let promptDirty = false;

function updatePrompt() {
  if (!$promptText) return;
  if (!promptDirty) {
    $promptText.value = buildPromptText();
    return;
  }
  const newTimes = activationTimes().map(formatMinShort);
  const tokens = $promptText.value.match(/【\d{2}:\d{2}】/g) || [];
  if (tokens.length !== newTimes.length) {
    promptDirty = false;
    $promptText.value = buildPromptText();
    return;
  }
  let i = 0;
  $promptText.value = $promptText.value.replace(/【\d{2}:\d{2}】/g, () => `【${newTimes[i++]}】`);
}

// 输入框内容 → state.time（任一为空时跳过）
// 独立模式下同步更新 Session I 的区块起点，使输入时间始终对应 Session I
function readInputsToState() {
  const h = parseInt($hour.value, 10);
  const m = parseInt($minute.value, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  state.time = clamp(h, 0, 23) * 60 + clamp(m, 0, 59);
  if (state.independent) {
    state.starts[0] = state.restOn
      ? (state.time - state.restLeads[0] + DAY_MINUTES) % DAY_MINUTES
      : state.time;
  }
  return true;
}

/* ---------- 事件绑定 ---------- */
function setupEvents() {
  // 输入框：实时读入 state 后渲染
  $hour.addEventListener('input', () => {
    if (readInputsToState()) renderClocks();
  });

  $minute.addEventListener('input', () => {
    if (readInputsToState()) renderClocks();
  });

  // 步进逻辑（按钮与方向键共用；小时 ±1 循环，分钟 ±5 循环，时长/消差延时 ±1）
  function stepTime(target, delta) {
    if (target === 'stagger') {
      // 消差延时：只改提示词里的激活时间点，绝不影响工作时间和时钟
      const v = clamp(state.staggerMinutes + delta, 0, 30);
      if (v === state.staggerMinutes) return;
      state.staggerMinutes = v;
      if ($stagger) $stagger.value = state.staggerMinutes;
      updatePrompt();
      return;
    }
    if (target === 'duration') {
      const newHours = clamp(state.slotHours + delta, 2, 12);
      if (newHours === state.slotHours) return;
      state.slotHours = newHours;
      if ($duration) $duration.value = state.slotHours;
      // 时长变化后，休息时长不能超过窗口时长-1h，也不低于1h
      state.restLeads = state.restLeads.map(lead => clamp(lead, 60, maxRestLead()));
      // 若处于独立模式，保持各 Session 起点不变，仅窗口长度改变
      applyState();
      return;
    }
    let h = Math.floor(state.time / 60);
    let m = state.time % 60;
    if (target === 'minute') {
      m = Math.round((m + delta) / 5) * 5;
      if (m > 55) m = 0;
      if (m < 0)  m = 55;
    } else {
      h = (h + delta + 24) % 24;
    }
    state.time = h * 60 + m;
    if (state.independent) {
      state.starts[0] = state.restOn
        ? (state.time - state.restLeads[0] + DAY_MINUTES) % DAY_MINUTES
        : state.time;
    }
    applyState();
  }

  // 步进按钮
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      stepTime(btn.dataset.target, parseInt(btn.dataset.delta, 10));
    });
  });

  // 输入框内直接按 ↑ / ↓ 调整
  [['hour', $hour, 1], ['minute', $minute, 5]].forEach(([target, input, unit]) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); stepTime(target,  unit); }
      if (e.key === 'ArrowDown') { e.preventDefault(); stepTime(target, -unit); }
    });
  });

  // 「使用当前时间」
  $nowBtn.addEventListener('click', () => {
    const now = new Date();
    state.time = now.getHours() * 60 + Math.floor(now.getMinutes() / 5) * 5;
    if (state.independent) {
      state.starts[0] = state.restOn
        ? (state.time - state.restLeads[0] + DAY_MINUTES) % DAY_MINUTES
        : state.time;
    }
    applyState();
  });

  // 休息模式开关：切换后重算全部时钟（保留已调好的休息时长）
  $earlyToggle.addEventListener('change', () => {
    state.restOn = $earlyToggle.checked;
    state.restLeads = state.restLeads.map(lead => clamp(lead, 60, maxRestLead()));
    if (state.independent) {
      // 输入时间始终代表 Session I 的激活时间；开/关休息时同步转换起点/红针
      state.time = state.restOn
        ? (state.starts[0] + state.restLeads[0]) % DAY_MINUTES
        : state.starts[0];
      syncInputs();
    }
    renderClocks();
  });

  // 限额时长输入框：直接输入时同步
  $duration.addEventListener('input', () => {
    const v = parseInt($duration.value, 10);
    if (!Number.isNaN(v)) {
      state.slotHours = clamp(v, 2, 12);
      state.restLeads = state.restLeads.map(lead => clamp(lead, 60, maxRestLead()));
      applyState();
    }
  });

  // 消差延时输入框：直接输入时同步（只影响提示词）
  $stagger.addEventListener('input', () => {
    const v = parseInt($stagger.value, 10);
    if (!Number.isNaN(v)) {
      state.staggerMinutes = clamp(v, 0, 30);
      updatePrompt();
    }
  });

  // 提示词手动修改：标记 dirty，之后时钟变化仅原地替换时间令牌
  $promptText.addEventListener('input', () => { promptDirty = true; });

  // 一键复制：优先 Clipboard API，失败回退 execCommand（复制当前输入框内容）
  $copyBtn.addEventListener('click', async () => {
    const label = $copyBtn.querySelector('[data-copy-label]');
    let ok = false;
    try {
      await navigator.clipboard.writeText($promptText.value);
      ok = true;
    } catch (err) {
      try {
        $promptText.focus();
        $promptText.select();
        ok = document.execCommand('copy');
        window.getSelection().removeAllRanges();
      } catch (e2) { ok = false; }
    }
    $copyBtn.classList.remove('copied', 'copy-failed');
    $copyBtn.classList.add(ok ? 'copied' : 'copy-failed');
    if (label) label.textContent = ok ? '已复制' : '复制失败';
    setTimeout(() => {
      $copyBtn.classList.remove('copied', 'copy-failed');
      if (label) label.textContent = '一键复制';
    }, 1600);
  });

  // 断开衔接开关：打开时把当前连续时间锁定为 5 个独立起点；关闭时恢复衔接模式
  $indepToggle.addEventListener('change', () => {
    const wasIndependent = state.independent;
    state.independent = $indepToggle.checked;
    if (state.independent && !wasIndependent) {
      // 从当前衔接模式计算出的前 5 个起点初始化独立起点
      const effMin = sessionIStart();
      const unique = buildUniqueSlots(effMin);
      state.starts = unique.slice(0, 5).map(s => s.start);
    } else if (!state.independent && wasIndependent) {
      // 切回衔接模式：以 Session I 为基准
      state.time = state.restOn
        ? (state.starts[0] + state.restLeads[0]) % DAY_MINUTES
        : state.starts[0];
    }
    applyState();
  });

  // 指针拖动：拖黑/红/金任意指针 = 整个 5h 区块平移（更新全局输入时间后整体重渲染）
  setupHandDrag();
}

/* ---------- 指针拖动 ---------- */
let dragState = null;

function setupHandDrag() {
  // 委托到容器：重渲染替换 SVG 后监听依然有效
  $clocks.addEventListener('pointerdown', e => {
    const hand = e.target.closest('[data-hand]');
    if (!hand) return;
    e.preventDefault();

    const svg = hand.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const sourceIdx = parseInt(hand.dataset.clock, 10);        // Session 序号（非展示序号）
    const isDay2 = hand.dataset.day2 === '1';
    // 红针所在 Session 的休息时长下标：I/VI(Day2) 共享 0；II/III/IV → 1/2/3；V+ 无红针
    const restIdx = sourceIdx === 1 ? 0 : (sourceIdx >= 2 && sourceIdx <= 4 ? sourceIdx - 1 : -1);

    dragState = {
      cx: rect.left + rect.width / 2,   // 时钟中心（屏幕坐标，重渲染后布局不变）
      cy: rect.top + rect.height / 2,
      grabDial: parseInt(hand.dataset.dial, 10),   // 按下时指针所在表盘小时 0..11
      kind: hand.dataset.kind || 'block',          // 'start' | 'end' | 'red'
      sourceIdx,
      isDay2,
      restIdx: restIdx >= 0 && restIdx <= 3 ? restIdx : -1,
      startTime: state.time,
      startLead: restIdx >= 0 && restIdx <= 3 ? state.restLeads[restIdx] : 120,
      startStarts: state.independent ? state.starts.slice() : null
    };

    document.body.classList.add('dragging');
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  });
}

// 鼠标位置 → 表盘小时（0..11，顶部 = 0）
function dialHourFromEvent(e) {
  const dx = e.clientX - dragState.cx;
  const dy = e.clientY - dragState.cy;
  let a = Math.atan2(dy, dx) * 180 / Math.PI + 90;   // 顶部 = 0°
  if (a < 0) a += 360;
  return Math.round(a / 30) % 12;
}

function onDragMove(e) {
  if (!dragState) return;

  // 表盘差 → 取 12 小时环上最近方向（-5..+6），支持前后拖动
  let d = ((dialHourFromEvent(e) - dragState.grabDial) % 12 + 12) % 12;
  if (d > 6) d -= 12;

  if (dragState.kind === 'red' && state.restOn && dragState.restIdx >= 0) {
    // 拖红针：只改这个 Session 自己的休息时长，其他时钟互不影响
    // 休息时长范围 [1h, min(4h, 窗口时长-1h)]
    const maxLead = maxRestLead();
    const newLead = clamp(dragState.startLead + d * 60, 60, maxLead);
    if (dragState.restIdx === 0) {
      // Session I（和 VI/Day2 镜像）：S = time − lead 保持不变 → time 跟着红针走
      state.time = (dragState.startTime + (newLead - dragState.startLead) + DAY_MINUTES) % DAY_MINUTES;
      if (state.independent) {
        state.starts[0] = (state.time - newLead + DAY_MINUTES) % DAY_MINUTES;
      }
    }
    // Session II~IV：区块和输入时间都不动，只调自己的红针
    state.restLeads[dragState.restIdx] = newLead;
  } else if (state.independent) {
    // 独立模式：拖黑/金针只移动当前 Session，不影响其它
    // sourceIdx 范围 1..5（Day2 复制 sourceIdx=1）
    const slotIdx = dragState.sourceIdx === 1 ? 0 : dragState.sourceIdx - 1;
    state.starts[slotIdx] = (dragState.startStarts[slotIdx] + d * 60 + DAY_MINUTES * 2) % DAY_MINUTES;
    if (slotIdx === 0) {
      // Session I 与输入框关联：输入时间 = 起点 + 休息时长（若开启休息模式）
      state.time = state.restOn
        ? (state.starts[0] + state.restLeads[0]) % DAY_MINUTES
        : state.starts[0];
    }
  } else {
    // 衔接模式：拖黑/金针（或普通模式任意指针）所有区块整体平移
    // 输入时间 + d 小时，跨午夜自动回绕；分钟保留
    state.time = (dragState.startTime + d * 60 + DAY_MINUTES * 2) % DAY_MINUTES;
  }
  applyState();
}

function onDragEnd() {
  dragState = null;
  document.body.classList.remove('dragging');
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
}

/* ---------- 启动 ---------- */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    readInputsToState();   // 从 HTML 初始值读入（无效则用默认 09:00）
    if ($indepToggle) $indepToggle.checked = state.independent;
    if ($earlyToggle) $earlyToggle.checked = state.restOn;
    if ($duration) $duration.value = state.slotHours;
    if ($stagger) $stagger.value = state.staggerMinutes;
    setupEvents();
    renderClocks();
  });
}

/* ---------- Node 环境导出（供 test.js 做逻辑测试，浏览器无感知） ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildSlots, formatMinShort, fmtHourLabel, hourToAngleRad, staggeredTimes, activationTimes, buildPromptText };
}
