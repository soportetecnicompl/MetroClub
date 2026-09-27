'use client';

import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

interface EnrolledClient {
  id: string;
  name: string;
}

interface CardData {
  googleWalletSaveUrl: string | null;
}

export default function JoinPage() {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<EnrolledClient | null>(null);
  const [walletUrl, setWalletUrl] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const enrolled = await apiFetch<EnrolledClient>('/public/clients/enroll', {
        method: 'POST',
        body: JSON.stringify({ name, whatsapp }),
      });
      setClient(enrolled);
      const card = await apiFetch<CardData>(`/public/clients/${enrolled.id}/card`);
      setWalletUrl(card.googleWalletSaveUrl);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? 'Demasiados intentos — espera un minuto e intenta de nuevo.'
            : err.message
          : 'No se pudo completar el registro. Intenta de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (client) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker">¡Listo!</span>
            <h1>Bienvenido a MetroClub, {client.name.split(' ')[0]}</h1>
            <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
              Agrega tu tarjeta a Wallet para empezar a acumular sellos en cada visita.
            </span>
          </div>

          {walletUrl ? (
            <a href={walletUrl} target="_blank" rel="noreferrer" className="btn-primary" style={{ textAlign: 'center' }}>
              Agregar a Google Wallet
            </a>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
              Tu tarjeta se está generando — muéstrale este nombre al personal en taquilla para tu primera visita.
            </span>
          )}

          <a
            href={`/mi-tarjeta/${client.id}`}
            style={{ fontSize: 13, textAlign: 'center', color: 'var(--blue-100)', fontWeight: 600 }}
          >
            Ver mi tarjeta digital ↗
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Únete gratis</span>
          <h1>MetroClub</h1>
          <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
            Regístrate con tu nombre y WhatsApp para empezar a acumular sellos y puntos en cada visita.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            placeholder="Nombre completo"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="WhatsApp (con código de país, ej. +504...)"
            required
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Registrando…' : 'Unirme a MetroClub'}
          </button>
        </form>
      </div>
    </main>
  );
}
