'use client';

import { useEffect, useState } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface RedemptionRow {
  id: string;
  createdAt: string;
  client: { id: string; name: string; whatsapp: string };
  reward: { id: string; name: string; stampsCost: number | null; pointsCost: number | null; monetaryValue: string | null };
  complex: { id: string; name: string } | null;
}

interface RedemptionsPage {
  data: RedemptionRow[];
  total: number;
  page: number;
  limit: number;
  totalCost: number;
}

export default function RedemptionsPage() {
  const [result, setResult] = useState<RedemptionsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    authFetch<RedemptionsPage>(`/reports/redemptions?${params.toString()}`)
      .then(setResult)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el historial de canjes')));
  }, [page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Canjes</h1>
      {error && <p className="error-text">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="kicker" style={{ color: 'var(--black-60)' }}>
            Premios canjeados
          </span>
          <span style={{ fontSize: 32, fontWeight: 600 }}>{result?.total ?? '—'}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="kicker" style={{ color: 'var(--black-60)' }}>
            Costo total del programa
          </span>
          <span style={{ fontSize: 32, fontWeight: 600 }}>
            {result ? `L. ${result.totalCost.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Premio</th>
              <th>Costo</th>
              <th>Valor (L.)</th>
              <th>Complejo</th>
            </tr>
          </thead>
          <tbody>
            {(result?.data ?? []).map((redemption) => (
              <tr key={redemption.id}>
                <td>{new Date(redemption.createdAt).toLocaleString('es-HN')}</td>
                <td>
                  {redemption.client?.name ?? '—'}
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--black-60)' }}>{redemption.client?.whatsapp ?? ''}</span>
                </td>
                <td>{redemption.reward?.name ?? '—'}</td>
                <td>
                  {redemption.reward?.stampsCost ? `${redemption.reward.stampsCost} sellos` : ''}
                  {redemption.reward?.stampsCost && redemption.reward?.pointsCost ? ' · ' : ''}
                  {redemption.reward?.pointsCost ? `${redemption.reward.pointsCost} pts` : ''}
                  {!redemption.reward?.stampsCost && !redemption.reward?.pointsCost ? '—' : ''}
                </td>
                <td>{redemption.reward?.monetaryValue ? `L. ${Number(redemption.reward.monetaryValue).toFixed(2)}` : '—'}</td>
                <td>{redemption.complex?.name ?? '—'}</td>
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--black-60)' }}>
                  Aún no hay canjes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {result && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
              {result.total} canje{result.total === 1 ? '' : 's'} · página {result.page} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
