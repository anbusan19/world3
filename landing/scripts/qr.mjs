// Draws the QR code for the Android download (public/apk-qr.svg). Run: npm run qr
// The link is the stable "latest release" asset address on GitHub, so a new release replaces the file without a new code.
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';
const url = process.env.NEXT_PUBLIC_APK_URL || 'https://github.com/anbusan19/world3/releases/latest/download/world3.apk';
const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B0B0F', light: '#FFFFFF' } });
writeFileSync(new URL('../public/apk-qr.svg', import.meta.url), svg);
console.log('QR for', url);
