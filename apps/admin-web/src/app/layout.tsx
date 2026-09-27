import type { ReactNode } from 'react';
import { Work_Sans } from 'next/font/google';
import './globals.css';

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-work-sans',
});

export const metadata = {
  title: 'MetroClub Admin',
  description: 'Panel de administración del programa de fidelización MetroClub',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={workSans.variable}>
      <body>{children}</body>
    </html>
  );
}
