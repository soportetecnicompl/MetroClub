'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
  city: string;
}

interface Movie {
  id: string;
  title: string;
  durationMin: number;
  rating: string | null;
  language: string | null;
  isActive: boolean;
}

interface Screen {
  id: string;
  complexId: string;
  name: string;
  seatCount: number;
}

interface PriceRule {
  id: string;
  complexId: string;
  format: string;
  price: string;
}

interface ShowtimeRow {
  id: string;
  format: string;
  startsAt: string;
  status: string;
  minSalesThreshold: number | null;
  minSalesDeadlineMinutesBefore: number | null;
  movie: { title: string };
  screen: { name: string };
  priceRule: { price: string } | null;
}

const FORMATS = ['D2', 'D3', 'VIP', 'SUPER_VIP'];

function rowLetter(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

export default function CatalogPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [priceRules, setPriceRules] = useState<PriceRule[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMovies = () =>
    authFetch<Movie[]>('/ticketing/movies').then(setMovies).catch((err) => setError(describeError(err, 'No se pudieron cargar las películas')));
  const loadScreens = () =>
    authFetch<Screen[]>('/ticketing/screens').then(setScreens).catch((err) => setError(describeError(err, 'No se pudieron cargar las salas')));
  const loadPriceRules = () =>
    authFetch<PriceRule[]>('/ticketing/price-rules').then(setPriceRules).catch((err) => setError(describeError(err, 'No se pudieron cargar los precios')));
  const loadShowtimes = () =>
    authFetch<ShowtimeRow[]>('/ticketing/showtimes').then(setShowtimes).catch((err) => setError(describeError(err, 'No se pudieron cargar las funciones')));

  useEffect(() => {
    authFetch<Complex[]>('/complexes').then((data) => {
      setComplexes(data);
      if (data[0]) {
        setScreenForm((f) => ({ ...f, complexId: data[0].id }));
        setPriceForm((f) => ({ ...f, complexId: data[0].id }));
        setShowtimeForm((f) => ({ ...f, complexId: data[0].id }));
      }
    }).catch((err) => setError(describeError(err, 'No se pudieron cargar los complejos')));
    loadMovies();
    loadScreens();
    loadPriceRules();
    loadShowtimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Películas ---
  const [movieForm, setMovieForm] = useState({ title: '', durationMin: 120, rating: '', language: 'Español' });
  const handleCreateMovie = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await authFetch('/ticketing/movies', {
        method: 'POST',
        body: JSON.stringify({ ...movieForm, rating: movieForm.rating || undefined }),
      });
      setMovieForm({ title: '', durationMin: 120, rating: '', language: 'Español' });
      loadMovies();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear la película'));
    }
  };

  // --- Salas + butacas ---
  const [screenForm, setScreenForm] = useState({ complexId: '', name: '' });
  const handleCreateScreen = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await authFetch('/ticketing/screens', { method: 'POST', body: JSON.stringify(screenForm) });
      setScreenForm((f) => ({ ...f, name: '' }));
      loadScreens();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear la sala'));
    }
  };

  const [seatGenForm, setSeatGenForm] = useState({ screenId: '', rows: 5, seatsPerRow: 10 });
  const handleGenerateSeats = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!seatGenForm.screenId) {
      setError('Elige una sala');
      return;
    }
    const seats = Array.from({ length: seatGenForm.rows }).flatMap((_, r) =>
      Array.from({ length: seatGenForm.seatsPerRow }).map((_, n) => ({
        row: rowLetter(r),
        number: n + 1,
        type: 'STANDARD' as const,
      })),
    );
    try {
      await authFetch(`/ticketing/screens/${seatGenForm.screenId}/seats`, {
        method: 'POST',
        body: JSON.stringify({ seats }),
      });
      setMessage(`Se generaron ${seats.length} butacas (${seatGenForm.rows} filas × ${seatGenForm.seatsPerRow})`);
      loadScreens();
    } catch (err) {
      setError(describeError(err, 'No se pudieron generar las butacas'));
    }
  };

  // --- Precios ---
  const [priceForm, setPriceForm] = useState({ complexId: '', format: 'D2', price: '' });
  const handleCreatePriceRule = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await authFetch('/ticketing/price-rules', {
        method: 'POST',
        body: JSON.stringify({ ...priceForm, price: Number(priceForm.price) }),
      });
      setPriceForm((f) => ({ ...f, price: '' }));
      loadPriceRules();
    } catch (err) {
      setError(describeError(err, 'No se pudo guardar el precio'));
    }
  };

  // --- Funciones ---
  const [showtimeForm, setShowtimeForm] = useState({
    movieId: '',
    screenId: '',
    complexId: '',
    format: 'D2',
    startsAt: '',
    minSalesThreshold: '',
    minSalesDeadlineMinutesBefore: '',
  });
  const handleCreateShowtime = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const priceRule = priceRules.find((p) => p.complexId === showtimeForm.complexId && p.format === showtimeForm.format);
    if (!priceRule) {
      setError(`No hay un precio configurado para ${showtimeForm.format} en este complejo — créalo arriba primero`);
      return;
    }
    try {
      await authFetch('/ticketing/showtimes', {
        method: 'POST',
        body: JSON.stringify({
          movieId: showtimeForm.movieId,
          screenId: showtimeForm.screenId,
          complexId: showtimeForm.complexId,
          format: showtimeForm.format,
          priceRuleId: priceRule.id,
          startsAt: new Date(showtimeForm.startsAt).toISOString(),
          minSalesThreshold: showtimeForm.minSalesThreshold ? Number(showtimeForm.minSalesThreshold) : undefined,
          minSalesDeadlineMinutesBefore: showtimeForm.minSalesDeadlineMinutesBefore
            ? Number(showtimeForm.minSalesDeadlineMinutesBefore)
            : undefined,
        }),
      });
      setShowtimeForm((f) => ({ ...f, startsAt: '', minSalesThreshold: '', minSalesDeadlineMinutesBefore: '' }));
      loadShowtimes();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear la función'));
    }
  };

  const screensInComplex = screens.filter((s) => s.complexId === showtimeForm.complexId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Configuración de cartelera</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Películas, salas y butacas, precios por formato, y las funciones que aparecen en taquilla y la tienda online.
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: 13, color: 'var(--success-150)' }}>{message}</p>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Películas</h2>
        <form onSubmit={handleCreateMovie} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Título"
            required
            value={movieForm.title}
            onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
          />
          <input
            type="number"
            min={1}
            placeholder="Duración (min)"
            required
            value={movieForm.durationMin}
            onChange={(e) => setMovieForm({ ...movieForm, durationMin: Number(e.target.value) })}
          />
          <input
            placeholder="Clasificación (ej. B, B-15)"
            value={movieForm.rating}
            onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })}
          />
          <input
            placeholder="Idioma"
            value={movieForm.language}
            onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Agregar película
          </button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Duración</th>
              <th>Clasificación</th>
              <th>Idioma</th>
            </tr>
          </thead>
          <tbody>
            {movies.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{m.durationMin} min</td>
                <td>{m.rating ?? '—'}</td>
                <td>{m.language ?? '—'}</td>
              </tr>
            ))}
            {movies.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay películas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Salas y butacas</h2>
        <form onSubmit={handleCreateScreen} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={screenForm.complexId} onChange={(e) => setScreenForm({ ...screenForm, complexId: e.target.value })}>
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city}
              </option>
            ))}
          </select>
          <input
            placeholder="Nombre de la sala (ej. Sala 3)"
            required
            value={screenForm.name}
            onChange={(e) => setScreenForm({ ...screenForm, name: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Crear sala
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Sala</th>
              <th>Complejo</th>
              <th>Butacas</th>
            </tr>
          </thead>
          <tbody>
            {screens.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{complexes.find((c) => c.id === s.complexId)?.name ?? '—'}</td>
                <td>{s.seatCount}</td>
              </tr>
            ))}
            {screens.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay salas.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ borderTop: '1px solid var(--black-10)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Generar butacas para una sala</span>
          <form onSubmit={handleGenerateSeats} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={seatGenForm.screenId} onChange={(e) => setSeatGenForm({ ...seatGenForm, screenId: e.target.value })}>
              <option value="">Elige una sala…</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.seatCount} butacas actuales)
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={26}
              value={seatGenForm.rows}
              onChange={(e) => setSeatGenForm({ ...seatGenForm, rows: Number(e.target.value) })}
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>filas ×</span>
            <input
              type="number"
              min={1}
              value={seatGenForm.seatsPerRow}
              onChange={(e) => setSeatGenForm({ ...seatGenForm, seatsPerRow: Number(e.target.value) })}
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>butacas por fila</span>
            <button type="submit" className="btn-secondary">
              Generar
            </button>
          </form>
          <span style={{ fontSize: 12, color: 'var(--black-60)' }}>
            Genera un mapa A1, A2… hasta {seatGenForm.rows > 0 ? rowLetter(seatGenForm.rows - 1) : '—'}
            {seatGenForm.seatsPerRow}, todas tipo estándar. Se puede repetir para agregar más (no borra las existentes).
          </span>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Precios por complejo y formato</h2>
        <form onSubmit={handleCreatePriceRule} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={priceForm.complexId} onChange={(e) => setPriceForm({ ...priceForm, complexId: e.target.value })}>
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={priceForm.format} onChange={(e) => setPriceForm({ ...priceForm, format: e.target.value })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Precio (L.)"
            required
            value={priceForm.price}
            onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Guardar precio
          </button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Complejo</th>
              <th>Formato</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {priceRules.map((p) => (
              <tr key={p.id}>
                <td>{complexes.find((c) => c.id === p.complexId)?.name ?? '—'}</td>
                <td>{p.format}</td>
                <td>L. {Number(p.price).toFixed(2)}</td>
              </tr>
            ))}
            {priceRules.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay precios configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Funciones</h2>
        <form onSubmit={handleCreateShowtime} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={showtimeForm.movieId} onChange={(e) => setShowtimeForm({ ...showtimeForm, movieId: e.target.value })} required>
            <option value="">Película…</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <select
            value={showtimeForm.complexId}
            onChange={(e) => setShowtimeForm({ ...showtimeForm, complexId: e.target.value, screenId: '' })}
          >
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={showtimeForm.screenId} onChange={(e) => setShowtimeForm({ ...showtimeForm, screenId: e.target.value })} required>
            <option value="">Sala…</option>
            {screensInComplex.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={showtimeForm.format} onChange={(e) => setShowtimeForm({ ...showtimeForm, format: e.target.value })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            required
            value={showtimeForm.startsAt}
            onChange={(e) => setShowtimeForm({ ...showtimeForm, startsAt: e.target.value })}
          />
          <input
            type="number"
            min={0}
            placeholder="Mínimo de boletos (opcional)"
            value={showtimeForm.minSalesThreshold}
            onChange={(e) => setShowtimeForm({ ...showtimeForm, minSalesThreshold: e.target.value })}
          />
          <input
            type="number"
            min={0}
            placeholder="Evaluar mínimo N min antes"
            value={showtimeForm.minSalesDeadlineMinutesBefore}
            onChange={(e) => setShowtimeForm({ ...showtimeForm, minSalesDeadlineMinutesBefore: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Crear función
          </button>
        </form>
        <span style={{ fontSize: 12, color: 'var(--black-60)' }}>
          El precio se toma automáticamente de la regla configurada arriba para ese complejo + formato.
        </span>

        <table>
          <thead>
            <tr>
              <th>Película</th>
              <th>Sala</th>
              <th>Formato</th>
              <th>Horario</th>
              <th>Precio</th>
              <th>Mínimo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {showtimes.map((s) => (
              <tr key={s.id}>
                <td>{s.movie.title}</td>
                <td>{s.screen.name}</td>
                <td>{s.format}</td>
                <td>{new Date(s.startsAt).toLocaleString('es-HN')}</td>
                <td>{s.priceRule ? `L. ${Number(s.priceRule.price).toFixed(2)}` : '—'}</td>
                <td>{s.minSalesThreshold ?? '—'}</td>
                <td>
                  <span
                    className="badge"
                    style={
                      s.status === 'AT_RISK'
                        ? { background: '#fff3cd', color: '#8a6d1a' }
                        : s.status === 'CANCELLED'
                          ? { background: '#fddede', color: '#a01e1e' }
                          : undefined
                    }
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {showtimes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay funciones configuradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
