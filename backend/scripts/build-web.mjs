// Bundles the advertiser page's script (and the Arkiv SDK it needs) into one static file the server can hand out.
//   npm run build:web
import { build } from 'esbuild';
await build({
  entryPoints: [new URL('../web/sponsor.js', import.meta.url).pathname],
  outfile: new URL('../public/sponsor.bundle.js', import.meta.url).pathname,
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
});
