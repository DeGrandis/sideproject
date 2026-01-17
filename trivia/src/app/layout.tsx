import { SocketProvider } from '@/components/SocketProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';

export const metadata = {
  title: 'Trivia Game',
  description: 'Multiplayer trivia game built with Next.js and Socket.io',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
