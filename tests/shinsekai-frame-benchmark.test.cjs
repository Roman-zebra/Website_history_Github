const test = require('node:test');
const assert = require('node:assert/strict');

async function setup() {
  const { createFrameBenchmark } = await import('../assets-src/shinsekai/browser-study/frame-benchmark.mjs');
  let clock = 0, available = true, nextTimer = 0, timeouts = 0;
  const timers = new Map(), changes = [];
  const benchmark = createFrameBenchmark({
    now: () => clock, canStart: () => available,
    onChange: value => changes.push(value), onTimeout: () => timeouts++,
    setTimer: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, due: clock + delay }); return id; },
    clearTimer: id => timers.delete(id)
  });
  return { benchmark, timers, changes,
    setAvailable: value => { available = value; },
    get timeouts() { return timeouts; },
    advance(time) {
      clock = time;
      for (const [id, timer] of [...timers]) if (timer.due <= clock) { timers.delete(id); timer.callback(); }
    }
  };
}
test('hidden or unready start leaves no active session or timer', async () => {
  const state = await setup(); state.setAvailable(false);
  assert.equal(state.benchmark.start(), false);
  assert.equal(state.benchmark.active, false); assert.equal(state.timers.size, 0);
  assert.equal(state.changes.at(-1).running, false);
});
test('no-frame watchdog cancels at its deadline and allows another measurement', async () => {
  const state = await setup(); state.benchmark.start();
  state.advance(9999); assert.equal(state.benchmark.active, true);
  state.advance(10000); assert.equal(state.benchmark.active, false);
  assert.equal(state.timeouts, 1); assert.equal(state.changes.at(-1).running, false);
  assert.match(state.changes.at(-1).message, /10 seconds/);
  assert.equal(state.benchmark.start(), true);
});
test('hiding mid-run cancellation clears the timer and discards partial samples', async () => {
  const state = await setup(); state.benchmark.start();
  state.benchmark.sample(1000); state.benchmark.sample(1010);
  state.setAvailable(false);
  state.benchmark.cancel('Tab hidden');
  assert.equal(state.benchmark.active, false); assert.equal(state.timers.size, 0);
  state.advance(20000); assert.equal(state.timeouts, 0);
  assert.equal(state.changes.at(-1).result, null);
  state.setAvailable(true); assert.equal(state.benchmark.start(), true);
});
test('normal run excludes warm-up intervals and releases its watchdog', async () => {
  const state = await setup(); state.benchmark.start();
  state.benchmark.sample(0); state.benchmark.sample(700); state.benchmark.sample(950);
  for (let time = 1000; time <= 6000; time += 10) state.benchmark.sample(time);
  assert.deepEqual(state.changes.at(-1).result, {framesPerSecond:100,medianMs:10,p95Ms:10,intervalCount:500});
  assert.equal(state.benchmark.active, false); assert.equal(state.timers.size, 0);
  state.advance(10000); assert.equal(state.timeouts, 0);
});
test('duplicate starts and stale timer callbacks cannot replace or cancel a new run', async () => {
  const state = await setup(); state.benchmark.start();
  const stale = [...state.timers.values()][0].callback;
  assert.equal(state.benchmark.start(), false); assert.equal(state.timers.size, 1);
  state.benchmark.cancel('View changed'); state.benchmark.start(); stale();
  assert.equal(state.benchmark.active, true); assert.equal(state.timeouts, 0);
});
