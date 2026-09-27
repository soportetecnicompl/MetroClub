'use client';

import { useEffect, useState } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface RewardRoi {
  rewardId: string;
  name: string;
  isActive: boolean;
  stampsCost: number | null;
  pointsCost: number | null;
  currentUnitCost: number;
  timesRedeemed: number;
  totalCost: number;
  costSharePercent: number;
}

interface RoiSummary {
  rewards: RewardRoi[];
  totalCost: number;
  totalRevenue: number;
  costToRevenuePercent: number | null;
  avgSpendRedeemers: number;
  avgSpendNonRedeemers: number;
  redeemersCount: number;
  nonRedeemersCount: number;
  spendLift: number;
}

export default function RoiPage() {
  const [summary, setSummary] = useState<RoiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<RoiSummary>('/reports/rewards-roi')
      .then(setSummary)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el análisis de ROI')));
  }, []);

  const liftIsPositive = summary ? summary.spendLift >= 0 : true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>ROI de premios</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Cuánto cuesta el programa en premios canjeados vs. cuánto genera la base de clientes, y si a quienes canjean
          realmente les compensa venir más / gastar más.
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Costo total en premios (L.)</span>
              <span style={{ fontSize: 28, fontWeight: 600 }}>L. {summary.totalCost.toFixed(2)}</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Ingresos totales de la base (L.)</span>
              <span style={{ fontSize: 28, fontWeight: 600 }}>L. {summary.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Costo como % de ingresos</span>
              <span style={{ fontSize: 28, fontWeight: 600 }}>
                {summary.costToRevenuePercent != null ? `${summary.costToRevenuePercent}%` : '—'}
              </span>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>¿El programa cambia el comportamiento?</span>
              <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
                Gasto promedio de quienes han canjeado al menos un premio vs. quienes nunca han canjeado.
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="kicker" style={{ color: 'var(--black-60)' }}>
                  Gastan (canjean) — {summary.redeemersCount} cliente{summary.redeemersCount === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: 22, fontWeight: 600 }}>L. {summary.avgSpendRedeemers.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="kicker" style={{ color: 'var(--black-60)' }}>
                  Gastan (no canjean) — {summary.nonRedeemersCount} cliente{summary.nonRedeemersCount === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: 22, fontWeight: 600 }}>L. {summary.avgSpendNonRedeemers.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="kicker" style={{ color: 'var(--black-60)' }}>Diferencia (lift)</span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: liftIsPositive ? 'var(--success-150)' : '#a01e1e',
                  }}
                >
                  {liftIsPositive ? '+' : ''}
                  L. {summary.spendLift.toFixed(2)}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
              {liftIsPositive
                ? 'Quienes canjean premios gastan más en promedio — el programa sí está incentivando más consumo.'
                : 'Quienes canjean premios gastan igual o menos que quienes no — el programa hoy es principalmente costo, sin efecto claro de retención.'}
            </span>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Costo por premio</span>
              <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
                &quot;Costo total&quot; es lo que REALMENTE se pagó en cada canje, no el precio actual × cantidad — si
                editaste el precio de un premio, los canjes de antes no cambian.
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Premio</th>
                  <th>Precio actual</th>
                  <th>Veces canjeado</th>
                  <th>Costo total (real)</th>
                  <th>% del costo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {summary.rewards.map((reward) => (
                  <tr key={reward.rewardId}>
                    <td>{reward.name}</td>
                    <td>L. {reward.currentUnitCost.toFixed(2)}</td>
                    <td>{reward.timesRedeemed}</td>
                    <td>L. {reward.totalCost.toFixed(2)}</td>
                    <td>{reward.costSharePercent}%</td>
                    <td>
                      <span
                        className="badge"
                        style={
                          reward.isActive
                            ? { background: 'var(--success-10)', color: 'var(--success-150)' }
                            : { background: 'var(--black-10)', color: 'var(--black-40)' }
                        }
                      >
                        {reward.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
                {summary.rewards.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: 'var(--black-60)' }}>
                      Todavía no hay premios configurados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
