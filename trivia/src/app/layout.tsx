import { SocketProvider } from '@/components/SocketProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Infinitivia',
    template: '%s | Infinitivia'
  },
  description: 'Challenge your friends in real-time multiplayer trivia with AI-generated questions. Create custom lobbies with any theme and difficulty level.',
  keywords: ['trivia', 'multiplayer game', 'quiz game', 'AI trivia', 'real-time game', 'trivia night', 'online quiz'],
  authors: [{ name: 'DEGRAND.IS' }],
  creator: 'DEGRAND.IS',
  publisher: 'DEGRAND.IS',
  metadataBase: new URL('https://trivia.degrand.is'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Infinitivia',
    description: 'Challenge your friends in real-time multiplayer trivia with AI-generated questions. Create custom lobbies with any theme and difficulty level.',
    url: 'https://trivia.degrand.is',
    siteName: 'Infinitivia',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1205,
        height: 666,
        alt: 'Infinitivia',
      },
      {
        url: '/icon.svg',
        width: 100,
        height: 45,
        alt: 'Infinitivia Logo',
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Infinitivia',
    description: 'Challenge your friends in real-time multiplayer trivia with AI-generated questions.',
    images: ['/og-image.png'],
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
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
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
        <meta property="og:logo" content="https://trivia.degrand.is/icon.svg" />
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
