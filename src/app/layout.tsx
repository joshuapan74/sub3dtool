import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sub3dtool Web - 3D Subtitle Converter',
  description: 'Convert regular subtitle files (SRT, ASS) to 3D Side-by-Side (SBS) or Top-Bottom (TB) formats for media players like VLC or MPlayer.',
  keywords: ['3D subtitle converter', 'subtitle SBS', 'subtitle top bottom', 'ASS 3D converter', 'SRT to ASS 3D'],
  authors: [{ name: 'Antigravity AI' }],
};

export const viewport: Viewport = {
  themeColor: '#070a13',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
