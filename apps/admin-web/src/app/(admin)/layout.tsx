import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Nav } from '@/components/Nav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Nav />
      <main style={{ padding: '32px' }}>{children}</main>
    </AuthGuard>
  );
}
