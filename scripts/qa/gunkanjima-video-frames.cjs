#!/usr/bin/env node
'use strict';

// Local, authorized reference clips only. No downloader, cookies or website access.
// Usage: node scripts/qa/gunkanjima-video-frames.cjs INPUT [START_SECONDS] [INTERVAL_SECONDS] [COUNT]
// Requires ffmpeg and ffprobe on PATH. Writes only to a new temporary directory.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024});
  if (result.error || result.status !== 0) {
    throw new Error(`${command}: ${result.error ? result.error.message : result.stderr.slice(-2000)}`);
  }
  return result.stdout;
}

function main() {
  const [input, startArg = '0', intervalArg = '5', countArg = '12'] = process.argv.slice(2);
  if (!input || /^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
    throw new Error('Pass a local authorized video file, not a website URL. Usage: INPUT [START_SECONDS] [INTERVAL_SECONDS] [COUNT]');
  }
  const source = fs.realpathSync(path.resolve(input));
  if (!fs.statSync(source).isFile()) throw new Error('Input must be a regular file.');
  const start = Number(startArg), interval = Number(intervalArg), count = Number(countArg);
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(interval) || interval < 0.1 || interval > 600 || !Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error('Use START >= 0, INTERVAL 0.1–600 seconds, and integer COUNT 1–60.');
  }
  const metadata = JSON.parse(run('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_format', '-show_streams', '-of', 'json', source]));
  const video = metadata.streams.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic);
  if (!video) throw new Error('No video stream found.');
  const duration = Number(video.duration || metadata.format?.duration);
  if (Number.isFinite(duration) && start >= duration) throw new Error('START is outside the clip.');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'jta-video-frames-'));
  console.log(`Output: ${output}`);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-protocol_whitelist', 'file,pipe',
    '-ss', String(start), '-threads', '2', '-i', source, '-map', `0:${video.index}`, '-an', '-sn', '-dn',
    '-t', String(interval * count), '-vf', `fps=1/${interval},scale=w=min(1280\\,iw):h=-2`,
    '-frames:v', String(count), '-threads', '2', '-q:v', '3', path.join(output, 'frame-%03d.jpg')]);
  const frames = fs.readdirSync(output).filter(name => /^frame-\d+\.jpg$/.test(name)).sort();
  if (!frames.length) throw new Error('No frames extracted; try a smaller interval or earlier START.');
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({
    source, startSeconds: start, sampleIntervalSeconds: interval,
    timingNote: 'Uniform sample bins after START; exact source-frame timestamps are not measured.',
    referenceNote: 'Inspect these frames before making visual claims; sampling is not full-video viewing.',
    metadata, frames
  }, null, 2) + '\n');
  console.log(`Read ${video.codec_name}, ${video.width}x${video.height}; extracted ${frames.length} frames.`);
  console.log('Inspect images in this directory; keep unlicensed video assets out of the public site.');
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
