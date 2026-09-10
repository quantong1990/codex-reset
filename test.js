/* =========================================================
   限额刷新周期计算器 · 纯逻辑单元测试
   运行：node test.js
   ========================================================= */

const assert = require('assert');
const { buildSlots, formatMinShort, fmtHourLabel, staggeredTimes, activationTimes, buildPromptText } = require('./app.js');

const H = 60, D = DAY_MINUTES();
function DAY_MINUTES() { return 24 * 60; }   // 避免顶部循环依赖

const dur = s => (s.end - s.start + DAY_MINUTES()) % DAY_MINUTES();

/* 用例 1：9:00（需求原始示例）—— 19 → 24 必须是 24:00 */
let s = buildSlots(9, 0);
assert.deepStrictEqual(
  s.map(x => [x.start, x.end]),
  [[540, 840], [840, 1140], [1140, 1440], [0, 300], [300, 540], [540, 840]],
  '9:00 输入的 6 段不匹配'
);
assert.strictEqual(s[5].isDay2, true, '第 6 个时钟应标记 Day 2');
assert.strictEqual(formatMinShort(s[2].end), '24:00', 'Phase III 末尾必须显示 24:00');
assert.strictEqual(fmtHourLabel(s[2].end), '24',     '胶囊内必须显示 "24"');
assert.strictEqual(formatMinShort(s[3].start), '00:00', 'Phase IV 起点的 0:00');
assert.strictEqual(formatMinShort(s[3].end),   '05:00');
assert.strictEqual(formatMinShort(s[4].start), '05:00');
assert.strictEqual(formatMinShort(s[4].end),   '09:00', '回流入参点');

/* 不变量：前 5 段拼起来 = 24h，且前 4 段各 5h，Phase V = 4h */
assert.strictEqual(s.slice(0, 5).reduce((a, x) => a + dur(x), 0), 1440,
  '前 5 段时长和应为 24h');
assert.strictEqual(dur(s[0]), 300);
assert.strictEqual(dur(s[1]), 300);
assert.strictEqual(dur(s[2]), 300);
assert.strictEqual(dur(s[3]), 300);
assert.strictEqual(dur(s[4]), 240, 'Phase V 应为 4h 回流');
assert.strictEqual(dur(s[5]), 300, 'Day 2 = Phase I = 5h');

/* 用例 2：19:00 —— 第一个时钟直接结束在午夜 */
s = buildSlots(19, 0);
assert.deepStrictEqual(
  s.map(x => [x.start, x.end]),
  [[1140, 1440], [0, 300], [300, 600], [600, 900], [900, 1140], [1140, 1440]],
  '19:00 输入的 6 段不匹配'
);
assert.strictEqual(formatMinShort(s[0].end), '24:00');
assert.strictEqual(s.slice(0, 5).reduce((a, x) => a + dur(x), 0), 1440);

/* 用例 3：22:30 —— 跨午夜回绕 */
s = buildSlots(22, 30);
assert.deepStrictEqual(
  s.map(x => [x.start, x.end]),
  [[1350, 210], [210, 510], [510, 810], [810, 1110], [1110, 1350], [1350, 210]],
  '22:30 输入的 6 段不匹配'
);
assert.strictEqual(formatMinShort(s[0].start), '22:30');
assert.strictEqual(formatMinShort(s[0].end),   '03:30');
assert.strictEqual(formatMinShort(s[3].start), '13:30');
assert.strictEqual(formatMinShort(s[4].end),   '22:30');
assert.strictEqual(s.slice(0, 5).reduce((a, x) => a + dur(x), 0), 1440);

/* 用例 4：0:00 —— 起止都在午夜附近 */
s = buildSlots(0, 0);
assert.deepStrictEqual(
  s.map(x => [x.start, x.end]),
  [[0, 300], [300, 600], [600, 900], [900, 1200], [1200, 0], [0, 300]],
  '0:00 输入的 6 段不匹配'
);
assert.strictEqual(dur(s[4]), 240, 'Phase V 应为 4h');
assert.strictEqual(formatMinShort(s[4].end), '00:00');

