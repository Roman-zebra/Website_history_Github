"""Build the podcast audio and its timed transcript from a script file.

    python podcast/build_podcast.py --lang en|ja [--engine edge|winrt]

Each spoken line is synthesized on its own (edge: Microsoft neural voices through the edge-tts
package, which needs the network; winrt: the Windows voices through tts_build.ps1), trimmed, and
joined with short pauses. There is no jingle: the episode starts on the first word.
ffmpeg normalises loudness and encodes MP3. The transcript keeps the start and end time of every
line, the chapters and the cues that move the 3D view, so the page can follow the audio.
"""
import argparse
import asyncio
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / 'out'
SR = 24000


def chime(up=True):
    t = np.arange(int(SR * 1.4)) / SR
    notes = (392.0, 523.25, 659.25) if up else (659.25, 523.25, 392.0)
    y = np.zeros_like(t)
    for k, f in enumerate(notes):
        s = 0.16 * k
        env = np.clip((t - s) / 0.012, 0, 1) * np.exp(-np.clip(t - s, 0, None) * 2.6) * (t >= s)
        y += 0.11 * env * (np.sin(2 * np.pi * f * (t - s)) + 0.35 * np.sin(2 * np.pi * 2 * f * (t - s)))
    return y.astype(np.float32)


def sea_bed(seconds, seed=7):
    """Low, slow wash of filtered noise that swells every few seconds, like a shore heard from a boat."""
    rng = np.random.default_rng(seed)
    n = int(SR * seconds)
    white = rng.standard_normal(n).astype(np.float32)
    # leaky integration = brown-ish noise, then a slow swell
    y = np.empty(n, np.float32)
    acc = 0.0
    for i in range(n):
        acc = 0.995 * acc + white[i] * 0.05
        y[i] = acc
    y = y / (np.abs(y).max() + 1e-6)
    t = np.arange(n) / SR
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * t / 7.5 + 1.0) ** 2
    return (y * swell).astype(np.float32)


def fill_placeholders(text, lab):
    lower = lab['report']['change']['lowerM2']
    rounded = int(round(lower, -2))
    return text.replace('{LOWER_M2}', f'{rounded:,}')


async def edge_line(text, voice, rate, path):
    import edge_tts
    com = edge_tts.Communicate(text, voice, rate=rate)
    await com.save(str(path))


def synth_edge(doc, wavdir):
    """One MP3 per spoken line through edge-tts, cached by voice, rate and text."""
    wavdir.mkdir(parents=True, exist_ok=True)
    cache = HERE / 'cache_edge'
    cache.mkdir(exist_ok=True)
    i = 0
    for item in doc['items']:
        if 's' not in item:
            continue
        voice, rate = doc['voices'][item['s']], doc['rate'][item['s']]
        text = item.get('say') or item['t']
        key = hashlib.sha1(f'{voice}|{rate}|{text}'.encode('utf-8')).hexdigest()[:20]
        src = cache / f'{key}.mp3'
        if not src.exists() or src.stat().st_size < 1000:
            for attempt in range(4):
                try:
                    asyncio.run(edge_line(text, voice, rate, src))
                    if src.stat().st_size >= 1000:
                        break
                except Exception as err:  # network hiccups: try again
                    print('  retry', i, err)
            else:
                raise RuntimeError(f'edge-tts failed for line {i}')
        y, sr = librosa.load(str(src), sr=SR, mono=True)
        sf.write(wavdir / f'line_{i:03d}.wav', y, SR)
        i += 1
    return i


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', required=True, choices=['en', 'ja'])
    ap.add_argument('--engine', default='edge', choices=['edge', 'winrt'])
    args = ap.parse_args()
    lang = args.lang
    script = HERE / f'podcast_{lang}.json'
    doc = json.loads(script.read_text(encoding='utf-8'))
    lab_file = ROOT / 'web' / 'gunkanjima-lab.json'
    if not lab_file.exists():
        lab_file = ROOT.parent.parent / '3d' / 'gunkanjima-lab.json'
    lab = json.loads(lab_file.read_text(encoding='utf-8'))
    for item in doc['items']:
        for key in ('t', 'say'):
            if key in item:
                item[key] = fill_placeholders(item[key], lab)
    OUT.mkdir(exist_ok=True)
    filled = OUT / f'script_{lang}.json'
    filled.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    wavdir = OUT / f'wav_{lang}'
    if wavdir.exists():
        shutil.rmtree(wavdir)
    if args.engine == 'edge':
        synth_edge(doc, wavdir)
    else:
        subprocess.run(['powershell', '-NoProfile', '-File', str(HERE / 'tts_build.ps1'), '-Script', str(filled), '-OutDir', str(wavdir)], check=True)

    pieces, cur = [], 0.0

    def add(y):
        nonlocal cur
        pieces.append(y)
        cur += len(y) / SR

    def pause(sec):
        add(np.zeros(int(SR * sec), np.float32))

    pause(0.25)   # v4: no opening chime or bed; the episode simply starts
    lines, chapters, idx, prev = [], [], 0, None
    gaps = doc.get('gaps', {'same': 0.28, 'other': 0.5, 'chapter': 1.1})
    for item in doc['items']:
        if 'chapter' in item:
            if lines:
                pause(gaps['chapter'])
            chapters.append({'start': round(cur, 2), 'title': item['chapter']})
            prev = None
            continue
        y, sr = sf.read(wavdir / f'line_{idx:03d}.wav', dtype='float32')
        idx += 1
        if y.ndim > 1:
            y = y.mean(axis=1)
        if sr != SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=SR)
        y, _ = librosa.effects.trim(y, top_db=38)
        if prev is not None:
            pause(gaps['same'] if prev == item['s'] else gaps['other'])
        start = cur
        add(y)
        row = {'start': round(start, 2), 'end': round(cur, 2), 's': item['s'], 't': item['t']}
        if 'cue' in item:
            row['cue'] = item['cue']
        lines.append(row)
        prev = item['s']
    pause(0.8)
    audio = np.concatenate(pieces)
    peak = float(np.abs(audio).max())
    if peak > 0.98:
        audio = audio * (0.98 / peak)
    wav = OUT / f'full_{lang}.wav'
    sf.write(wav, audio, SR)

    ffmpeg = shutil.which('ffmpeg')
    assert ffmpeg, 'ffmpeg not found'
    mp3 = OUT / f'gunkanjima-podcast-{lang}.mp3'
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(wav), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '80k', str(mp3)], check=True)
    info = sf.info(str(mp3))
    transcript = {'lang': lang, 'title': doc['title'], 'names': doc['names'], 'voices': doc['voiceCredit'],
                  'duration': round(len(audio) / SR, 2), 'chapters': chapters, 'lines': lines}
    (OUT / f'gunkanjima-podcast-{lang}.json').write_text(json.dumps(transcript, ensure_ascii=False, indent=1), encoding='utf-8')
    print(lang, 'lines', len(lines), 'chapters', len(chapters), 'duration %.1f s' % transcript['duration'],
          'mp3 %.1f s, %.0f KB' % (info.duration, mp3.stat().st_size / 1024))


if __name__ == '__main__':
    main()
