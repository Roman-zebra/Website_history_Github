/* Audio guide for the Gunkanjima lab page: a two-voice episode with chapters and a timed transcript.
   While it plays, its cues move the 3D model (years, change colours, places) unless the listener
   turns that off. Nothing is loaded until the listener presses play or picks a language. */
(function(){
  'use strict';
  const V = '4';
  const here = document.currentScript ? document.currentScript.src : location.href;
  const asset = name => new URL(name + '?v=' + V, here).href;
  const T = window.LAB_TEXT || {};
  const $ = id => document.getElementById(id);
  const audio = $('podAudio'), play = $('podPlay'), seek = $('podSeek'), time = $('podTime');
  const follow = $('podFollow'), rate = $('podRate'), chaptersEl = $('podChapters'), transcriptEl = $('podTranscript'), credit = $('podCredit');
  if (!audio || !play) return;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let lang = window.LAB_LANG === 'ja' ? 'ja' : 'en', data = null, loading = null, current = -1;

  function paintLang(){
    for (const b of document.querySelectorAll('[data-pod-lang]')) b.setAttribute('aria-pressed', String(b.dataset.podLang === lang));
  }
  function paintPlay(){
    const on = !audio.paused;
    play.textContent = (on ? '❚❚ ' : '▶ ') + (on ? (T.podPause || 'Pause') : (T.podPlay || 'Play'));
    play.setAttribute('aria-pressed', String(on));
  }

  function render(){
    chaptersEl.innerHTML = data.chapters.map(c =>
      '<li><button type="button" data-at="' + c.start + '">' + esc(c.title) + '<span>' + fmt(c.start) + '</span></button></li>').join('');
    transcriptEl.innerHTML = data.lines.map((ln, i) =>
      '<p data-i="' + i + '"><button type="button" class="who" data-at="' + ln.start + '">' + esc(data.names[ln.s]) + '</button>' + esc(ln.t) + '</p>').join('');
    for (const b of document.querySelectorAll('#podChapters [data-at], #podTranscript [data-at]'))
      b.onclick = () => seekTo(parseFloat(b.dataset.at), true);
    time.textContent = '0:00 / ' + fmt(data.duration);
    if (credit) credit.textContent = data.voices;
    current = -1;
  }

  /* Jumping inside the file: the browser can only seek once it knows the duration, so a seek that
     arrives too early is kept and applied on loadedmetadata; nothing is lost when the file is still loading. */
  let pendingSeek = null;
  function seekTo(t, andPlay){
    const go = () => {
      const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (data ? data.duration : 0);
      audio.currentTime = Math.max(0, Math.min(t, Math.max(0, d - 0.2)));
      pendingSeek = null;
      if (andPlay && audio.paused) audio.play().catch(() => {});
      paintTime();
    };
    if (!audio.src){ (loading || load(lang)).then(() => seekTo(t, andPlay)); return; }
    if (audio.readyState >= 1) go(); else { pendingSeek = t; audio.addEventListener('loadedmetadata', go, { once: true }); if (andPlay) audio.play().catch(() => {}); }
  }
  function skip(sec){ seekTo((audio.currentTime || 0) + sec, !audio.paused); }
  function chapterStep(dir){
    if (!data) return;
    const t = audio.currentTime || 0;
    let i = data.chapters.findIndex((c, k) => t + 0.5 < c.start && (k === 0 || data.chapters[k - 1].start <= t + 0.5));
    if (dir < 0){ i = -1; for (let k = data.chapters.length - 1; k >= 0; k--) if (data.chapters[k].start < t - 2){ i = k; break; } if (i < 0) i = 0; }
    else if (i < 0) i = data.chapters.length - 1;
    seekTo(data.chapters[i].start, !audio.paused);
  }
  function paintTime(){ if (data) time.textContent = fmt(audio.currentTime) + ' / ' + fmt(data.duration); }
  function load(l){
    const resume = !audio.paused;
    lang = l;
    paintLang();
    audio.pause();
    data = null;
    audio.src = asset('audio/gunkanjima-podcast-' + l + '.mp3');
    audio.load();
    audio.playbackRate = rate ? parseFloat(rate.value) : 1;
    loading = fetch(asset('audio/gunkanjima-podcast-' + l + '.json'))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { data = d; render(); if (resume) audio.play(); return d; });
    return loading;
  }

  play.onclick = () => {
    (loading || load(lang)).then(() => { if (audio.paused) audio.play(); else audio.pause(); })
      .catch(err => { console.error(err); time.textContent = '—'; });
  };
  audio.addEventListener('play', paintPlay);
  audio.addEventListener('pause', paintPlay);
  audio.addEventListener('ended', paintPlay);
  audio.addEventListener('ratechange', () => { if (rate) rate.value = String(audio.playbackRate); });
  audio.addEventListener('timeupdate', () => {
    if (!data) return;
    const t = audio.currentTime;
    if (document.activeElement !== seek) seek.value = String(t / Math.max(1, data.duration) * 100);
    time.textContent = fmt(t) + ' / ' + fmt(data.duration);
    let i = -1;
    for (let k = 0; k < data.lines.length; k++){ if (data.lines[k].start <= t + 0.05) i = k; else break; }
    if (i !== current){
      const prev = transcriptEl.querySelector('p.is-on');
      if (prev) prev.classList.remove('is-on');
      const el = transcriptEl.querySelector('p[data-i="' + i + '"]');
      if (el){
        el.classList.add('is-on');
        // Scroll the transcript box only, never the page.
        transcriptEl.scrollTop = el.offsetTop - transcriptEl.offsetTop - transcriptEl.clientHeight / 3;
      }
      current = i;
    }
    if (follow && follow.checked && window.jtaLabFollow && !audio.paused) window.jtaLabFollow(data.lines, t);
  });
  if (seek) seek.addEventListener('input', () => {
    if (data) seekTo(parseFloat(seek.value) / 100 * data.duration, false); else (loading || load(lang)).then(() => seekTo(parseFloat(seek.value) / 100 * data.duration, false));
  });
  for (const b of document.querySelectorAll('[data-pod-skip]')) b.onclick = () => { (loading || load(lang)).then(() => skip(parseFloat(b.dataset.podSkip))); };
  for (const b of document.querySelectorAll('[data-pod-chapter]')) b.onclick = () => { (loading || load(lang)).then(() => chapterStep(parseInt(b.dataset.podChapter, 10))); };
  document.addEventListener('keydown', e => {
    if (e.target && /input|textarea|select|button/i.test(e.target.tagName)) return;
    if (!data || audio.paused && e.key !== ' ') return;
    if (e.key === 'ArrowRight'){ skip(15); e.preventDefault(); } else if (e.key === 'ArrowLeft'){ skip(-15); e.preventDefault(); }
  });
  /* chapters and transcript appear before play, so a listener can start from any chapter */
  if (document.readyState !== 'loading') setTimeout(() => { if (!loading) load(lang); }, 800);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if (!loading) load(lang); }, 800));
  if (rate) rate.onchange = () => { audio.playbackRate = parseFloat(rate.value); };
  for (const b of document.querySelectorAll('[data-pod-lang]')) b.onclick = () => load(b.dataset.podLang);
  paintLang();
  paintPlay();
})();
