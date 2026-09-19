import { Bricolage_Grotesque, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import { Providers } from './providers';

// Variable font with the opsz axis, as the design loads it: display sizes get the tighter optical cut.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-bricolage', display: 'swap' });
const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-source-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata = {
  title: 'SynapseAI — Think together. Verify smarter.',
  description: 'Three models. One accountable answer.',
};

export const viewport = { themeColor: '#0E1116' };

// Applied before hydration so a saved light theme never flashes dark.
const themeScript = `try{var t=localStorage.getItem('synapse-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${bricolage.variable} ${sourceSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
