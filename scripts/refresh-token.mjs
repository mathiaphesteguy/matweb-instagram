// Renueva el token de Instagram (dura 60 días) e imprime el nuevo por stdout.
// El workflow lo guarda otra vez como secreto IG_ACCESS_TOKEN.
const url = new URL('https://graph.instagram.com/refresh_access_token');
url.searchParams.set('grant_type', 'ig_refresh_token');
url.searchParams.set('access_token', process.env.IG_ACCESS_TOKEN ?? '');

const res = await fetch(url);
const data = await res.json();
if (!res.ok || !data.access_token) {
  console.error('No se pudo renovar el token:', JSON.stringify(data.error ?? data));
  process.exit(1);
}
process.stdout.write(data.access_token);
