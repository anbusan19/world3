import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// The same typeface and weights the app loads: Plus Jakarta Sans 500 / 700 / 800.
const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display', display: 'swap' });

const TITLE = 'wrld3 · Go there. Prove it. Keep it.';
const DESCRIPTION = 'A 3D collectible pinned to a real place. Walk up to it through your camera, prove you are really there, and keep it as a stamp in your onchain passport.';
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://wrld3.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'wrld3',
  keywords: ['wrld3', 'World ID', 'ENS', 'Arkiv', 'onchain passport', 'proof of travel', 'ETHGlobal Mumbai', 'collectibles'],
  authors: [{ name: 'wrld3' }],
  openGraph: { type: 'website', siteName: 'wrld3', title: TITLE, description: DESCRIPTION, locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};
export const viewport = { themeColor: '#E6F7FB' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        {/* lets the CSS hide .reveal elements only when JavaScript will bring them back */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
