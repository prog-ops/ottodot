import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ottodot | Trial Class Booking Reliability',
  description: 'Live online science and math classes for kids - High-reliability trial booking system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
