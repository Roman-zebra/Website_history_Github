"""Build the podcast audio and its timed transcript from a script file.

    python podcast/build_podcast.py --lang en|ja

Each spoken line is synthesized by tts_build.ps1 (Windows WinRT voices), trimmed, and joined with
short pauses; a small synthesized chime opens and closes the episode. ffmpeg normalises loudness
and encodes MP3. The transcript keeps the start and end time of every line, the chapters and the
cues that move the 3D view, so the page can follow the audio.
"""
import argparse
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
    t = np.arange(int(SR * 1.2)) / SR
    notes = (523.25, 783.99) if up else (783.99, 523.25)
    y = np.zeros_like(t)
    for k, f in enumerate(notes):
        s = 0.2 * k
        env = np.clip((t - s) / 0.015, 0, 1) * np.exp(-np.clip(t - s, 0, None) * 3.0) * (t >= s)
        y += 0.16 * env * np.sin(2 * np.pi * f * (t - s))
    return y.astype(np.float32)


def fill_placeholders(text, lang, lab):
    lower = lab['report']['change']['lowerM2']
    rounded = int(round(lower, -2))
    return text.replace('{LOWER_M2}', f'{rounded:,}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', required=True, choices=['en', 'ja'])
    lang = ap.parse_args().lang
    script = HERE / f'podcast_{lang}.json'
    doc = json.loads(script.read_text(encoding='utf-8'))
    lab = json.loads((ROOT / 'web' / 'gunkanjima-lab.json').read_text(encoding='utf-8'))
    for item in doc['items']:
        for key in ('t', 'say'):
            if key in item:
                item[key] = fill_placeholders(item[key], lang, lab)
    OUT.mkdir(exist_ok=True)
    filled = OUT / f'script_{lang}.json'
    filled.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    wavdir = OUT / f'wav_{lang}'
    if wavdir.exists():
        shutil.rmtree(wavdir)
    subprocess.run(['powershell', '-NoProfile', '-File', str(HERE / 'tts_build.ps1'), '-Script', str(filled), '-OutDir', str(wavdir)], check=True)

    pieces, cur = [], 0.0

    def add(y):
        nonlocal cur
        pieces.append(y)
        cur += len(y) / SR

    def pause(sec):
        add(np.zeros(int(SR * sec), np.float32))

    add(chime(True))
    pause(0.8)  # a shorter gap swallowed the first syllable
    lines, chapters, idx, prev = [], [], 0, None
    for item in doc['items']:
        if 'chapter' in item:
            if lines:
                pause(0.9)
            chapters.append({'start': round(cur, 2), 'title': item['chapter']})
            prev = None
            continue
        y, sr = sf.read(wavdir / f'line_{idx:03d}.wav', dtype='float32')
        idx += 1
        if y.ndim > 1:
            y = y.mean(axis=1)
        if sr != SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=SR)
        y, _ = librosa.effects.trim(y, top_db=40)
        if prev is not None:
            pause(0.2 if prev == item['s'] else 0.42)
        start = cur
        add(y)
        row = {'start': round(start, 2), 'end': round(cur, 2), 's': item['s'], 't': item['t']}
        if 'cue' in item:
            row['cue'] = item['cue']
        lines.append(row)
        prev = item['s']
    pause(0.7)
    add(chime(False))
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
                    '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', str(mp3)], check=True)
    info = sf.info(str(mp3))
    transcript = {'lang': lang, 'title': doc['title'], 'names': doc['names'], 'voices': doc['voiceCredit'],
                  'duration': round(len(audio) / SR, 2), 'chapters': chapters, 'lines': lines}
    (OUT / f'gunkanjima-podcast-{lang}.json').write_text(json.dumps(transcript, ensure_ascii=False, indent=1), encoding='utf-8')
    print(lang, 'lines', len(lines), 'chapters', len(chapters), 'duration %.1f s' % transcript['duration'],
          'mp3 %.1f s, %.0f KB' % (info.duration, mp3.stat().st_size / 1024))


if __name__ == '__main__':
    main()
