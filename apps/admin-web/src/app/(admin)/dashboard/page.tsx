'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch, describeError } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface TopComplex {
  complexId: string;
  name: string;
  visits: number;
}

interface TopReward {
  rewardId: string;
  name: string;
  redemptions: number;
}

interface ClientsBySegment {
  active: number;
  at_risk: number;
  dormant: number;
  lost: number;
  never: number;
}

interface DashboardSummary {
  activeClients: number;
  totalVisits: number;
  totalRedemptions: number;
  reviewsRequested: number;
  newClientsThisMonth: number;
  retentionRate: number;
  avgVisitsPerClient: number;
  topComplexes: TopComplex[];
  topRewards: TopReward[];
  totalRedemptionCost: number;
  pointsOutstanding: number;
  stampsOutstanding: number;
  clientsBySegment: ClientsBySegment;
  redemptionRate: number;
  lifetimeRevenue: number;
}

const TILES: { key: keyof DashboardSummary; label: string; format?: (v: number) => string }[] = [
  { key: 'activeClients', label: 'Clientes activos' },
  { key: 'totalVisits', label: 'Visitas registradas' },
  { key: 'totalRedemptions', label: 'Premios canjeados' },
  { key: 'newClientsThisMonth', label: 'Clientes nuevos (mes)' },
  { key: 'retentionRate', label: 'Tasa de retorno', format: (v) => `${v}%` },
  { key: 'avgVisitsPerClient', label: 'Visitas promedio / cliente' },
  { key: 'redemptionRate', label: 'Tasa de canje', format: (v) => `${v}%` },
  { key: 'lifetimeRevenue', label: 'Ingresos de la base (L.)', format: (v) => `L. ${v.toFixed(2)}` },
  { key: 'totalRedemptionCost', label: 'Costo del programa (L.)', format: (v) => `L. ${v.toFixed(2)}` },
  { key: 'pointsOutstanding', label: 'Puntos sin canjear' },
  { key: 'stampsOutstanding', label: 'Sellos sin canjear' },
  { key: 'reviewsRequested', label: 'Reseñas solicitadas' },
];

const SEGMENT_TILES: { key: keyof ClientsBySegment; label: string; hint: string; color: string }[] = [
  { key: 'active', label: 'Activos', hint: '≤30 días — premiar/retener', color: 'var(--success-150)' },
  { key: 'at_risk', label: 'En riesgo', hint: '31-60 días — reactivar ya', color: '#8a6d1a' },
  { key: 'dormant', label: 'Dormidos', hint: '61-90 días — win-back', color: '#a04a00' },
  { key: 'lost', label: 'Perdidos', hint: '90+ días — campaña agresiva', color: '#a01e1e' },
  { key: 'never', label: 'Nunca visitaron', hint: 'se enrolaron pero no volvieron', color: 'var(--black-40)' },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<DashboardSummary>('/reports/dashboard')
      .then(setSummary)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el dashboard')));
  }, []);

  const handleExport = async () => {
    const token = getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
    const res = await fetch(`${apiUrl}/reports/clients/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clientes-metroclub.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--black-60)',
            background: 'var(--black-0)',
            boxShadow: 'var(--shadow-4)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          Todos los complejos ▾
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {TILES.map((tile) => {
          const raw = summary?.[tile.key];
          const value = typeof raw === 'number' ? (tile.format ? tile.format(raw) : raw) : '—';
          return (
            <div key={tile.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>
                {tile.label}
              </span>
              <span style={{ fontSize: 32, fontWeight: 600 }}>{value}</span>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Clientes por segmento de recencia</span>
          <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
            Clic en un segmento para ver esos clientes y enviarles una campaña de WhatsApp.
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {SEGMENT_TILES.map((tile) => (
            <Link
              key={tile.key}
              href={`/clients?segment=${tile.key}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 14,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--black-10)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: tile.color }}>{tile.label}</span>
              <span style={{ fontSize: 28, fontWeight: 600 }}>{summary?.clientsBySegment?.[tile.key] ?? '—'}</span>
              <span style={{ fontSize: 11, color: 'var(--black-60)' }}>{tile.hint}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Top complejos por visitas</span>
        <table>
          <thead>
            <tr>
              <th>Complejo</th>
              <th>Visitas</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.topComplexes ?? []).map((complex) => (
              <tr key={complex.complexId}>
                <td>{complex.name}</td>
                <td>{complex.visits}</td>
              </tr>
            ))}
            {summary && summary.topComplexes.length === 0 && (
              <tr>
                <td colSpan={2} style={{ color: 'var(--black-60)' }}>
                  Aún no hay visitas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Premios más canjeados</span>
        <table>
          <thead>
            <tr>
              <th>Premio</th>
              <th>Canjes</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.topRewards ?? []).map((reward) => (
              <tr key={reward.rewardId}>
                <td>{reward.name}</td>
                <td>{reward.redemptions}</td>
              </tr>
            ))}
            {summary && summary.topRewards.length === 0 && (
              <tr>
                <td colSpan={2} style={{ color: 'var(--black-60)' }}>
                  Aún no hay canjes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Base de clientes</span>
          <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
            Exporta el listado completo para reportes mensuales (RF-19)
          </span>
        </div>
        <button onClick={handleExport} className="btn-primary">
          Exportar CSV
        </button>
      </div>
    </div>
  );
}
