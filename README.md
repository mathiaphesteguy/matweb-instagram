# Automatización de Instagram: una web cada 2 días

Cada 2 días, GitHub Actions toma el próximo diseño de `sites/`, genera un **carrusel de 3 imágenes** y lo publica en tu cuenta con su texto y hashtags:

1. Mockup con notebook y celular juntos
2. Versión escritorio dentro de una ventana de navegador
3. Versión celular en dos teléfonos

Las páginas **no se publican en internet**: solo se suben las capturas. Todo corre en la nube de GitHub, así que no hace falta tener la PC prendida.

```
sites/<diseño>/index.html   los diseños (10 incluidos = 20 días de contenido)
posts.json                  orden, textos, colores y hashtags de cada publicación
mockup/mockup.html          plantilla de los slides (notebook, navegador y celulares)
mockup/gallery.html         vista previa de todas las publicaciones
scripts/generate.mjs        genera las imágenes con Chromium (Playwright)
scripts/publish.mjs         publica el carrusel con la API oficial de Instagram
state.json                  registro de lo que ya se publicó (lo actualiza el robot)
.github/workflows/          la programación diaria
```

---

## Configuración (una sola vez, ~20 minutos)

### 1. Subir el proyecto a GitHub

1. Creá una cuenta en <https://github.com> si no tenés.
2. Creá un repositorio nuevo, por ejemplo `instagram-webs`, y elegí **Public**. Tiene que ser público porque Instagram descarga las imágenes desde ahí.
3. Subí todos los archivos de esta carpeta, incluida la carpeta `.github`. Lo más fácil es usar [GitHub Desktop](https://desktop.github.com), o arrastrar las carpetas en la web con **Add file → Upload files**.

### 2. Crear la app de Meta y obtener el token de Instagram

Con tu cuenta profesional **no hace falta vincularla a Facebook**: se usa la "API de Instagram con inicio de sesión de Instagram".

1. Entrá a <https://developers.facebook.com>, iniciá sesión y registrate como desarrollador (es gratis).
2. Andá a **Mis apps → Crear app** y elegí el caso de uso **"Administrar mensajes y contenido en Instagram"**.
3. En el panel de la app, abrí **API de Instagram → Configuración de la API con inicio de sesión de Instagram**.
4. En **"Generar tokens de acceso"**, tocá **Agregar cuenta** e iniciá sesión con tu cuenta de Instagram.
   - Si te pide aceptar una invitación de evaluador, hacelo desde la app de Instagram en **Configuración → Apps y sitios web → Invitaciones de evaluador**, y volvé a intentar.
5. Tocá **Generar token** y copialo. Es un token de larga duración, válido por 60 días.

> La app puede quedarse en **modo desarrollo**: para publicar en tu propia cuenta no hace falta que Meta la revise.

### 3. Cargar los secretos en GitHub

En tu repositorio, andá a **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre | Valor |
|---|---|
| `IG_ACCESS_TOKEN` | el token que copiaste en el paso 2 |
| `GH_PAT` *(opcional, recomendado)* | un token de GitHub que permite renovar el de Instagram de forma automática |

Para crear `GH_PAT`: andá a <https://github.com/settings/personal-access-tokens/new> y creá un *Fine-grained token* con estos datos:
- **Repository access:** solo este repositorio.
- **Permissions → Secrets:** Read and write.
- **Expiration:** la máxima que te permita.

Sin `GH_PAT` todo funciona igual, pero cada 60 días vas a tener que generar el token de Instagram de nuevo y reemplazar `IG_ACCESS_TOKEN`.

### 4. Personalizar

En `posts.json`, cambiá `"handle": "@tucuenta"` por tu usuario real, porque aparece en las imágenes. Ahí también podés editar los textos, los hashtags y el llamado a la acción (`cta`).

### 5. Probar

1. En el repositorio, andá a **Actions → Publicar en Instagram → Run workflow** y marcá **dry_run**. Así solo se generan las imágenes.
2. Revisá el resultado en la carpeta `output/` del repositorio.
3. Para hacer la primera publicación real, volvé a correrlo con **force** marcado y **dry_run** desmarcado.

A partir de ahí corre solo todos los días a las 18:00 (hora de Argentina) y publica cuando pasaron 2 días desde la última publicación.

---

## Uso diario

- **Ver qué se publicó:** abrí `state.json` o la pestaña **Actions**.
- **Cambiar el horario:** editá el `cron` en `.github/workflows/instagram.yml`. Está en hora UTC, que es la de Argentina + 3.
- **Agregar diseños:** creá una carpeta en `sites/` con un `index.html` y sumá una entrada al final de `sites` en `posts.json`, con `slug` igual al nombre de la carpeta.
- **Cuando se terminan los diseños:** el workflow falla y GitHub te manda un mail como recordatorio.

### Reglas para que los diseños salgan bien en las capturas
- No uses unidades `vh` ni `position: fixed` o `sticky`: la página se renderiza dentro de un iframe alto.
- Hacé que sea responsive con un `@media (max-width: 760px)`. El celular se emula a 390 px de ancho.
- La versión de escritorio muestra los primeros 1800 px de alto, a 1440 px de ancho.

## Problemas comunes

| Error | Solución |
|---|---|
| `Falta el secreto IG_ACCESS_TOKEN` | Cargá el secreto (paso 3). |
| `Error validating access token` / `Session has expired` | El token venció: generá uno nuevo (paso 2.5) y reemplazá el secreto. Para que no vuelva a pasar, configurá `GH_PAT`. |
| `La imagen no es accesible públicamente` | El repositorio tiene que ser **Public**. |
| `git push` rechazado / `403` | En **Settings → Actions → General → Workflow permissions**, elegí **Read and write permissions**. |
| `Application request limit reached` | Esperá unas horas: Meta limita la cantidad de llamadas por hora. |
