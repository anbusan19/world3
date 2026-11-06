import assert from 'node:assert/strict';
import test from 'node:test';
import { adCardSvg, sharePage, stampCardSvg, toPng, wrap } from '../src/share.js';

const isPng = (b) => b.length > 1000 && b.subarray(1, 4).toString() === 'PNG';

test('cards render to real 1200x630 PNGs and never trust text', () => {
  const png = toPng(stampCardSvg({ spot: { name: 'Gateway <b>of</b> India', label: 'GATEWAY', city: 'Mumbai', theme: 'coral' } }));
  assert.ok(isPng(png));
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  const svg = adCardSvg({ sponsor: '<script>x</script>', headline: 'a "quote" & more', creative: null });
  assert.ok(!svg.includes('<script>') && svg.includes('&lt;script&gt;'));
  assert.ok(isPng(toPng(svg)));
});
test('long text is wrapped and cut with an ellipsis, not left to overflow', () => {
  assert.deepEqual(wrap('one two three', 20, 2), ['one two three']);
  const lines = wrap('word '.repeat(60), 30, 3);
  assert.equal(lines.length, 3); assert.ok(lines[2].endsWith('…')); assert.ok(lines.every((l) => l.length <= 31));
});
test('the share page carries the Open Graph and Twitter card tags with the picture', () => {
  const html = sharePage({ title: 'T "x"', description: 'D', image: 'https://h/share/ad/0x1.png', url: 'https://h/share/ad/0x1' });
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="og:image" content="https:\/\/h\/share\/ad\/0x1\.png"/);
  assert.ok(!html.includes('T "x"'));
});

// ---- a WebP ad must show up on the card (resvg draws nothing for WebP, so it is converted to PNG first) ----------------------
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { adCardSvg as cardSvg, renderableImage, toPng as svgToPng } from '../src/share.js';

test('a WebP ad is converted to PNG so resvg can draw it', async () => {
  const webp = readFileSync(new URL('./fixtures/ad.webp', import.meta.url));
  const out = await renderableImage(webp, 'image/webp');
  assert.equal(out.mime, 'image/png');
  assert.deepEqual([...out.creative.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  // PNG and JPEG are passed through untouched
  assert.equal((await renderableImage(out.creative, 'image/png')).creative, out.creative);
});

test('the share card really contains the ad picture (the picture area is not the empty white box)', async () => {
  const webp = readFileSync(new URL('./fixtures/ad.webp', import.meta.url));
  const pic = await renderableImage(webp, 'image/webp');
  const png = svgToPng(cardSvg({ sponsor: 'Acme', headline: 'Free coffee', creative: pic.creative, mime: pic.mime }));
  const img = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><image href="data:image/png;base64,${png.toString('base64')}" width="1200" height="630"/></svg>`).render();
  const px = img.pixels; // RGBA, 1200 wide
  const at = (x, y) => { const i = (y * 1200 + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
  // the picture's blue background is at the middle of the picture box (x 660-1140, y 150-420), not white
  const [r, g, b] = at(700, 380);
  assert.ok(!(r > 240 && g > 240 && b > 240), `expected the ad picture there, got ${r},${g},${b}`);
});

test('a picture that cannot be read still gives a card (without the picture)', async () => {
  const out = await renderableImage(Buffer.from('not an image'), 'image/webp');
  assert.equal(out.creative, null);
  assert.ok(svgToPng(cardSvg({ sponsor: 'Acme', headline: 'Free coffee', creative: out.creative, mime: out.mime })).length > 1000);
});
