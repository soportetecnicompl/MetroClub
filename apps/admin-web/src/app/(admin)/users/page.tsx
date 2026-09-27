'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, ApiError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
  city: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  complexId: string | null;
  isActive: boolean;
}

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super-admin' },
  { value: 'CENTRAL_ADMIN', label: 'Admin central' },
  { value: 'COMPLEX_ADMIN', label: 'Admin de complejo' },
  { value: 'STAFF', label: 'Staff (taquilla/confitería)' },
];

const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

const ROLE_PERMISSIONS: { role: string; label: string; permissions: string[] }[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super-admin',
    permissions: [
      'Acceso total al panel y a todos los complejos',
      'Gestiona usuarios y roles, reglas de lealtad, premios y plantillas de WhatsApp',
      'Configuración técnica y soporte',
    ],
  },
  {
    role: 'CENTRAL_ADMIN',
    label: 'Admin central',
    permissions: [
      'Ve el dashboard y reportes de todos los complejos',
      'Gestiona usuarios, complejos, reglas de lealtad, premios, campañas y plantillas de WhatsApp',
    ],
  },
  {
    role: 'COMPLEX_ADMIN',
    label: 'Admin de complejo',
    permissions: [
      'Ve el dashboard filtrado a su complejo',
      'Usa el modo staff (enrolamiento, sellado y canje de premios)',
      'No puede crear usuarios, reglas ni plantillas',
    ],
  },
  {
    role: 'STAFF',
    label: 'Staff (taquilla/confitería)',
    permissions: ['Usa el modo staff (enrolamiento, sellado y canje de premios)', 'Sin acceso a configuración ni reportes'],
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES[3].value,
    complexId: '',
  });

  const loadUsers = () => authFetch<User[]>('/users').then(setUsers).catch(() => undefined);

  useEffect(() => {
    loadUsers();
    authFetch<Complex[]>('/complexes').then(setComplexes).catch(() => undefined);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, complexId: form.complexId || undefined }),
      });
      setForm({ name: '', email: '', password: '', role: ROLES[3].value, complexId: '' });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const patchUser = async (id: string, data: { role?: string; complexId?: string; isActive?: boolean }) => {
    try {
      await authFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el usuario');
    }
  };

  const toggleActive = (user: User) => patchUser(user.id, { isActive: !user.isActive });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Usuarios y roles</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Gestiona quién accede al panel: super-admin, admin central, admin de complejo y staff de taquilla/confitería
          (RF-16, RF-18).
        </span>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Nuevo usuario</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="email"
            placeholder="Correo"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Contraseña"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <select value={form.complexId} onChange={(e) => setForm({ ...form, complexId: e.target.value })}>
            <option value="">Sin complejo (central)</option>
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Complejo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <select value={user.role} onChange={(e) => patchUser(user.id, { role: e.target.value })}>
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={user.complexId ?? ''}
                    onChange={(e) => patchUser(user.id, { complexId: e.target.value || undefined })}
                  >
                    <option value="">Sin complejo (central)</option>
                    {complexes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span
                    className="badge"
                    style={
                      user.isActive
                        ? { background: 'var(--success-10)', color: 'var(--success-150)' }
                        : { background: 'var(--black-10)', color: 'var(--black-40)' }
                    }
                  >
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => toggleActive(user)}>
                    {user.isActive ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Roles y permisos</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {ROLE_PERMISSIONS.map((entry) => (
            <div
              key={entry.role}
              style={{
                border: '1px solid var(--black-10)',
                borderRadius: 'var(--radius-sm)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span className="badge" style={{ alignSelf: 'flex-start' }}>
                {entry.label}
              </span>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--black-60)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entry.permissions.map((permission) => (
                  <li key={permission}>{permission}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
