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
