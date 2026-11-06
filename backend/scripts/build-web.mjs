// Bundles the browser scripts (the advertiser page, with the Arkiv SDK, and the public passport page, with viem) into static files.
//   npm run build:web
import { build } from 'esbuild';
for (const name of ['sponsor', 'passport', 'hero-globe']) {
  await build({
    entryPoints: [new URL(`../web/${name}.js`, import.meta.url).pathname],
    outfile: new URL(`../public/${name}.bundle.js`, import.meta.url).pathname,
    bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'info',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
}
