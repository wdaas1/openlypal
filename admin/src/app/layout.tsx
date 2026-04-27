import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Openly Admin',
  description: 'Moderation dashboard for Openly',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1424',
              color: '#e2e8f0',
              border: '1px solid #243048',
            },
            success: { iconTheme: { primary: '#00ff88', secondary: '#0d1424' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#0d1424' } },
          }}
        />
      </body>
    </html>
  );
}
