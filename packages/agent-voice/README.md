# @reins-ai/voice

Local voice for your AI: an MCP server (stdio) with a microphone that listens continuously, Whisper transcription and a natural voice (Piper) to answer, in the language you speak. Everything runs on your machine, with no external services. The AI starts it; the website knows nothing about voice.

## Requirements

- Node 22.
- [ffmpeg](https://ffmpeg.org) on the PATH (or `--ffmpeg <path>`), with its `ffplay` (included in regular ffmpeg builds).

The first time, it downloads what it needs, each file pinned to a fixed version and, except for Whisper (pinned to a commit), checked against its hash. Afterwards it works offline:

| What | Purpose | Size | Where |
| --- | --- | --- | --- |
| Whisper `whisper-small` | Understanding what you say (about 100 languages) | ~240 MB | `~/.sanoriva-agent/models` |
| [Silero VAD](https://github.com/snakers4/silero-vad) (MIT) | Telling your voice from noise | ~2 MB | `~/.sanoriva-agent/silero-vad` |
| [Smart Turn v3](https://github.com/pipecat-ai/smart-turn) (BSD-2) | Telling whether you finished your turn | ~8 MB | `~/.sanoriva-agent` |
| [WeSpeaker ResNet34](https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM) (CC-BY-4.0, WeNet) | Recognising your voice, so other voices are ignored | ~26 MB | `~/.sanoriva-agent/speaker` |
| [Piper](https://github.com/rhasspy/piper) (MIT), pinned version | Speaking with a natural voice | ~25 MB | `~/.sanoriva-agent/piper` |
| One Piper voice per language | The voice for each language, the first time the AI uses it | 60–110 MB | `~/.sanoriva-agent/voices` |

## Connecting your AI

For Claude Code, in `.mcp.json`:

```json
{
  "mcpServers": {
    "sanoriva-voice": { "type": "stdio", "command": "npx", "args": ["@reins-ai/voice"] }
  }
}
```

Then ask it to talk with you by voice, in any language.

| Option | Default | Description |
| --- | --- | --- |
| `--language <xx>` | (detected per sentence) | Fixes the 2-letter language (`es`, `en`…). Without it, the language of each sentence is detected (about 1 s more per sentence) and the AI answers in the same one. With it, each sentence is transcribed about 1 s sooner. |
| `--tts piper \| system` | `piper` | `piper`: natural voice. `system`: the operating system voice (Windows System.Speech, macOS `say`, Linux `espeak-ng`). The text goes in through standard input, never as a command argument. |
| `--voice <name>` | (one per language) | A fixed voice from the [Piper catalog](https://huggingface.co/rhasspy/piper-voices), e.g. `es_ES-davefx-medium`. |
| `--mic "<name>"` | Windows: the first one ffmpeg lists; macOS/Linux: the default | The microphone to use. |
| `--ffmpeg <path>` | `ffmpeg` | Path to ffmpeg. |
| `--ffplay <path>` | next to ffmpeg | Path to ffplay. |
| `--model <id>` | `onnx-community/whisper-small` | The Whisper model. |
| `--device cpu \| dml` | Windows: `dml`; elsewhere: `cpu` | Where Whisper runs. `dml`: the graphics card through DirectML (it ships with ONNX Runtime, nothing to install), about 1 s faster per sentence; if it fails to load, the CPU is used. |
| `--setup` | off | Only prepares and exits: checks ffmpeg, ffplay and the microphone, and downloads Whisper, Silero, Smart Turn, WeSpeaker, Piper and the voice for the language (`--language`) now, so the first conversation does not wait. It reports what is fine and how to fix what is missing. It installs nothing on the system. |
| `--forget-voice` | | Deletes the learned voiceprint and exits; the next sentences teach it again. |
| `--verbose` | off | Logs what happens to each sentence (closed, Silero, detected language, dropped echo, what was heard, how long speaking took) to `~/.sanoriva-agent/voice.log` (readable only by the user) and stderr. For troubleshooting. |

## Tools the AI sees

| Tool | What it does |
| --- | --- |
| `listen` | Returns what the user said since the last call, or waits for their next sentence (up to 60 s). The first call opens the microphone. |
| `speak` | Reads a text out loud and returns right away, while it plays, so the AI can act on the page at the same time. With `wait: true` it returns when playback ends (or answers "Cut off" if the user talked over it): this is for reading while highlighting, sentence by sentence. In each response the AI says the highlighted sentence and highlights the next one, which is then ready; if it is cut off, it stops everything and listens. `language` (`es`, `en`, `es_MX`…) is the language of the text, to play it with a voice for that language. |
| `stop` | Closes the microphone and clears anything heard. |

The AI converses in a loop: `listen` → does what is asked → `speak` → `listen`, answering in the language the user speaks.

## How it listens

- **Continuous:** the microphone stays open from the first `listen`, also while the AI talks, so the user can answer or interrupt at once.
- **End of turn:** at every 0.3 s pause, Smart Turn (about 100 ms on CPU, 23 languages) looks at the intonation and tells whether the user finished or is only pausing. If they finished, the sentence closes there; otherwise after 1.5 s of silence. It is only asked with at least 1 s of voice (so a short question is not split), never while the AI talks (what is heard is its echo), and one question at a time. It is downloaded once, at a pinned version verified with its SHA-256 hash.
- **"I heard you":** when the user's sentence closes while the AI listens, a short soft tone plays, so the user knows they were heard while the AI thinks. It does not play for the AI's own echo.
- **Sentences:** `listen` returns whole sentences. If voice keeps playing in the background (a TV, a video), `listen` does not wait forever: it returns what it understood at most 3 s later, and whatever there is after 60 s; anything still playing goes to the next `listen`. Each new tool call (`speak`, `stop`) ends a waiting `listen`, so the AI can always speak.
- **Room noise:** when the microphone opens it measures 0.3 s of background noise, and that level lasts the whole conversation: it falls fast with silence and rises very slowly, so voice is never mistaken for noise. Voice only needs to be twice as loud as the noise. It is not learned while the AI talks: the AI's echo is not room noise, and after a minute of reading the user would become inaudible.
- **Only your voice:** your first three sentences of more than 1.5 s teach it your voiceprint, kept in `~/.sanoriva-agent/voiceprint.json` (readable only by you) and refined with every sentence of yours. From then on, a sentence that does not sound like you (a TV, a video, someone nearby) is dropped before Whisper, and only your voice cuts the AI off; checking it takes about a second of your voice, instead of 0.2 s. Very short sentences ("yes", "stop") always pass. If it learned the wrong voice, `--forget-voice`.
- **No endless transcriptions:** Whisper may write at most about 8 tokens per second of audio, so a loop it makes up over noise is cut at once.
- **Echo:** whatever the microphone picks up of the AI's own voice is dropped by comparing it with what the AI just said. When the AI stops talking, the current sentence (its echo) closes there, so what the user says right after arrives as a separate, whole sentence.
- **Interrupting the AI:** if the user talks while the AI talks, the AI goes quiet at once. To tell the user's voice from the AI's echo through the speakers, it compares what the microphone hears with what is playing (the Geigel double-talk detector used by hands-free phones): during the first half second of each sentence it learns how much of its voice comes back, and if the microphone hears more than twice that for 0.2 s, it stops Piper and drops its queue (without waiting for Silero, which finds too little voice in a short "stop"). If that does not fire (with loudspeakers, the user's voice and the echo may arrive equally loud), there is a second path: a sentence that started while the AI was talking and carries words the AI was not saying is the user, and it cuts the AI off as soon as Whisper transcribes it (about 1 s). Echo leftovers are dropped because they are the AI's own words. The user's sentence arrives whole on the next `listen`, which starts with "(the user interrupted you while you were speaking)". With the system voice (`--tts system`) what plays is unknown, so it does not cut off. With headphones there is no echo and it always works.
- **Stray noises:** a "sentence" with less than 0.3 s of voice (a knock, a cough) is not even transcribed.
- **Language of each sentence:** without `--language`, Whisper checks which language it hears before transcribing (like the original Whisper; transformers.js does not do it by itself and, without a language, would transcribe everything as English) and transcribes in that language.
- **Only human voice reaches Whisper:** over noise, Whisper makes up sentences (from the subtitles it was trained on, such as "Subscribe!"). To avoid it, every sentence first goes through Silero VAD, which tells human voice from noise in any language; without at least 250 ms of voice it is not transcribed. Silero stops as soon as it finds those 250 ms: ONNX Runtime alternates passes of each model, and going through a whole sentence behind Smart Turn once took 30 s. There is no list of phrases: it works for any language.

## How it speaks

- **Piper** turns the text into audio and **ffplay** plays it while it is generated, so it starts in under half a second. `speak` returns at once; sentences play one after another, and the echo keeps being dropped until each one finishes.
- **The voice for each language** comes from the official Piper catalog (`voices.json`, at a pinned version): one for the exact variant if any (`es_MX`), otherwise one for its language (`es`); among several, `medium` quality (natural and fast) before `high`, `low` or `x_low`, and on a tie the first by name. It is downloaded the first time and verified with the catalog hashes.
- **Piper** is downloaded at a pinned version and verified with its SHA-256 hash: it is an executable, so nothing else is accepted.
- If Piper fails (offline the first time, a platform without Piper…), it speaks with the system voice and logs it.

## Privacy

- Audio never leaves your machine: it is transcribed and spoken locally, then discarded.
- Only the programs and models in the table above are downloaded, once, and nothing is ever sent.
- The microphone closes with `stop` (when the user says "stop" or "goodbye") and also by itself if the AI stops listening for 30 s.
- stdout is the MCP channel; logs go to stderr.
