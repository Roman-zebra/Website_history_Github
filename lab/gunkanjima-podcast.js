/* Audio guide for the Gunkanjima lab page: a two-voice episode with chapters and a timed transcript.
   While it plays, its cues move the 3D model (years, change colours, places) unless the listener
   turns that off. Nothing is loaded until the listener presses play or picks a language. */
(function(){
  'use strict';
  const V = '2';
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
      b.onclick = () => { audio.currentTime = parseFloat(b.dataset.at); if (audio.paused) audio.play(); };
    time.textContent = '0:00 / ' + fmt(data.duration);
    if (credit) credit.textContent = data.voices;
    current = -1;
  }

  function load(l){
    const resume = !audio.paused;
    lang = l;
    paintLang();
    audio.pause();
    data = null;
    audio.src = asset('audio/gunkanjima-podcast-' + l + '.mp3');
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
    const go = () => { audio.currentTime = parseFloat(seek.value) / 100 * data.duration; };
    if (data) go(); else (loading || load(lang)).then(go);
  });
  if (rate) rate.onchange = () => { audio.playbackRate = parseFloat(rate.value); };
  for (const b of document.querySelectorAll('[data-pod-lang]')) b.onclick = () => load(b.dataset.podLang);
  paintLang();
  paintPlay();
})();
