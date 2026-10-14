/* Manual native scrolling for an existing card list; data and card actions remain owned by the host. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.AtlasFacilityRail = factory;
})(typeof globalThis === 'object' ? globalThis : this, function createFacilityRail({track, toolbar, previous, next, status, hint, environment = window}) {
  let active = false, destroyed = false, frame = null, copy = null;
  const original = Object.fromEntries(['tabindex', 'role', 'aria-label'].map(key => [key, track.getAttribute(key)]));
  function restore() {
    for (const [key, value] of Object.entries(original)) {
      if (value === null) track.removeAttribute(key); else track.setAttribute(key, value);
    }
  }
  const cards = () => Array.from(track.children).filter(child => child.classList.contains('card'));
  const maximum = () => Math.max(0, track.scrollWidth - track.clientWidth);
  function paint() {
    if (destroyed || !active) return;
    const count = cards().length, max = maximum(), at = Math.max(0, Math.min(max, track.scrollLeft));
    previous.disabled = at <= 2;
    next.disabled = at >= max - 2;
    status.textContent = copy.count.replace('{total}', count);
  }
  function schedule() {
    if (destroyed || !active || frame !== null) return;
    frame = environment.requestAnimationFrame(() => { frame = null; paint(); });
  }
  function move(direction, destination) {
    if (destroyed || !active) return;
    const first = cards()[0], width = first ? first.getBoundingClientRect().width : track.clientWidth;
    const gap = parseFloat(environment.getComputedStyle(track).columnGap) || 0;
    const left = destination === undefined ? track.scrollLeft + direction * (width + gap) : destination;
    track.scrollTo({left: Math.max(0, Math.min(maximum(), left)),
      behavior: environment.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    schedule();
  }
  const backwards = () => move(-1), forwards = () => move(1);
  function keydown(event) {
    if (!active || event.target !== track || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') move(0, 0);
    else if (event.key === 'End') move(0, maximum());
    else move(event.key === 'ArrowRight' ? 1 : -1);
  }
  previous.addEventListener('click', backwards);
  next.addEventListener('click', forwards);
  track.addEventListener('scroll', schedule, {passive:true});
  track.addEventListener('keydown', keydown);
  const resize = environment.ResizeObserver ? new environment.ResizeObserver(schedule) : null;
  if (resize) resize.observe(track); else environment.addEventListener('resize', schedule);
  function update({enabled, labels, reset = false}) {
    if (destroyed) return;
    copy = labels;
    active = enabled && cards().length > 0;
    toolbar.hidden = !active;
    track.classList.toggle('facility-rail', active);
    if (!active) { restore(); return; }
    track.setAttribute('tabindex', '0');
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', labels.list);
    previous.setAttribute('aria-label', labels.previous);
    next.setAttribute('aria-label', labels.next);
    hint.textContent = labels.hint;
    if (reset) track.scrollTo({left:0, behavior:'auto'});
    paint();
    schedule();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (frame !== null) environment.cancelAnimationFrame(frame);
    if (resize) resize.disconnect(); else environment.removeEventListener('resize', schedule);
    previous.removeEventListener('click', backwards);
    next.removeEventListener('click', forwards);
    track.removeEventListener('scroll', schedule);
    track.removeEventListener('keydown', keydown);
    track.classList.remove('facility-rail');
    toolbar.hidden = true;
    restore();
  }
  return Object.freeze({update, destroy});
});
