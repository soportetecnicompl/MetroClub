'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getUser } from '@/lib/auth';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/staff', label: 'Staff' },
  { href: '/box-office', label: 'Taquilla' },
  { href: '/sales', label: 'Ventas' },
  { href: '/catalog', label: 'Cartelera' },
  { href: '/promotions', label: 'Promociones' },
  { href: '/inventory', label: 'Confitería' },
  { href: '/corporate', label: 'Corporativo B2B' },
  { href: '/clients', label: 'Clientes' },
  { href: '/redemptions', label: 'Canjes' },
  { href: '/roi', label: 'ROI de premios' },
  { href: '/complexes', label: 'Complejos' },
  { href: '/loyalty', label: 'Lealtad' },
  { href: '/templates', label: 'Plantillas WhatsApp' },
  { href: '/users', label: 'Usuarios y roles' },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const user = getUser();

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <nav className="navbar">
      <strong style={{ fontSize: 16 }}>MetroClub Admin</strong>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={`navlink${pathname === link.href ? ' active' : ''}`}>
          {link.label}
        </Link>
      ))}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && <span style={{ fontSize: 14, color: 'var(--black-60)' }}>{user.name}</span>}
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px' }}>
          Cerrar sesión
        </button>
      </span>
    </nav>
  );
}