/* 用例 5：23:55 —— 极端分钟 */
s = buildSlots(23, 55);
assert.deepStrictEqual(
  s.map(x => [x.start, x.end]),
  [[1435, 295], [295, 595], [595, 895], [895, 1195], [1195, 1435], [1435, 295]],
  '23:55 输入的 6 段不匹配'
);
assert.strictEqual(formatMinShort(s[0].end), '04:55');
assert.strictEqual(formatMinShort(s[3].start), '14:55');
assert.strictEqual(formatMinShort(s[3].end),   '19:55');
assert.strictEqual(s.slice(0, 5).reduce((a, x) => a + dur(x), 0), 1440);

/* 用例 6：随机抽查 9 个时间点（用真实墙钟时间种子，逐 case 校验总和） */
const samples = [
  [3, 15],  [7, 45],  [11, 30], [12, 0],  [13, 25],
  [15, 10], [17, 0],  [19, 45], [22, 0]
];
for (const [h, m] of samples) {
  const ss = buildSlots(h, m);
  const total = ss.slice(0, 5).reduce((a, x) => a + dur(x), 0);
  assert.strictEqual(total, 1440, `输入 ${h}:${pad(m)} 五段总和不等于 24h`);
  // Day 2 必须等于 Phase I
  assert.strictEqual(ss[5].start, ss[0].start);
  assert.strictEqual(ss[5].end,   ss[0].end);
  assert.strictEqual(ss[5].isDay2, true);
}
function pad(n) { return String(n).padStart(2, '0'); }

/* 可变时长：6h → 4 个完整窗口 + 2 个重复（共 6 个） */
{
  const ss = buildSlots(0, 0, 6);
  assert.strictEqual(ss.length, 6, '6h 应生成 6 个时钟');
  assert.deepStrictEqual(
    ss.map(x => [x.start, x.end]),
    [[0, 360], [360, 720], [720, 1080], [1080, 1440], [0, 360], [360, 720]],
    '6h 时序不匹配'
  );
  assert.strictEqual(ss[4].isDay2, true, '6h 第 5 个时钟应为 Day 2 重复');
}

/* 可变时长：3h → 8 个完整窗口（刚好 24h，不重复） */
{
  const ss = buildSlots(0, 0, 3);
  assert.strictEqual(ss.length, 8, '3h 应生成 8 个时钟');
  assert.strictEqual(ss.slice(0, 8).reduce((a, x) => a + dur(x), 0), 1440, '3h 总时长应为 24h');
  assert.strictEqual(ss.some(s => s.isDay2), false, '3h 不应有 Day 2 重复');
}

/* 可变时长：7h → 3 个窗口 + 3h 回流，循环重复至 6 个 */
{
  const ss = buildSlots(0, 0, 7);
  assert.strictEqual(ss.length, 6, '7h 应生成 6 个时钟');
  assert.strictEqual(ss[3].isReturn, true, '7h 第 4 个时钟应为回流段');
  assert.strictEqual(ss[4].isDay2, true, '7h 第 5 个时钟应为 Day 2 重复');
}

/* formatMinShort 边界 */
assert.strictEqual(formatMinShort(1440), '24:00');
assert.strictEqual(formatMinShort(0),    '00:00');
assert.strictEqual(formatMinShort(60),   '01:00');
assert.strictEqual(formatMinShort(1439), '23:59');

/* 激活提示词：默认 09:00 / 5h / 消差延时 2min —— 黑针时间累计 +2min，跳过回流段与 Day2 重复 */
assert.deepStrictEqual(
  activationTimes().map(formatMinShort),
  ['09:00', '14:02', '19:04', '00:06'],
  '激活时间应为黑针时间 + 累计消差延时（跳过回流段与 Day2 重复）'
);
assert.strictEqual(
  buildPromptText(),
  '设置定时任务，每天在以下固定时间点【09:00】【14:02】【19:04】【00:06】，向我打一声招呼，激活当前的5小时限额窗口。以上自动化全部保持每天启用，对话后台静默执行，不主动打开新的可见对话窗口，仅在失败或需要处理时补充说明。',
  '提示词全文不匹配'
);
assert.deepStrictEqual(staggeredTimes([540, 840], 0).map(formatMinShort), ['09:00', '14:00'], '延时 0 不偏移');
assert.deepStrictEqual(staggeredTimes([1430, 60], 5).map(formatMinShort), ['23:50', '01:05'], '延时累计 + 跨午夜回绕');

console.log('✅ 全部断言通过（6 用例 + 不变量 + 边界 + 可变时长 + 激活提示词）');
