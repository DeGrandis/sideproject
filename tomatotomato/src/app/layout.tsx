import { SocketProvider } from '@/components/SocketProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Tomatotomato',
    template: '%s | Tomatotomato'
  },
  description: 'Challenge your friends in real-time multiplayer Apples to Apples style game with AI-generated prompts. Create custom lobbies and compete to find the best matches.',
  keywords: ['apples to apples', 'multiplayer game', 'party game', 'AI game', 'real-time game', 'online game'],
  authors: [{ name: 'DEGRAND.IS' }],
  creator: 'DEGRAND.IS',
  publisher: 'DEGRAND.IS',
  metadataBase: new URL('https://tomatotomato.degrand.is'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Tomatotomato',
    description: 'Challenge your friends in real-time multiplayer Apples to Apples style game with AI-generated prompts.',
    url: 'https://tomatotomato.degrand.is',
    siteName: 'Tomatotomato',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/icon.svg',
        width: 100,
        height: 45,
        alt: 'Tomatotomato Logo',
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Tomatotomato',
    description: 'Challenge your friends in real-time multiplayer Apples to Apples style game.',
    creator: '@degrandis',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@400;600;700&family=Geist:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          <SocketProvider>
            <ThemeToggle />
            {children}
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
