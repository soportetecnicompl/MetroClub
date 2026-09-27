'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { authFetch, describeError } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  stamps: number;
  points: number;
  birthDate: string | null;
  lastVisitAt: string | null;
  createdAt: string;
}

interface Visit {
  id: string;
  createdAt: string;
  stampsEarned: number;
  pointsEarned: number;
  amountSpent: string | null;
  channel: string;
  complex: { id: string; name: string } | null;
}

interface Redemption {
  id: string;
  createdAt: string;
  redeemedAt: string | null;
  status: string;
  reward: { id: string; name: string; monetaryValue: string | null };
  complex: { id: string; name: string } | null;
}

interface History {
  visits: Visit[];
  redemptions: Redemption[];
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<Client>(`/clients/${params.id}`)
      .then(setClient)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el cliente')));
    authFetch<History>(`/clients/${params.id}/history`)
      .then(setHistory)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el historial del cliente')));
  }, [params.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Link href="/clients" style={{ fontSize: 13, color: 'var(--blue-100)', fontWeight: 600 }}>
          ← Volver a clientes
        </Link>
        <h1>{client?.name ?? 'Cliente'}</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {client && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker" style={{ color: 'var(--black-60)' }}>WhatsApp</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{client.whatsapp}</span>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker" style={{ color: 'var(--black-60)' }}>Sellos</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{client.stamps}</span>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker" style={{ color: 'var(--black-60)' }}>Puntos</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{client.points}</span>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker" style={{ color: 'var(--black-60)' }}>Cliente desde</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {new Date(client.createdAt).toLocaleDateString('es-HN')}
            </span>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker" style={{ color: 'var(--black-60)' }}>Última visita</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {client.lastVisitAt ? new Date(client.lastVisitAt).toLocaleDateString('es-HN') : '—'}
            </span>
          </div>
        </div>
      )}

      <a
        href={`/mi-tarjeta/${params.id}`}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13, color: 'var(--blue-100)', fontWeight: 600 }}
      >
        Ver tarjeta digital del cliente ↗
      </a>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Historial de visitas</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Complejo</th>
              <th>Canal</th>
              <th>Sellos ganados</th>
              <th>Puntos ganados</th>
              <th>Monto gastado</th>
            </tr>
          </thead>
          <tbody>
            {(history?.visits ?? []).map((visit) => (
              <tr key={visit.id}>
                <td>{new Date(visit.createdAt).toLocaleString('es-HN')}</td>
                <td>{visit.complex?.name ?? '—'}</td>
                <td>{visit.channel}</td>
                <td>+{visit.stampsEarned}</td>
                <td>+{visit.pointsEarned}</td>
                <td>{visit.amountSpent ? `L. ${Number(visit.amountSpent).toFixed(2)}` : '—'}</td>
              </tr>
            ))}
            {history && history.visits.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--black-60)' }}>
                  Este cliente todavía no tiene visitas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Historial de canjes</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Premio</th>
              <th>Valor</th>
              <th>Complejo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(history?.redemptions ?? []).map((redemption) => (
              <tr key={redemption.id}>
                <td>{new Date(redemption.redeemedAt ?? redemption.createdAt).toLocaleString('es-HN')}</td>
                <td>{redemption.reward?.name ?? '—'}</td>
                <td>
                  {redemption.reward?.monetaryValue ? `L. ${Number(redemption.reward.monetaryValue).toFixed(2)}` : '—'}
                </td>
                <td>{redemption.complex?.name ?? '—'}</td>
                <td>
                  <span className="badge">{redemption.status}</span>
                </td>
              </tr>
            ))}
            {history && history.redemptions.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--black-60)' }}>
                  Este cliente todavía no ha canjeado premios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
