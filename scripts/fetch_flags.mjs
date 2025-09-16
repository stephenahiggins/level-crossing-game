#!/usr/bin/env node
import fs from "fs";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputPath = path.resolve(root, "frontend/src/assets/flags_base64.json");

const DEFAULT_COUNTRY_CODES = [
  "AR",
  "AT",
  "AU",
  "BE",
  "BR",
  "CA",
  "CH",
  "CL",
  "CN",
  "CZ",
  "DE",
  "DK",
  "ES",
  "FI",
  "FR",
  "GB",
  "IE",
  "IN",
  "IT",
  "JP",
  "KR",
  "LU",
  "MX",
  "NL",
  "NO",
  "NZ",
  "PL",
  "PT",
  "SE",
  "US",
  "ZA",
];

let codes = process.argv.slice(2);
if (!codes.length) {
  console.log("No country codes provided, using default list.");
  codes = DEFAULT_COUNTRY_CODES;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const execAsync = promisify(execFile);

const downloadFlag = async (code) => {
  const lower = code.toLowerCase();
  const url = `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${lower}.svg`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await execAsync("curl", ["-fsSL", url]);
      const svg = stdout;
      const buffer = Buffer.from(svg, "utf-8");
      const base64 = `data:image/svg+xml;base64,${buffer.toString("base64")}`;
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
console.log("Flags courtesy of the lipis/flag-icons project (MIT license)");
