'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { authFetch, describeError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
}

interface CorporateAccount {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface BatchRow {
  id: string;
  corporateAccount: CorporateAccount;
  complex: { name: string };
  quantity: number;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
  redeemed: number;
  voided: number;
  remaining: number;
}

interface Voucher {
  id: string;
  status: 'ISSUED' | 'REDEEMED' | 'VOID';
  qrToken: string;
  redeemedAt: string | null;
  redeemedTicket: {
    showtime: { movie: { title: string }; startsAt: string };
    seat: { row: string; number: number };
  } | null;
}

const POLL_MS = 15_000;

function QrCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, value, { width: 140, margin: 1 }).catch(() => undefined);
  }, [value]);
  return <canvas ref={canvasRef} />;
}

export default function CorporatePage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAccounts = () =>
    authFetch<CorporateAccount[]>('/corporate/accounts')
      .then(setAccounts)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar las empresas')));

  const loadBatches = () =>
    authFetch<BatchRow[]>('/corporate/batches')
      .then(setBatches)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los lotes')));

  useEffect(() => {
    authFetch<Complex[]>('/complexes')
      .then((data) => {
        setComplexes(data);
        if (data[0]) setBatchForm((f) => ({ ...f, complexId: data[0].id }));
      })
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los complejos')));
    loadAccounts();
    loadBatches();

    // Burn-down "en tiempo real": se refresca por polling — no hay infraestructura de
    // websockets/push en Vercel serverless, así que el cajero simplemente ve el avance
    // actualizarse cada pocos segundos en vez de tener que recargar la página a mano.
    const interval = setInterval(loadBatches, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Empresas ---
  const [accountForm, setAccountForm] = useState({ name: '', contactName: '', contactEmail: '', contactPhone: '' });
  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await authFetch('/corporate/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: accountForm.name,
          contactName: accountForm.contactName || undefined,
          contactEmail: accountForm.contactEmail || undefined,
          contactPhone: accountForm.contactPhone || undefined,
        }),
      });
      setAccountForm({ name: '', contactName: '', contactEmail: '', contactPhone: '' });
      loadAccounts();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear la empresa'));
    }
  };

  // --- Lotes ---
  const [batchForm, setBatchForm] = useState({ corporateAccountId: '', complexId: '', quantity: '10', note: '', expiresAt: '' });
  const handleCreateBatch = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!batchForm.corporateAccountId) {
      setError('Elige una empresa');
      return;
    }
    try {
      await authFetch('/corporate/batches', {
        method: 'POST',
        body: JSON.stringify({
          corporateAccountId: batchForm.corporateAccountId,
          complexId: batchForm.complexId,
          quantity: Number(batchForm.quantity),
          note: batchForm.note || undefined,
          expiresAt: batchForm.expiresAt ? new Date(batchForm.expiresAt).toISOString() : undefined,
        }),
      });
      setMessage(`Lote de ${batchForm.quantity} boletos creado.`);
      setBatchForm((f) => ({ ...f, quantity: '10', note: '', expiresAt: '' }));
      loadBatches();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear el lote'));
    }
  };

  // --- Vouchers de un lote ---
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const viewVouchers = (batchId: string) => {
    setOpenBatchId(batchId);
    authFetch<Voucher[]>(`/corporate/batches/${batchId}/vouchers`)
      .then(setVouchers)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los vouchers')));
  };

  const handleVoid = async (voucherId: string) => {
    setError(null);
    try {
      await authFetch(`/corporate/vouchers/${voucherId}/void`, { method: 'POST' });
      if (openBatchId) viewVouchers(openBatchId);
      loadBatches();
    } catch (err) {
      setError(describeError(err, 'No se pudo anular el voucher'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Corporativo B2B</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Lotes de boletos de cortesía para empresas — cada voucher se canjea en taquilla por un boleto real (el
          empleado elige función y butaca al canjear). El avance se actualiza automáticamente cada 15 segundos.
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: 13, color: 'var(--success-150)' }}>{message}</p>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Empresas</h2>
        <form onSubmit={handleCreateAccount} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre de la empresa"
            required
            value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
          />
          <input
            placeholder="Contacto (opcional)"
            value={accountForm.contactName}
            onChange={(e) => setAccountForm({ ...accountForm, contactName: e.target.value })}
          />
          <input
            placeholder="Email (opcional)"
            value={accountForm.contactEmail}
            onChange={(e) => setAccountForm({ ...accountForm, contactEmail: e.target.value })}
          />
          <input
            placeholder="Teléfono (opcional)"
            value={accountForm.contactPhone}
            onChange={(e) => setAccountForm({ ...accountForm, contactPhone: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Registrar empresa
          </button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {accounts.map((a) => (
            <span key={a.id} className="badge">
              {a.name}
            </span>
          ))}
          {accounts.length === 0 && <span style={{ color: 'var(--black-60)' }}>Todavía no hay empresas registradas.</span>}
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Nuevo lote de boletos</h2>
        <form onSubmit={handleCreateBatch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={batchForm.corporateAccountId}
            onChange={(e) => setBatchForm({ ...batchForm, corporateAccountId: e.target.value })}
          >
            <option value="">Empresa…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select value={batchForm.complexId} onChange={(e) => setBatchForm({ ...batchForm, complexId: e.target.value })}>
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={10000}
            placeholder="Cantidad de boletos"
            required
            value={batchForm.quantity}
            onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
            style={{ width: 140 }}
          />
          <input
            placeholder="Nota (ej. Aniversario 2026)"
            value={batchForm.note}
            onChange={(e) => setBatchForm({ ...batchForm, note: e.target.value })}
          />
          <input
            type="datetime-local"
            title="Vence el (opcional)"
            value={batchForm.expiresAt}
            onChange={(e) => setBatchForm({ ...batchForm, expiresAt: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Generar lote
          </button>
        </form>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Lotes y avance de canje</h2>
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Complejo</th>
              <th>Nota</th>
              <th>Avance</th>
              <th>Vence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.corporateAccount.name}</td>
                <td>{b.complex.name}</td>
                <td>{b.note ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--black-10)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(b.redeemed / b.quantity) * 100}%`,
                          background: 'var(--success-150)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--black-60)' }}>
                      {b.redeemed} canjeados · {b.voided} anulados · {b.remaining} disponibles de {b.quantity}
                    </span>
                  </div>
                </td>
                <td>{b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('es-HN') : 'Sin límite'}</td>
                <td>
                  <button className="btn-secondary" onClick={() => viewVouchers(b.id)}>
                    Ver vouchers
                  </button>
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay lotes creados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {openBatchId && (
          <div style={{ borderTop: '1px solid var(--black-10)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Vouchers del lote</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {vouchers.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: 10,
                    border: '1px solid var(--black-10)',
                    borderRadius: 'var(--radius-sm)',
                    opacity: v.status === 'VOID' ? 0.5 : 1,
                  }}
                >
                  {v.status === 'ISSUED' ? (
                    <QrCanvas value={v.qrToken} />
                  ) : (
                    <div style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="badge" style={v.status === 'REDEEMED' ? { background: 'var(--success-10)', color: 'var(--success-150)' } : undefined}>
                        {v.status === 'REDEEMED' ? 'Canjeado' : 'Anulado'}
                      </span>
                    </div>
                  )}
                  {v.redeemedTicket && (
                    <span style={{ fontSize: 11, color: 'var(--black-60)', textAlign: 'center' }}>
                      {v.redeemedTicket.showtime.movie.title} — {v.redeemedTicket.seat.row}
                      {v.redeemedTicket.seat.number}
                    </span>
                  )}
                  {v.status === 'ISSUED' && (
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => handleVoid(v.id)}>
                      Anular
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
