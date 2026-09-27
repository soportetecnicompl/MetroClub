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

type Segment = 'active' | 'at_risk' | 'dormant' | 'lost' | 'never';

interface Insights {
  segment: Segment;
  totalSpent: number;
  redemptionCost: number;
  netValue: number;
  avgSpendPerVisit: number;
  daysSinceLastVisit: number | null;
  nextReward: { name: string; stampsCost: number | null } | null;
  stampsToNextReward: number | null;
  recommendation: string;
}

interface WhatsappTemplate {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

const SEGMENT_LABELS: Record<Segment, { label: string; badge: { background: string; color: string } }> = {
  active: { label: 'Activo', badge: { background: 'var(--success-10)', color: 'var(--success-150)' } },
  at_risk: { label: 'En riesgo', badge: { background: '#fff3cd', color: '#8a6d1a' } },
  dormant: { label: 'Dormido', badge: { background: '#ffe0cc', color: '#a04a00' } },
  lost: { label: 'Perdido', badge: { background: '#fddede', color: '#a01e1e' } },
  never: { label: 'Nunca ha visitado', badge: { background: 'var(--black-10)', color: 'var(--black-40)' } },
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [sending, setSending] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);

  useEffect(() => {
    authFetch<Client>(`/clients/${params.id}`)
      .then(setClient)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el cliente')));
    authFetch<History>(`/clients/${params.id}/history`)
      .then(setHistory)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el historial del cliente')));
    authFetch<Insights>(`/reports/clients/${params.id}/insights`)
      .then(setInsights)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el análisis del cliente')));
    authFetch<WhatsappTemplate[]>('/whatsapp/templates').then(setTemplates).catch(() => undefined);
  }, [params.id]);

  const handleSendCampaign = async () => {
    if (!templateName) return;
    setSending(true);
    setCampaignMessage(null);
    try {
      const res = await authFetch<{ queued: boolean }>('/campaigns/send-to-client', {
        method: 'POST',
        body: JSON.stringify({ clientId: params.id, templateName }),
      });
      setCampaignMessage(
        res.queued
          ? `Mensaje con la plantilla "${templateName}" encolado — n8n/Chatwoot lo despacha por WhatsApp.`
          : 'No se pudo encolar: la plantilla no existe o está inactiva.',
      );
    } catch (err) {
      setCampaignMessage(describeError(err, 'No se pudo enviar el mensaje'));
    } finally {
      setSending(false);
    }
  };

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

      {insights && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Costo vs. beneficio y potencial</h2>
            <span className="badge" style={SEGMENT_LABELS[insights.segment].badge}>
              {SEGMENT_LABELS[insights.segment].label}
              {insights.daysSinceLastVisit != null ? ` · ${insights.daysSinceLastVisit} días sin visitar` : ''}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Ha generado (L.)</span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>L. {insights.totalSpent.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Le ha costado en premios (L.)</span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>L. {insights.redemptionCost.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Beneficio neto (L.)</span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: insights.netValue >= 0 ? 'var(--success-150)' : 'var(--error-150, #a01e1e)',
                }}
              >
                L. {insights.netValue.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Gasto promedio / visita</span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>L. {insights.avgSpendPerVisit.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="kicker" style={{ color: 'var(--black-60)' }}>Potencial (próximo premio)</span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>
                {insights.nextReward
                  ? `${insights.stampsToNextReward} sello${insights.stampsToNextReward === 1 ? '' : 's'} para "${insights.nextReward.name}"`
                  : '¡Ya desbloqueó todo!'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: 14,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--black-0)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Cómo atacarlo / hacer que regrese</span>
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>{insights.recommendation}</span>
          </div>

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
              {sending ? 'Enviando…' : 'Enviarle este mensaje por WhatsApp'}
            </button>
          </div>
          {campaignMessage && <p style={{ fontSize: 13 }}>{campaignMessage}</p>}
        </section>
      )}

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
