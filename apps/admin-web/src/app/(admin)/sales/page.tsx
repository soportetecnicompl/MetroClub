'use client';

import { useEffect, useState } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
}

interface TicketRow {
  id: string;
  price: string;
  discountApplied: string;
  channel: string;
  status: string;
  createdAt: string;
  showtime: { movie: { title: string }; screen: { name: string }; format: string };
  seat: { row: string; number: number };
  client: { name: string } | null;
  promotion: { name: string } | null;
}

interface ConcessionSaleRow {
  id: string;
  subtotal: string;
  discountApplied: string;
  total: string;
  channel: string;
  createdAt: string;
  client: { name: string } | null;
  items: { quantity: number; unitPrice: string; product: { name: string } }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  BOX_OFFICE: 'Taquilla',
  ONLINE: 'En línea',
  CORPORATE: 'Corporativo',
};

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  USED: { background: 'var(--success-10)', color: 'var(--success-150)' },
  CANCELLED: { background: '#fddede', color: '#a01e1e' },
};

export default function SalesPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complexId, setComplexId] = useState('');
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [concessionSales, setConcessionSales] = useState<ConcessionSaleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<Complex[]>('/complexes')
      .then((data) => {
        setComplexes(data);
        if (data[0]) setComplexId(data[0].id);
      })
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los complejos')));
  }, []);

  useEffect(() => {
    if (!complexId) return;
    authFetch<TicketRow[]>(`/ticketing/tickets?complexId=${complexId}`)
      .then(setTickets)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los boletos vendidos')));
    authFetch<ConcessionSaleRow[]>(`/concessions/sales?complexId=${complexId}`)
      .then(setConcessionSales)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar las ventas de confitería')));
  }, [complexId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Ventas realizadas</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Últimos 100 boletos y ventas de confitería de este complejo, más recientes primero.
        </span>
      </div>

      <div className="card" style={{ display: 'flex', gap: 8 }}>
        <select value={complexId} onChange={(e) => setComplexId(e.target.value)}>
          {complexes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Boletos</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Película</th>
              <th>Sala/Butaca</th>
              <th>Canal</th>
              <th>Cliente</th>
              <th>Precio</th>
              <th>Descuento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(tickets ?? []).map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.createdAt).toLocaleString('es-HN')}</td>
                <td>
                  {t.showtime.movie.title}
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--black-60)' }}>{t.showtime.format}</span>
                </td>
                <td>
                  {t.showtime.screen.name} — {t.seat.row}
                  {t.seat.number}
                </td>
                <td>{CHANNEL_LABELS[t.channel] ?? t.channel}</td>
                <td>{t.client?.name ?? '—'}</td>
                <td>L. {Number(t.price).toFixed(2)}</td>
                <td>
                  {Number(t.discountApplied) > 0 ? (
                    <span style={{ color: 'var(--success-150)' }}>
                      L. {Number(t.discountApplied).toFixed(2)}
                      {t.promotion && ` (${t.promotion.name})`}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span className="badge" style={STATUS_STYLES[t.status]}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {tickets && tickets.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay boletos vendidos para este complejo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Confitería</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Productos</th>
              <th>Canal</th>
              <th>Cliente</th>
              <th>Subtotal</th>
              <th>Descuento</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(concessionSales ?? []).map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.createdAt).toLocaleString('es-HN')}</td>
                <td>{s.items.map((item) => `${item.quantity} × ${item.product.name}`).join(', ')}</td>
                <td>{CHANNEL_LABELS[s.channel] ?? s.channel}</td>
                <td>{s.client?.name ?? '—'}</td>
                <td>L. {Number(s.subtotal).toFixed(2)}</td>
                <td>
                  {Number(s.discountApplied) > 0 ? (
                    <span style={{ color: 'var(--success-150)' }}>L. {Number(s.discountApplied).toFixed(2)}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>L. {Number(s.total).toFixed(2)}</td>
              </tr>
            ))}
            {concessionSales && concessionSales.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay ventas de confitería para este complejo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
