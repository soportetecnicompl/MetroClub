'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';

interface LoginResponse {
  accessToken: string;
  user: SessionUser;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(accessToken, user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 340 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            <span className="kicker">Metrocinemas</span>
            <h1>MetroClub Admin</h1>
            <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
              Panel de administración del programa de fidelización (RF-16)
            </span>
          </div>
          <label>
            Correo
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>

      <div
        style={{
          flex: 1,
          background: 'linear-gradient(to right, #0a1631, #fba701)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        <div style={{ maxWidth: 380, color: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 28, fontWeight: 400, color: '#fff' }}>
            Un solo panel para todos los complejos
          </h2>
          <span style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.5 }}>
            Gestiona reglas de lealtad, complejos, plantillas de WhatsApp y métricas de retención desde un mismo
            lugar (NFR-05).
          </span>
        </div>
      </div>
    </main>
  );
}
