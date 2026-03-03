import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '..', 'resources', 'models');
const SHERPA_DIR = join(MODELS_DIR, 'sherpa');

// LLM models
const LLM_MODELS = [
  {
    name: 'LFM2 350M GGUF.gguf',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf?download=true'
  },
];

// Sherpa-ONNX ASR models
const SHERPA_MODELS = [
  {
    name: 'silero_vad.onnx',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    type: 'file'
  },
  {
    name: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09.tar.bz2',
    type: 'tarball'
  }
];

async function downloadFile(url, dest, name) {
  console.log(`⬇ Downloading ${name}...`);
  console.log(`  From: ${url}`);
  
  const res = await fetch(url, { redirect: 'follow' });
  
  if (!res.ok) {
    throw new Error(`Failed to download ${name}: ${res.status} ${res.statusText}`);
  }

  const contentLength = res.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
  let downloadedBytes = 0;

  // Progress tracking
  const progressStream = new TransformStream({
    transform(chunk, controller) {
      downloadedBytes += chunk.length;
      if (totalBytes) {
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
        const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r  Progress: ${mb}MB / ${totalMb}MB (${percent}%)`);
      }
      controller.enqueue(chunk);
    }
  });

  await pipeline(
    res.body.pipeThrough(progressStream),
    createWriteStream(dest)
  );
  
  console.log(`\n✓ Downloaded ${name}`);
}

async function downloadLLMModel(model) {
  const dest = join(MODELS_DIR, model.name);
  
  if (existsSync(dest)) {
    console.log(`✓ ${model.name} already exists, skipping`);
    return;
  }

  await downloadFile(model.url, dest, model.name);
}

async function downloadSherpaModel(model) {
  if (model.type === 'file') {
    const dest = join(SHERPA_DIR, model.name);
    
    if (existsSync(dest)) {
      console.log(`✓ ${model.name} already exists, skipping`);
      return;
    }

    await downloadFile(model.url, dest, model.name);
  } else if (model.type === 'tarball') {
    const extractedDir = join(SHERPA_DIR, model.name);
    
    if (existsSync(extractedDir)) {
      console.log(`✓ ${model.name} already exists, skipping`);
      return;
    }

    const tarballName = model.url.split('/').pop();
    const tarballPath = join(SHERPA_DIR, tarballName);

    await downloadFile(model.url, tarballPath, model.name);

    console.log(`📦 Extracting ${tarballName}...`);
    try {
      execSync(`tar xvf "${tarballPath}"`, { cwd: SHERPA_DIR, stdio: 'pipe' });
      console.log(`✓ Extracted ${model.name}`);
    } catch (error) {
      throw new Error(`Failed to extract ${tarballName}: ${error.message}`);
    }

    // Clean up tarball
    unlinkSync(tarballPath);
    console.log(`🗑 Removed ${tarballName}`);
  }
}

async function main() {
  console.log('Model Download Script');
  console.log('=====================\n');
  
  mkdirSync(MODELS_DIR, { recursive: true });
  mkdirSync(SHERPA_DIR, { recursive: true });

  // Download LLM models
  console.log('📁 LLM Models\n');
  for (const model of LLM_MODELS) {
    try {
      await downloadLLMModel(model);
    } catch (error) {
      console.error(`✗ Error downloading ${model.name}:`, error.message);
      process.exit(1);
    }
  }

  // Download Sherpa-ONNX models
  console.log('\n📁 Sherpa-ONNX Models\n');
  for (const model of SHERPA_MODELS) {
    try {
      await downloadSherpaModel(model);
    } catch (error) {
      console.error(`✗ Error downloading ${model.name}:`, error.message);
      process.exit(1);
    }
  }
  
  console.log('\n✅ All models downloaded!');
}

main();
