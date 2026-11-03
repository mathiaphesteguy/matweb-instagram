// Publica en Instagram el carrusel ya generado en output/<slug>/ y lo anota en state.json.
// Usa la API oficial de Instagram con inicio de sesión de Instagram (no requiere página de Facebook).
//
// Variables de entorno:
//   IG_ACCESS_TOKEN    token de larga duración de la cuenta
//   SLUG               diseño a publicar (lo pasa el workflow)
//   GITHUB_REPOSITORY  usuario/repo, lo define GitHub Actions
import { execSync } from 'node:child_process';
import { readJson, writeJson } from './lib.mjs';

const API = 'https://graph.instagram.com/v23.0';
const TOKEN = process.env.IG_ACCESS_TOKEN;
const SLUG = process.env.SLUG;
const REPO = process.env.GITHUB_REPOSITORY;

if (!TOKEN) throw new Error('Falta el secreto IG_ACCESS_TOKEN.');
if (!SLUG || !REPO) throw new Error('Faltan SLUG o GITHUB_REPOSITORY.');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ig(method, pathname, params = {}) {
  const url = new URL(API + pathname);
  for (const [k, v] of Object.entries({ ...params, access_token: TOKEN })) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Instagram ${method} ${pathname}: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

// Instagram procesa cada contenedor en segundo plano; hay que esperar a FINISHED antes de seguir
async function waitReady(id) {
  for (let i = 0; i < 30; i++) {
    const { status_code } = await ig('GET', `/${id}`, { fields: 'status_code' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`El contenedor ${id} quedó en ${status_code}.`);
    await sleep(5000);
  }
  throw new Error(`El contenedor ${id} no terminó de procesarse.`);
}

// Las imágenes se sirven desde el commit recién subido; raw.githubusercontent puede tardar unos segundos
async function waitPublic(url) {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return;
    await sleep(5000);
  }
  throw new Error(`La imagen no es accesible públicamente: ${url} (¿el repositorio es público?)`);
}

const cfg = await readJson('posts.json');
const state = await readJson('state.json', { posted: [] });
const site = cfg.sites.find(s => s.slug === SLUG);
if (!site) throw new Error(`No existe "${SLUG}" en posts.json.`);

const sha = execSync('git rev-parse HEAD').toString().trim();
const urls = [1, 2, 3].map(n => `https://raw.githubusercontent.com/${REPO}/${sha}/output/${SLUG}/slide-${n}.jpg`);
for (const url of urls) await waitPublic(url);

const caption = [site.caption, '', cfg.cta, '', [...site.hashtags, ...cfg.hashtagsBase].join(' ')].join('\n');

const me = await ig('GET', '/me', { fields: 'user_id,username' });
const userId = me.user_id ?? me.id;
console.log(`Publicando "${site.name}" en @${me.username}...`);

const children = [];
for (const image_url of urls) {
  const { id } = await ig('POST', `/${userId}/media`, { image_url, is_carousel_item: 'true' });
  await waitReady(id);
  children.push(id);
}
const carousel = await ig('POST', `/${userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
await waitReady(carousel.id);
const { id: mediaId } = await ig('POST', `/${userId}/media_publish`, { creation_id: carousel.id });

state.posted.push({ slug: SLUG, at: new Date().toISOString(), mediaId });
await writeJson('state.json', state);
console.log(`✓ Publicado (media id ${mediaId}).`);
