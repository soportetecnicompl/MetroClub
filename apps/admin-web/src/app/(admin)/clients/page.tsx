'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authFetch, describeError } from '@/lib/api';

type Segment = 'active' | 'at_risk' | 'dormant' | 'lost' | 'never';

interface ClientRow {
  id: string;
  name: string;
  whatsapp: string;
  stamps: number;
  points: number;
  totalSpent: string;
  lastVisitAt: string | null;
  createdAt: string;
  segment: Segment;
  _count: { visits: number; redemptions: number };
}

interface ClientsPage {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
}

type SortBy = 'stamps' | 'points' | 'lastVisitAt' | 'createdAt' | 'totalSpent';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'lastVisitAt', label: 'Última visita' },
  { value: 'totalSpent', label: 'Gasto total' },
  { value: 'stamps', label: 'Sellos' },
  { value: 'points', label: 'Puntos' },
  { value: 'createdAt', label: 'Más nuevos' },
];

const SEGMENTS: { value: Segment; label: string; badge: { background: string; color: string } }[] = [
  { value: 'active', label: 'Activo (≤30 días)', badge: { background: 'var(--success-10)', color: 'var(--success-150)' } },
  { value: 'at_risk', label: 'En riesgo (31-60 días)', badge: { background: '#fff3cd', color: '#8a6d1a' } },
  { value: 'dormant', label: 'Dormido (61-90 días)', badge: { background: '#ffe0cc', color: '#a04a00' } },
  { value: 'lost', label: 'Perdido (90+ días)', badge: { background: '#fddede', color: '#a01e1e' } },
  { value: 'never', label: 'Nunca ha visitado', badge: { background: 'var(--black-10)', color: 'var(--black-40)' } },
];

const segmentInfo = (segment: Segment) => SEGMENTS.find((s) => s.value === segment) ?? SEGMENTS[4];

interface WhatsappTemplate {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsPageInner />
    </Suspense>
  );
}

function ClientsPageInner() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ClientsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('lastVisitAt');
  const [segment, setSegment] = useState<Segment | ''>(() => (searchParams.get('segment') as Segment | null) ?? '');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [sending, setSending] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);

  useEffect(() => {
    authFetch<WhatsappTemplate[]>('/whatsapp/templates').then(setTemplates).catch(() => undefined);
  }, []);

  const handleSendCampaign = async () => {
    if (!segment || !templateName) return;
    setSending(true);
    setCampaignMessage(null);
    try {
      const res = await authFetch<{ matched: number; queued: number }>('/campaigns/send-to-segment', {
        method: 'POST',
        body: JSON.stringify({ segment, templateName }),
      });
      setCampaignMessage(
        `Listo: se encolaron ${res.queued} de ${res.matched} mensaje(s) con la plantilla "${templateName}" — n8n/Chatwoot los despacha por WhatsApp.`,
      );
    } catch (err) {
      setCampaignMessage(describeError(err, 'No se pudo enviar la campaña'));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy });
    if (search) params.set('search', search);
    if (segment) params.set('segment', segment);
    authFetch<ClientsPage>(`/reports/clients?${params.toString()}`)
      .then(setResult)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la lista de clientes')));
  }, [search, sortBy, segment, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Clientes</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Filtra por segmento para saber a quién premiar (activos) y a quién reactivar (en riesgo/dormidos).
        </span>
      </div>
      {error && <p className="error-text">{error}</p>}

      {segment && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            Enviar campaña de WhatsApp — {segmentInfo(segment).label}
          </span>
          <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
            Encola la plantilla elegida para los {result?.total ?? '…'} cliente(s) de este segmento. El envío real lo
            hace el flujo de n8n/Chatwoot conectado a WhatsApp Business.
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
              <option value="">Elige una plantilla activa…</option>
              {templates
                .filter((t) => t.isActive)
                .map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name} ({t.type})
                  </option>
                ))}
            </select>
            <button className="btn-primary" disabled={!templateName || sending} onClick={handleSendCampaign}>
              {sending ? 'Enviando…' : 'Enviar a este segmento'}
            </button>
          </div>
          {templates.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
              No hay plantillas todavía — créalas en <Link href="/templates">Plantillas de WhatsApp</Link>.
            </span>
          )}
          {campaignMessage && <p style={{ fontSize: 13 }}>{campaignMessage}</p>}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por nombre o WhatsApp"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            style={{ flex: 1, minWidth: 220 }}
          />
          <select
            value={segment}
            onChange={(e) => {
              setPage(1);
              setSegment(e.target.value as Segment | '');
            }}
          >
            <option value="">Todos los segmentos</option>
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => {
              setPage(1);
              setSortBy(e.target.value as SortBy);
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Ordenar por: {opt.label}
              </option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>WhatsApp</th>
              <th>Segmento</th>
              <th>Sellos</th>
              <th>Puntos</th>
              <th>Gasto total</th>
              <th>Visitas</th>
              <th>Canjes</th>
              <th>Última visita</th>
            </tr>
          </thead>
          <tbody>
            {(result?.data ?? []).map((client) => (
              <tr key={client.id} style={{ cursor: 'pointer' }}>
                <td>
                  <Link href={`/clients/${client.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
                    {client.name}
                  </Link>
                </td>
                <td>{client.whatsapp}</td>
                <td>
                  <span className="badge" style={segmentInfo(client.segment).badge}>
                    {segmentInfo(client.segment).label.split(' (')[0]}
                  </span>
                </td>
                <td>{client.stamps}</td>
                <td>{client.points}</td>
                <td>L. {Number(client.totalSpent).toFixed(2)}</td>
                <td>{client._count.visits}</td>
                <td>{client._count.redemptions}</td>
                <td>{client.lastVisitAt ? new Date(client.lastVisitAt).toLocaleDateString('es-HN') : '—'}</td>
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: 'var(--black-60)' }}>
                  No se encontraron clientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {result && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
              {result.total} cliente{result.total === 1 ? '' : 's'} · página {result.page} de {totalPages}
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
