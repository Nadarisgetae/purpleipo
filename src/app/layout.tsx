import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PurpleIPO — Private IPO Intelligence Platform',
  description:
    'AI-powered IPO scoring, RHP analysis, market signals, and lifecycle tracking. Built for deep-research IPO intelligence.',
  keywords: ['IPO', 'India IPO', 'IPO analysis', 'RHP scoring', 'SEBI', 'Gemini AI', 'stock market'],
  authors: [{ name: 'PurpleIPO' }],
  robots: 'noindex, nofollow', // private tool — do not index
  openGraph: {
    title: 'PurpleIPO — Private IPO Intelligence Platform',
    description: 'AI-powered IPO lifecycle tracking, RHP scoring, and market signal analysis.',
    type: 'website',
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090d16',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-purple-600 selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}

