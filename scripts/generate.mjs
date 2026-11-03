// Elige el próximo diseño sin publicar y genera los 3 slides del carrusel (1440x1800 JPG).
//
//   node scripts/generate.mjs            -> próximo diseño, respeta el intervalo de 2 días
//   node scripts/generate.mjs --all      -> todos los diseños en preview/ (solo para revisar)
//   node scripts/generate.mjs --slug 03-pulso-gym
//   FORCE=true node scripts/generate.mjs -> ignora el intervalo
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJson, setOutput, slidePaths } from './lib.mjs';

// El workflow corre todos los días; se publica cuando pasaron al menos ~2 días.
// 44 h en vez de 48 para tolerar que GitHub demore el cron algunos minutos.
const MIN_HOURS_BETWEEN_POSTS = 44;

const args = process.argv.slice(2);
const all = args.includes('--all');
const slugArg = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const force = process.env.FORCE === 'true';

const cfg = await readJson('posts.json');
const state = await readJson('state.json', { posted: [] });
const posted = new Set(state.posted.map(p => p.slug));

let targets;
if (all) {
  targets = cfg.sites;
} else {
  const last = state.posted.at(-1);
  const hours = last ? (Date.now() - Date.parse(last.at)) / 36e5 : Infinity;
  if (!force && !slugArg && hours < MIN_HOURS_BETWEEN_POSTS) {
    console.log(`Última publicación hace ${hours.toFixed(1)} h. Hoy no toca publicar.`);
    await setOutput('skip', 'true');
    process.exit(0);
  }
  const next = slugArg ? cfg.sites.find(s => s.slug === slugArg) : cfg.sites.find(s => !posted.has(s.slug));
  if (!next) {
    console.error(slugArg ? `No existe el diseño "${slugArg}" en posts.json.` : 'Ya se publicaron todos los diseños de posts.json. Agregá más en sites/ y posts.json.');
    await setOutput('skip', 'true');
    process.exit(1);
  }
  targets = [next];
}

const outDir = all ? 'preview' : 'output';
const mockup = pathToFileURL(path.join(ROOT, 'mockup', 'mockup.html')).href;

const browser = await chromium.launch();
// 1080x1350 con escala 4/3 => imágenes de 1440x1800 (4:5, el máximo que acepta Instagram)
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 4 / 3 });

for (const site of targets) {
  const n = String(cfg.sites.indexOf(site) + 1).padStart(2, '0');
  const files = slidePaths(outDir, site.slug);
  await mkdir(path.dirname(files[0]), { recursive: true });

  for (const [i, file] of files.entries()) {
    const q = new URLSearchParams({
      site: site.slug, slide: i + 1, name: site.name, tag: site.tag, n,
      handle: cfg.handle, bg: site.bg, ink: site.ink, accent: site.accent,
      font: site.font ?? '', fw: site.fw ?? '700',
      // Alterna la composición del slide 1 para que el feed no se vea repetido
      layout: cfg.sites.indexOf(site) % 2 ? 'b' : 'a',
    });
    await page.goto(`${mockup}?${q}`, { waitUntil: 'networkidle' });
    // Esperar a que carguen las tipografías del mockup y de cada iframe
    for (const frame of page.frames()) await frame.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForTimeout(400);
    await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  }
  console.log(`✓ ${site.slug} -> ${path.relative(ROOT, path.dirname(files[0]))}`);
}

await browser.close();

if (!all) {
  await setOutput('skip', 'false');
  await setOutput('slug', targets[0].slug);
}
