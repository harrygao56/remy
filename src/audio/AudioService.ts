import { PvRecorder } from "@picovoice/pvrecorder-node";
import * as sherpaOnnx from "sherpa-onnx-node";
import { app } from "electron";
import * as path from "path";

/**
 * Get the path to the sherpa models directory.
 * In development: ./resources/models/sherpa
 * In production: {resourcesPath}/resources/models/sherpa
 */
function getSherpaModelsPath(): string {
  const isProd = app.isPackaged;
  if (isProd) {
    return path.join(process.resourcesPath, "resources", "models", "sherpa");
  }
  return path.join(__dirname, "..", "..", "resources", "models", "sherpa");
}

class AudioService {
  private recorder: PvRecorder;
  private vad: sherpaOnnx.Vad;
  private recognizer: sherpaOnnx.OfflineRecognizer;
  private isRecording = false;
  private frames: Int16Array[];

  constructor() {
    const sherpaPath = getSherpaModelsPath();
    const vadModel = path.join(sherpaPath, "silero_vad.onnx");
    const senseVoiceDir = path.join(
      sherpaPath,
      "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09"
    );
    this.recorder = new PvRecorder(512, -1);
    this.vad = new sherpaOnnx.Vad(
      {
        sileroVad: {
          model: vadModel,
          threshold: 0.5,
          minSpeechDuration: 0.25,
          minSilenceDuration: 0.5,
          windowSize: 512,
        },
        sampleRate: 16000,
        debug: true,
        numThreads: 1,
      },
      60
    );
    this.recognizer = new sherpaOnnx.OfflineRecognizer({
      featConfig: {
        sampleRate: 16000,
        featureDim: 80,
      },
      modelConfig: {
        senseVoice: {
          model: path.join(senseVoiceDir, "model.int8.onnx"),
        },
        tokens: path.join(senseVoiceDir, "tokens.txt"),
        numThreads: 2,
        provider: "cpu",
        debug: 1,
      },
    });
  }

  async startRecording() {
    this.isRecording = true;
    this.frames = [];
    this.recorder.start();
    while (this.isRecording) {
      try {
        const audio = await this.recorder.read();
        this.frames.push(audio);
      } catch (error) {
        if (!this.isRecording) {
          break;
        }
        console.error("Error reading audio frame:", error);
        this.isRecording = false;
        break;
      }
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.isRecording) {
      return null;
    }

    this.isRecording = false;
    const frameLength = this.recorder.frameLength;
    this.recorder.stop();

    const data = new Int16Array(frameLength * this.frames.length);
    for (let i = 0; i < this.frames.length; i++) {
      data.set(this.frames[i], i * frameLength);
    }

    const floatData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      floatData[i] = data[i] / 32768.0;
    }

    this.vad.reset();

    let finalText = "";
    const bufferSizeInSeconds = 30;
    const buffer = new sherpaOnnx.CircularBuffer(
      bufferSizeInSeconds * this.vad.config.sampleRate
    );
    const windowSize = this.vad.config.sileroVad.windowSize;

    buffer.push(floatData);
    while (buffer.size() >= windowSize) {
      const samples = buffer.get(buffer.head(), windowSize, false);
      buffer.pop(windowSize);
      this.vad.acceptWaveform(samples);
    }

    this.vad.flush();

    while (!this.vad.isEmpty()) {
      const segment = this.vad.front(false);
      this.vad.pop();
      const stream = this.recognizer.createStream();
      stream.acceptWaveform({
        samples: segment.samples,
        sampleRate: this.recognizer.config.featConfig.sampleRate,
      });
      this.recognizer.decode(stream);
      const r = this.recognizer.getResult(stream);
      if (r.text.length > 0) {
        const text = r.text.toLowerCase().trim();
        finalText += text;
      }
    }
    return finalText;
  }
}

export const audioService = new AudioService();
