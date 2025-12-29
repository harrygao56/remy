import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '..', 'resources', 'models');

const MODELS = [
  {
    name: 'LFM2 8B A1B GGUF.gguf',
    url: 'https://huggingface.co/LiquidAI/LFM2-8B-A1B-GGUF/resolve/main/LFM2-8B-A1B-Q4_K_M.gguf'
  },
];

async function downloadModel(model) {
  const dest = join(MODELS_DIR, model.name);
  
  if (existsSync(dest)) {
    console.log(`✓ ${model.name} already exists, skipping`);
    return;
  }

  console.log(`⬇ Downloading ${model.name}...`);
  console.log(`  From: ${model.url}`);
  
  const res = await fetch(model.url);
  
  if (!res.ok) {
    throw new Error(`Failed to download ${model.name}: ${res.status} ${res.statusText}`);
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
  
  console.log(`\n✓ Downloaded ${model.name}`);
}

async function main() {
  console.log('Model Download Script');
  console.log('=====================\n');
  
  mkdirSync(MODELS_DIR, { recursive: true });

  for (const model of MODELS) {
    try {
      await downloadModel(model);
    } catch (error) {
      console.error(`✗ Error downloading ${model.name}:`, error.message);
      process.exit(1);
    }
  }
  
  console.log('\nDone!');
}

main();

