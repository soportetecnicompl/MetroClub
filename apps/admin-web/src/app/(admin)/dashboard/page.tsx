'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch, describeError } from '@/lib/api';
import { getToken } from '@/lib/auth';

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
  topRewards: TopReward[];
  totalRedemptionCost: number;
  pointsOutstanding: number;
  stampsOutstanding: number;
  clientsBySegment: ClientsBySegment;
  redemptionRate: number;
  lifetimeRevenue: number;
}

interface TrendPoint {
  month: string;
  newClients: number;
  visits: number;
  revenue: number;
  redemptions: number;
  redemptionCost: number;
  costToRevenuePercent: number | null;
  monthlyRetentionRate: number | null;
  clientsBySegment: ClientsBySegment;
}

interface ComplexComparisonRow {
  complexId: string;
  name: string;
  city: string;
  visits: number;
  distinctClients: number;
  revenue: number;
  avgSpendPerVisit: number;
  redemptions: number;
  redemptionCost: number;
  retentionRate: number;
}

interface Alert {
  level: 'warning' | 'success' | 'info';
  title: string;
  detail: string;
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

const ALERT_STYLES: Record<Alert['level'], { background: string; color: string; icon: string }> = {
  warning: { background: '#fff3cd', color: '#8a6d1a', icon: '⚠️' },
  success: { background: 'var(--success-10)', color: 'var(--success-150)', icon: '✅' },
  info: { background: 'var(--info-10)', color: 'var(--info-150)', icon: 'ℹ️' },
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[] | null>(null);
  const [complexes, setComplexes] = useState<ComplexComparisonRow[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<DashboardSummary>('/reports/dashboard')
      .then(setSummary)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el dashboard')));
    authFetch<{ points: TrendPoint[] }>('/reports/trends?months=6')
      .then((res) => setTrends(res.points))
      .catch((err) => setError(describeError(err, 'No se pudo cargar la tendencia')));
    authFetch<ComplexComparisonRow[]>('/reports/complexes-comparison')
      .then(setComplexes)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la comparación de complejos')));
    authFetch<{ alerts: Alert[] }>('/reports/alerts')
      .then((res) => setAlerts(res.alerts))
      .catch(() => setAlerts([]));
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

  const maxTrendValue = trends ? Math.max(1, ...trends.map((p) => Math.max(p.revenue, p.redemptionCost))) : 1;

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

      {alerts && alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map((alert, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: ALERT_STYLES[alert.level].background,
                color: ALERT_STYLES[alert.level].color,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {ALERT_STYLES[alert.level].icon} {alert.title}
              </span>
              <span style={{ fontSize: 13 }}>{alert.detail}</span>
            </div>
          ))}
        </div>
      )}

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
          <span style={{ fontSize: 16, fontWeight: 600 }}>Tendencia (últimos 6 meses)</span>
          <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
            Ingresos (azul) vs. costo en premios (rojo) — para ver si el programa mejora o empeora mes a mes, no solo
            cómo está hoy.
          </span>
        </div>

        {trends && trends.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, padding: '0 4px' }}>
            {trends.map((p) => (
              <div key={p.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                  <div
                    title={`Ingresos: L. ${p.revenue.toFixed(2)}`}
                    style={{
                      width: 14,
                      height: `${Math.max(2, (p.revenue / maxTrendValue) * 100)}%`,
                      background: 'var(--blue-100, #2563eb)',
                      borderRadius: 3,
                    }}
                  />
                  <div
                    title={`Costo en premios: L. ${p.redemptionCost.toFixed(2)}`}
                    style={{
                      width: 14,
                      height: `${Math.max(2, (p.redemptionCost / maxTrendValue) * 100)}%`,
                      background: '#a01e1e',
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--black-60)' }}>{p.month}</span>
              </div>
            ))}
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Clientes nuevos</th>
              <th>Visitas</th>
              <th>Ingresos</th>
              <th>Costo premios</th>
              <th>Costo/ingresos</th>
              <th>Retención mensual</th>
            </tr>
          </thead>
          <tbody>
            {(trends ?? []).map((p) => (
              <tr key={p.month}>
                <td>{p.month}</td>
                <td>{p.newClients}</td>
                <td>{p.visits}</td>
                <td>L. {p.revenue.toFixed(2)}</td>
                <td>L. {p.redemptionCost.toFixed(2)}</td>
                <td>{p.costToRevenuePercent != null ? `${p.costToRevenuePercent}%` : '—'}</td>
                <td>{p.monthlyRetentionRate != null ? `${p.monthlyRetentionRate}%` : '—'}</td>
              </tr>
            ))}
            {trends && trends.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay historia suficiente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Comparación entre complejos</span>
          <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
            No solo cuál tiene más tráfico — cuál realmente retiene y genera más por visita.
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Complejo</th>
              <th>Visitas</th>
              <th>Clientes distintos</th>
              <th>Ingresos</th>
              <th>Gasto prom./visita</th>
              <th>Canjes</th>
              <th>Costo premios</th>
              <th>Retención</th>
            </tr>
          </thead>
          <tbody>
            {(complexes ?? []).map((c) => (
              <tr key={c.complexId}>
                <td>
                  {c.name}
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--black-60)' }}>{c.city}</span>
                </td>
                <td>{c.visits}</td>
                <td>{c.distinctClients}</td>
                <td>L. {c.revenue.toFixed(2)}</td>
                <td>L. {c.avgSpendPerVisit.toFixed(2)}</td>
                <td>{c.redemptions}</td>
                <td>L. {c.redemptionCost.toFixed(2)}</td>
                <td>{c.retentionRate}%</td>
              </tr>
            ))}
            {complexes && complexes.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--black-60)' }}>
                  No hay complejos activos configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
