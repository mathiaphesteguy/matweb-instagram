import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function readJson(rel, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(rel, data) {
  await writeFile(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
}

// Pasa valores a los siguientes pasos del workflow de GitHub Actions
export async function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

export function slidePaths(dir, slug) {
  return [1, 2, 3].map(n => path.join(ROOT, dir, slug, `slide-${n}.jpg`));
}
