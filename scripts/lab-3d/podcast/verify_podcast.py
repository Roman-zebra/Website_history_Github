"""Listen to a built podcast with a local speech recogniser and compare it with the script, line by line.

    python podcast/verify_podcast.py --lang en|ja [--model small]

Uses a cached faster-whisper model with the language fixed (left to detect the language itself, it
invents text on short clips). Prints the lines whose recognised text differs most from the script,
which is where a voice misread a word or a line went missing.
"""
import argparse
import difflib
import json
import re
from pathlib import Path

import librosa
from faster_whisper import WhisperModel

HERE = Path(__file__).resolve().parent


def normalise(text, lang):
    text = text.lower()
    if lang == 'ja':
        return re.sub(r'[\s、。？！・「」（）()〜~,.!?：:]', '', text)
    return ' '.join(re.sub(r"[^a-z0-9']+", ' ', text).split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', required=True, choices=['en', 'ja'])
    ap.add_argument('--model', default='small')
    args = ap.parse_args()
    out = HERE / 'out'
    transcript = json.loads((out / f'gunkanjima-podcast-{args.lang}.json').read_text(encoding='utf-8'))
    script = json.loads((out / f'script_{args.lang}.json').read_text(encoding='utf-8'))
    spoken = [item.get('say', item['t']) for item in script['items'] if 's' in item]
    audio, sr = librosa.load(str(out / f'gunkanjima-podcast-{args.lang}.mp3'), sr=16000, mono=True)
    model = WhisperModel(args.model, device='cpu', compute_type='int8', local_files_only=True)
    rows = []
    for i, line in enumerate(transcript['lines']):
        seg = audio[max(0, int((line['start'] - 0.15) * sr)):int((line['end'] + 0.25) * sr)]
        parts, _ = model.transcribe(seg, language=args.lang, beam_size=1, vad_filter=False, condition_on_previous_text=False)
        heard = ''.join(p.text for p in parts).strip()
        a, b = normalise(spoken[i], args.lang), normalise(heard, args.lang)
        ratio = difflib.SequenceMatcher(None, a, b).ratio()
        rows.append({'i': i, 'ratio': round(ratio, 3), 'script': line['t'], 'heard': heard})
    rows.sort(key=lambda r: r['ratio'])
    (out / f'verify_{args.lang}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')
    mean = sum(r['ratio'] for r in rows) / len(rows)
    print(f'{args.lang}: {len(rows)} lines, mean similarity {mean:.3f}, below 0.8: {sum(r["ratio"] < 0.8 for r in rows)}')
    for r in rows[:10]:
        print(f"#{r['i']:02d} {r['ratio']:.2f}\n  script: {r['script']}\n  heard:  {r['heard']}")


if __name__ == '__main__':
    main()
