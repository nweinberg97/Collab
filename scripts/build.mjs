// Collab build script — esbuild only, no other infrastructure.
//   npm run dev           → watch + serve on http://localhost:5173
//   npm run build         → dist/ (index.html + app.js + app.css)
//   npm run build:single  → dist-single/index.html (one self-contained file)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const serve = args.has('--serve');
const single = args.has('--single');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Minimal .env loader (no dotenv dependency). Only COLLAB_* keys are exposed to the client.
function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*(COLLAB_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith('COLLAB_')) env[k] = v;
  return env;
}
const env = loadEnv();
const define = {
  'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production'),
  __COLLAB_ENV__: JSON.stringify({
    spotifyClientId: env.COLLAB_SPOTIFY_CLIENT_ID || '',
    spotifyRedirectUri: env.COLLAB_SPOTIFY_REDIRECT_URI || '',
  }),
};

const outdir = path.join(root, single ? 'dist-single' : 'dist');
fs.mkdirSync(outdir, { recursive: true });

const options = {
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  outdir,
  entryNames: 'app',
  jsx: 'automatic',
  format: 'esm',
  target: ['es2020'],
  minify: !serve,
  sourcemap: serve,
  define,
  loader: { '.svg': 'text' },
  plugins: [],
  logLevel: 'info',
};

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">`;
const favicon = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
const faviconTag = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(favicon)}">`;

function writeHtml() {
  if (single) {
    const js = fs.readFileSync(path.join(outdir, 'app.js'), 'utf8').replace(/<\/script/g, '<\\/script');
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
    const html = `<title>Collab</title>
${fonts}
${faviconTag}
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
    fs.writeFileSync(path.join(outdir, 'index.html'), html);
    fs.rmSync(path.join(outdir, 'app.js'));
    console.log(`single-file build → ${path.relative(root, outdir)}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
    return;
  }
  fs.copyFileSync(path.join(root, 'src/styles.css'), path.join(outdir, 'app.css'));
  fs.writeFileSync(
    path.join(outdir, 'index.html'),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#070807">
<title>Collab</title>
<meta name="description" content="Collab helps artists discover collaborators based on sound, audience, and creative compatibility.">
${fonts}
${faviconTag}
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script type="module" src="app.js"></script>
</body>
</html>
`,
  );
}

if (serve) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [...options.plugins, { name: 'html', setup(b) { b.onEnd(() => writeHtml()); } }],
  });
  if (!args.has('--no-watch')) await ctx.watch();
  else { await ctx.rebuild(); }
  // Watch styles.css separately (it is copied, not bundled).
  fs.watch(path.join(root, 'src/styles.css'), () => writeHtml());
  const { port } = await ctx.serve({ servedir: outdir, port: Number(process.env.PORT || 5173) });
  console.log(`\n  Collab running at http://localhost:${port}\n`);
} else {
  await esbuild.build(options);
  writeHtml();
}
