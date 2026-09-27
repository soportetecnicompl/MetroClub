'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, ApiError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
  city: string;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  stamps: number;
  points: number;
}

interface Reward {
  id: string;
  name: string;
  stampsCost: number | null;
  pointsCost: number | null;
}

type Step = 'lookup' | 'enroll' | 'visit';

export default function StaffPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complexId, setComplexId] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [whatsapp, setWhatsapp] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [consent, setConsent] = useState(false);

  const [client, setClient] = useState<Client | null>(null);
  const [amountSpent, setAmountSpent] = useState('');
  const [visitMessage, setVisitMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch<Complex[]>('/complexes')
      .then((data) => {
        setComplexes(data);
        if (data[0]) setComplexId(data[0].id);
      })
      .catch(() => undefined);
    authFetch<Reward[]>('/loyalty/rewards').then(setRewards).catch(() => undefined);
  }, []);

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const found = await authFetch<Client | null>(`/clients/lookup?whatsapp=${encodeURIComponent(whatsapp)}`);
      if (found) {
        setClient(found);
        setStep('visit');
      } else {
        setStep('enroll');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo buscar al cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await authFetch<Client>('/clients/enroll', {
        method: 'POST',
        body: JSON.stringify({ name, whatsapp, birthDate: birthDate || undefined }),
      });
      setClient(created);
      setStep('visit');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enrolar al cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVisit = async () => {
    if (!client) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await authFetch<Client>(`/clients/${client.id}/visits`, {
        method: 'POST',
        body: JSON.stringify({ complexId, amountSpent: amountSpent ? Number(amountSpent) : undefined }),
      });
      setClient(updated);
      setVisitMessage('+1 sello agregado. Wallet pass actualizado en tiempo real (RF-05).');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la visita');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (rewardId: string) => {
    if (!client) return;
    setError(null);
    try {
      await authFetch('/loyalty/redemptions', {
        method: 'POST',
        body: JSON.stringify({ clientId: client.id, rewardId, complexId }),
      });
      setVisitMessage('Premio canjeado correctamente.');
      const refreshed = await authFetch<Client | null>(`/clients/lookup?whatsapp=${encodeURIComponent(client.whatsapp)}`);
      if (refreshed) setClient(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo canjear el premio');
    }
  };

  const reset = () => {
    setStep('lookup');
    setClient(null);
    setWhatsapp('');
    setName('');
    setBirthDate('');
    setConsent(false);
    setAmountSpent('');
    setVisitMessage(null);
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 420 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="kicker">Modo staff · RF-01 a RF-05</span>
        <h1>Enrolamiento y sellado</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {step === 'lookup' && (
        <form onSubmit={handleLookup} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
              padding: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 100,
                background: 'var(--blue-10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📶
            </div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Acerca el chip NFC, o busca por WhatsApp</span>
          </div>
          <label>
            WhatsApp del cliente
            <input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+504 9999-9999" />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar cliente'}
          </button>
        </form>
      )}

      {step === 'enroll' && (
        <form onSubmit={handleEnroll} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
            Cliente no encontrado — es su primera visita. Completa sus datos para crear su MetroClub.
          </span>
          <label>
            Nombre completo
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ana Martínez" />
          </label>
          <label>
            WhatsApp
            <input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </label>
          <label>
            Fecha de cumpleaños (opcional)
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2 }}
            />
            <span style={{ fontWeight: 400, color: 'var(--black-60)' }}>
              El cliente autoriza recibir mensajes de WhatsApp de Metrocinemas y acepta el tratamiento de sus datos
              (consentimiento explícito, RF-02).
            </span>
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando…' : 'Crear tarjeta MetroClub'}
          </button>
        </form>
      )}

      {step === 'visit' && client && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{client.name}</span>
              <span style={{ fontSize: 12, color: 'var(--black-60)' }}>{client.whatsapp}</span>
            </div>
            <span className="badge">Sin datos que pedir</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: 'var(--background-page)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>Sellos / puntos actuales</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {client.stamps} sellos · {client.points} pts
            </span>
          </div>

          {visitMessage && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 100,
                  background: 'var(--success-150)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: 14, color: 'var(--black-60)' }}>{visitMessage}</span>
            </div>
          )}

          <label>
            Complejo
            <select value={complexId} onChange={(e) => setComplexId(e.target.value)}>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.city}
                </option>
              ))}
            </select>
          </label>

          <label>
            Gasto en confitería (opcional, para puntos RF-07)
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="L. 0.00"
              value={amountSpent}
              onChange={(e) => setAmountSpent(e.target.value)}
            />
          </label>

          <button className="btn-primary" onClick={handleConfirmVisit} disabled={loading || !complexId}>
            {loading ? 'Confirmando…' : 'Confirmar visita'}
          </button>

          {rewards.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Canjear premio</span>
              {rewards.map((reward) => (
                <button key={reward.id} className="btn-secondary" onClick={() => handleRedeem(reward.id)}>
                  {reward.name} ({reward.stampsCost ? `${reward.stampsCost} sellos` : `${reward.pointsCost} pts`})
                </button>
              ))}
            </div>
          )}

          <a
            href={`/mi-tarjeta/${client.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, textAlign: 'center', color: 'var(--blue-100)', fontWeight: 600 }}
          >
            Ver tarjeta digital del cliente ↗
          </a>

          <button className="btn-secondary" onClick={reset}>
            Buscar otro cliente
          </button>
        </div>
      )}
    </div>
  );
}
