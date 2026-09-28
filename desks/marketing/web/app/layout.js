import Providers from '@/components/Providers';
import './globals.css';

export const metadata = {
  title: 'Silverleaf Academy — Marketing',
  description: 'Silverleaf Academy management platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Silverleaf Marketing',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
