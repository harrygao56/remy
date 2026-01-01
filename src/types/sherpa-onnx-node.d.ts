declare module "sherpa-onnx-node" {
  export interface SileroVadConfig {
    model: string;
    threshold?: number;
    minSpeechDuration?: number;
    minSilenceDuration?: number;
    maxSpeechDuration?: number;
    windowSize?: number;
  }

  export interface VadConfig {
    sileroVad: SileroVadConfig;
    sampleRate: number;
    debug?: boolean;
    numThreads?: number;
  }

  export interface SpeechSegment {
    samples: Float32Array;
    start: number;
  }

  export class Vad {
    config: VadConfig;
    constructor(config: VadConfig, bufferSizeInSeconds: number);
    acceptWaveform(samples: Float32Array): void;
    isEmpty(): boolean;
    isDetected(): boolean;
    pop(): void;
    clear(): void;
    front(enableExternalBuffer?: boolean): SpeechSegment;
    reset(): void;
    flush(): void;
  }

  export class CircularBuffer {
    constructor(capacity: number);
    push(samples: Float32Array): void;
    get(
      startIndex: number,
      n: number,
      enableExternalBuffer?: boolean
    ): Float32Array;
    pop(n: number): void;
    size(): number;
    head(): number;
    reset(): void;
  }

  export interface OfflineRecognizerConfig {
    featConfig?: {
      sampleRate?: number;
      featureDim?: number;
    };
    modelConfig: {
      whisper?: { encoder: string; decoder: string };
      zipformerCtc?: { model: string };
      nemoCtc?: { model: string };
      senseVoice?: { model: string };
      tokens: string;
      numThreads?: number;
      provider?: string;
      debug?: number;
    };
  }

  export interface RecognitionResult {
    text: string;
    tokens?: string[];
    timestamps?: number[];
  }

  export class OfflineStream {
    acceptWaveform(obj: { samples: Float32Array; sampleRate: number }): void;
  }

  export class OfflineRecognizer {
    config: OfflineRecognizerConfig;
    constructor(config: OfflineRecognizerConfig);
    createStream(): OfflineStream;
    decode(stream: OfflineStream): void;
    getResult(stream: OfflineStream): RecognitionResult;
  }

  export function readWave(filename: string): {
    samples: Float32Array;
    sampleRate: number;
  };
  export function writeWave(
    filename: string,
    obj: { samples: Float32Array; sampleRate: number }
  ): void;
}
