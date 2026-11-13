import { join } from 'node:path';

import { SeamlessM4TFeatureExtractor } from '@huggingface/transformers';
import { InferenceSession, Tensor } from 'onnxruntime-node';

import { download, type Fetch } from './download.js';

/** WeSpeaker ResNet34 (CC-BY-4.0, VoxCeleb), pinned version from the official repository. About 26 MB, CPU. */
export const WESPEAKER = {
  url: 'https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM/resolve/f0c48c298fd835726c27956a5d617bad7115627e/voxceleb_resnet34_LM.onnx',
  sha256: '7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068',
  size: 26530309,
};

/** Who is speaking, from how the voice sounds and not from the words, so it works in any language. */
export interface SpeakerCheck {
  embed(audio: Float32Array): Promise<Float32Array>;
}

/** WeSpeaker reads Kaldi fbank (80 bands, 25 ms frames every 10 ms) with each band's mean removed. */
export async function createSpeakerCheck({ cacheDir, fetchImpl }: { cacheDir: string; fetchImpl?: Fetch }): Promise<SpeakerCheck> {
  const model = await download(WESPEAKER.url, join(cacheDir, 'speaker', 'voxceleb_resnet34_LM.onnx'), WESPEAKER, fetchImpl);
  const session = await InferenceSession.create(model);
  const fbank = new SeamlessM4TFeatureExtractor({ sampling_rate: 16_000, num_mel_bins: 80 });
  const [input] = session.inputNames;
  const [output] = session.outputNames;

  return {
    async embed(audio) {
      const features = await fbank._extract_fbank_features(audio, Math.floor(audio.length / 160));
      const [frames, bands] = features.dims as [number, number];
      const data = Float32Array.from(features.data as Float32Array);
      for (let band = 0; band < bands; band++) {
        let mean = 0;
        for (let f = 0; f < frames; f++) mean += data[f * bands + band]!;
        mean /= frames;
        for (let f = 0; f < frames; f++) data[f * bands + band]! -= mean;
      }
      const result = await session.run({ [input!]: new Tensor('float32', data, [1, frames, bands]) });
      return Float32Array.from(result[output!]!.data as Float32Array);
    },
  };
}
