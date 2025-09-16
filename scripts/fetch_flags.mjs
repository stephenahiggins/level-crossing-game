#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputPath = path.resolve(root, 'frontend/src/assets/flags_base64.json');

const codes = process.argv.slice(2);
if (!codes.length) {
  console.log('Usage: node fetch_flags.mjs US GB FR ...');
  process.exit(1);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const downloadFlag = async (code) => {
  const lower = code.toLowerCase();
  const url = `https://flagcdn.com/w160/${lower}.png`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
      return base64;
    } catch (error) {
      console.warn(`Failed to download ${code} (attempt ${attempt}):`, error.message);
      await delay(500 * attempt);
    }
  }
  throw new Error(`Unable to download flag for ${code}`);
};

const result = {};
for (const code of codes) {
  console.log(`Fetching flag for ${code}`);
  result[code.toUpperCase()] = await downloadFlag(code);
}

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Saved ${codes.length} flags to ${outputPath}`);
console.log('Flags courtesy of flagcdn.com');
