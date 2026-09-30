// Static-view frame cadence, independent of the renderer and browser DOM.
export function createFrameBenchmark({
  canStart, onChange, onTimeout,
  startReason = () => 'Measurement needs a ready renderer and a visible tab.',
  now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout
}) {
  let session = null;
  function finish(message, result = null) {
    if (session) clearTimer(session.timeout);
    session = null;
    onChange({ running: false, message, result });
  }
  return {
    get active() { return session !== null; },
    start() {
      if (session) return false;
      if (!canStart()) {
        finish(startReason());
        return false;
      }
      const current = { measureFrom: now() + 1000, last: null, intervals: [], timeout: null };
      session = current;
      current.timeout = setTimer(() => {
        // An old timeout cannot cancel a later measurement.
        if (session !== current) return;
        finish('Measurement cancelled: frames did not complete within 10 seconds. Retry in a visible tab.');
        onTimeout();
      }, 10000);
      onChange({ running: true, message: 'Measuring a static model for 5 seconds after warm-up… Keep this tab visible.', result: null });
      return true;
    },
    cancel(message) {
      if (!session) return false;
      finish(message);
      return true;
    },
    sample(time) {
      if (!session) return;
      if (time >= session.measureFrom) {
        if (session.last !== null && time > session.last) session.intervals.push(time - session.last);
        session.last = time;
      }
      if (time < session.measureFrom + 5000 || !session.intervals.length) return;
      const intervals = session.intervals.sort((a, b) => a - b);
      const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const percentile = fraction => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * fraction))];
      finish('Measurement complete.', {
        framesPerSecond: 1000 / average,
        medianMs: percentile(0.5), p95Ms: percentile(0.95), intervalCount: intervals.length
      });
    }
  };
}
