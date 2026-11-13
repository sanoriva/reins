import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseConfig } from '../../src/config.js';
import { DEFAULT_WHISPER_MODEL, defaultDevice } from '../../src/stt.js';

describe('parseConfig', () => {
  it('defaults: Whisper base, ffmpeg from PATH, no fixed language or microphone', () => {
    const config = parseConfig([]);
    assert.equal(config.model, DEFAULT_WHISPER_MODEL);
    assert.equal(config.ffmpeg, 'ffmpeg');
    assert.equal(config.language, undefined);
    assert.equal(config.mic, undefined);
    assert.match(config.cacheDir, /\.sanoriva-agent[\\/]models$/);
  });

  it('accepts model, language, microphone and ffmpeg', () => {
    const config = parseConfig(['--model', 'onnx-community/whisper-small', '--language', 'es', '--mic', 'USB Microphone', '--ffmpeg', 'C:/ffmpeg.exe']);
    assert.deepEqual(
      { model: config.model, language: config.language, mic: config.mic, ffmpeg: config.ffmpeg },
      { model: 'onnx-community/whisper-small', language: 'es', mic: 'USB Microphone', ffmpeg: 'C:/ffmpeg.exe' },
    );
  });

  it('voice: Piper by default with its ffplay; --tts system, --voice, and ffplay next to --ffmpeg', () => {
    const config = parseConfig([]);
    assert.equal(config.tts, 'piper');
    assert.equal(config.ffplay, 'ffplay');
    assert.match(config.dataDir, /\.sanoriva-agent$/);
    const custom = parseConfig(['--tts', 'system', '--voice', 'es_ES-davefx-medium', '--ffmpeg', 'C:/bin/ffmpeg.exe']);
    assert.deepEqual({ tts: custom.tts, voice: custom.voice }, { tts: 'system', voice: 'es_ES-davefx-medium' });
    assert.match(custom.ffplay, /[\\/]bin[\\/]ffplay\.exe$/);
    assert.throws(() => parseConfig(['--tts', 'robot']), /piper or system/);
  });

  it('the language is 2 letters', () => {
    assert.throws(() => parseConfig(['--language', 'spanish']), /2 letters/);
  });

  it('Whisper runs on the graphics card on Windows and on the CPU elsewhere; --device changes it', () => {
    assert.equal(defaultDevice('win32'), 'dml');
    assert.equal(defaultDevice('linux'), 'cpu');
    assert.equal(parseConfig(['--device', 'cpu']).device, 'cpu');
    assert.throws(() => parseConfig(['--device', 'gpu']), /cpu or dml/);
  });
});
