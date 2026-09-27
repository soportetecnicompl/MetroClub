'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
}

interface Movie {
  id: string;
  title: string;
}

interface Promotion {
  id: string;
  name: string;
  type: 'PERCENT_OFF' | 'FIXED_AMOUNT_OFF';
  value: string;
  scope: 'ALL_TICKETS' | 'MOVIE' | 'FORMAT' | 'COMPLEX';
  movieId: string | null;
  format: string | null;
  complexId: string | null;
  requiresMetroClub: boolean;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

const FORMATS = ['D2', 'D3', 'VIP', 'SUPER_VIP'];

const SCOPE_LABELS: Record<Promotion['scope'], string> = {
  ALL_TICKETS: 'Cualquier boleto',
  MOVIE: 'Película específica',
  FORMAT: 'Formato específico',
  COMPLEX: 'Complejo específico',
};

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPromotions = () =>
    authFetch<Promotion[]>('/ticketing/promotions')
      .then(setPromotions)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar las promociones')));

  useEffect(() => {
    authFetch<Complex[]>('/complexes').then(setComplexes).catch(() => undefined);
    authFetch<Movie[]>('/ticketing/movies').then(setMovies).catch(() => undefined);
    loadPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState({
    name: '',
    type: 'PERCENT_OFF' as Promotion['type'],
    value: '',
    scope: 'ALL_TICKETS' as Promotion['scope'],
    movieId: '',
    format: 'D2',
    complexId: '',
    requiresMetroClub: true,
    endsAt: '',
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await authFetch('/ticketing/promotions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          value: Number(form.value),
          scope: form.scope,
          movieId: form.scope === 'MOVIE' ? form.movieId : undefined,
          format: form.scope === 'FORMAT' ? form.format : undefined,
          complexId: form.scope === 'COMPLEX' ? form.complexId : undefined,
          requiresMetroClub: form.requiresMetroClub,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        }),
      });
      setForm((f) => ({ ...f, name: '', value: '', endsAt: '' }));
      setMessage('Promoción creada — ya se aplicará automáticamente en taquilla y tienda online.');
      loadPromotions();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear la promoción'));
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    setError(null);
    try {
      await authFetch(`/ticketing/promotions/${promo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      loadPromotions();
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar la promoción'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Promociones</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Descuentos que se aplican automáticamente al vender un boleto. Nunca se combinan varias promociones en un
          mismo boleto: si más de una aplica, se usa la que otorga el mayor descuento.
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: 13, color: 'var(--success-150)' }}>{message}</p>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Nueva promoción</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Nombre (ej. Estreno Spider-Man 30%)"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Promotion['type'] })}>
            <option value="PERCENT_OFF">% de descuento</option>
            <option value="FIXED_AMOUNT_OFF">Monto fijo (L.)</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder={form.type === 'PERCENT_OFF' ? 'Porcentaje' : 'Monto (L.)'}
            required
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            style={{ width: 110 }}
          />
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Promotion['scope'] })}>
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {form.scope === 'MOVIE' && (
            <select value={form.movieId} onChange={(e) => setForm({ ...form, movieId: e.target.value })} required>
              <option value="">Película…</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          )}
          {form.scope === 'FORMAT' && (
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
          {form.scope === 'COMPLEX' && (
            <select value={form.complexId} onChange={(e) => setForm({ ...form, complexId: e.target.value })} required>
              <option value="">Complejo…</option>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.requiresMetroClub}
              onChange={(e) => setForm({ ...form, requiresMetroClub: e.target.checked })}
            />
            Solo para clientes MetroClub
          </label>
          <input
            type="datetime-local"
            title="Vigente hasta (opcional)"
            value={form.endsAt}
            onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Crear promoción
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descuento</th>
              <th>Aplica a</th>
              <th>Requiere MetroClub</th>
              <th>Vigente hasta</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.type === 'PERCENT_OFF' ? `${Number(p.value)}%` : `L. ${Number(p.value).toFixed(2)}`}</td>
                <td>
                  {SCOPE_LABELS[p.scope]}
                  {p.scope === 'MOVIE' && ` — ${movies.find((m) => m.id === p.movieId)?.title ?? '—'}`}
                  {p.scope === 'FORMAT' && ` — ${p.format}`}
                  {p.scope === 'COMPLEX' && ` — ${complexes.find((c) => c.id === p.complexId)?.name ?? '—'}`}
                </td>
                <td>{p.requiresMetroClub ? 'Sí' : 'No'}</td>
                <td>{p.endsAt ? new Date(p.endsAt).toLocaleString('es-HN') : 'Sin límite'}</td>
                <td>
                  <span className="badge" style={p.isActive ? undefined : { background: '#fddede', color: '#a01e1e' }}>
                    {p.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => handleToggleActive(p)}>
                    {p.isActive ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
            {promotions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay promociones configuradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
