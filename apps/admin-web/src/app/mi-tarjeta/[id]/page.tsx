'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

interface RewardProgress {
  id: string;
  name: string;
  stampsCost: number | null;
  achieved: boolean;
}

interface CardData {
  name: string;
  whatsappLast4: string;
  stamps: number;
  points: number;
  rewards: RewardProgress[];
  nextReward: { name: string; stampsCost: number | null } | null;
}

export default function ClientCardPage() {
  const params = useParams<{ id: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CardData>(`/public/clients/${params.id}/card`)
      .then(setCard)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu tarjeta'));
  }, [params.id]);

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="error-text">{error}</p>
      </main>
    );
  }

  if (!card) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--black-60)' }}>Cargando tu tarjeta…</span>
      </main>
    );
  }

  const filledDots = card.rewards.length
    ? Math.min(card.stamps, card.nextReward?.stampsCost ?? card.rewards[card.rewards.length - 1].stampsCost ?? card.stamps)
    : card.stamps;
  const totalDots = card.nextReward?.stampsCost ?? (filledDots || 5);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker">Tarjeta digital</span>
          <h1>MetroClub</h1>
        </div>

        <div
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(to bottom, #fba701, #121e6c)',
            color: '#fff',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: 'var(--shadow-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Metrocinemas
              </span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>MetroClub</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{card.name}</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>•••• {card.whatsappLast4}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.9 }}>
              <span>Sellos</span>
              <span>
                {card.stamps} / {totalDots}
                {card.nextReward ? ` para ${card.nextReward.name}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array.from({ length: totalDots }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 100,
                    background: i < card.stamps ? '#fff' : 'rgba(255,255,255,0.35)',
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.25)',
              paddingTop: 14,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, opacity: 0.8 }}>Puntos</span>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{card.points}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, opacity: 0.8 }}>Próximo premio</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{card.nextReward?.name ?? '¡Todos desbloqueados!'}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Tus premios</span>
          {card.rewards.map((reward) => (
            <div key={reward.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{reward.name}</span>
              <span
                className="badge"
                style={
                  reward.achieved
                    ? { background: 'var(--success-10)', color: 'var(--success-150)' }
                    : { background: 'var(--black-10)', color: 'var(--black-40)' }
                }
              >
                {reward.achieved ? 'Disponible' : `${reward.stampsCost} sellos`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
