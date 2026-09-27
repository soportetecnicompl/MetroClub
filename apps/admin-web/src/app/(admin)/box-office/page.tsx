'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
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
}

interface ShowtimeRow {
  id: string;
  format: string;
  startsAt: string;
  status: string;
  movie: { title: string };
  screen: { name: string };
  priceRule: { price: string } | null;
}

interface SeatMapSeat {
  seatId: string;
  row: string;
  number: number;
  type: string;
  status: 'AVAILABLE' | 'HELD' | 'SOLD';
}

interface SeatMap {
  showtimeId: string;
  movie: string;
  screen: string;
  startsAt: string;
  format: string;
  price: number | null;
  soldCount: number;
  isAtRisk: boolean;
  seats: SeatMapSeat[];
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
}

interface Ticket {
  id: string;
  seatId: string;
  price: string;
  discountApplied: string;
  qrToken: string;
}

interface ScannedTicket {
  id: string;
  status: string;
  price: string;
  usedAt: string | null;
  showtime: { movie: { title: string }; startsAt: string };
  seat: { row: string; number: number };
  client: { name: string } | null;
}

interface Product {
  id: string;
  complexId: string;
  name: string;
  price: string;
}

interface ConcessionSale {
  id: string;
  total: string;
  items: { productId: string; quantity: number; unitPrice: string; product: { name: string } }[];
}

function QrCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, { width: 180, margin: 1 }).catch(() => undefined);
    }
  }, [value]);

  return <canvas ref={canvasRef} />;
}

export default function BoxOfficePage() {
  const [mode, setMode] = useState<'sell' | 'scan' | 'concessions'>('sell');

  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complexId, setComplexId] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [movieId, setMovieId] = useState('');
  const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([]);
  const [showtimeId, setShowtimeId] = useState('');
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [heldSeatIds, setHeldSeatIds] = useState<string[]>([]);

  const [whatsapp, setWhatsapp] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [acceptedRisk, setAcceptedRisk] = useState(false);

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadShowtimes = (cId: string, mId: string) => {
    if (!cId) return;
    const params = new URLSearchParams({ complexId: cId });
    if (mId) params.set('movieId', mId);
    authFetch<ShowtimeRow[]>(`/ticketing/showtimes?${params.toString()}`)
      .then(setShowtimes)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar las funciones')));
  };

  useEffect(() => {
    authFetch<Complex[]>('/complexes')
      .then((data) => {
        setComplexes(data);
        if (data[0]) setComplexId(data[0].id);
      })
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los complejos')));
    authFetch<Movie[]>('/ticketing/movies')
      .then(setMovies)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar las películas')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (complexId) loadShowtimes(complexId, movieId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexId, movieId]);

  const loadSeatMap = (id: string) => {
    authFetch<SeatMap>(`/ticketing/showtimes/${id}/seat-map`)
      .then(setSeatMap)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el mapa de butacas')));
  };

  const selectShowtime = (id: string) => {
    setShowtimeId(id);
    setHeldSeatIds([]);
    setAcceptedRisk(false);
    setTickets(null);
    loadSeatMap(id);
  };

  const toggleSeat = async (seat: SeatMapSeat) => {
    setError(null);
    try {
      if (seat.status === 'AVAILABLE') {
        await authFetch(`/ticketing/showtimes/${showtimeId}/holds`, {
          method: 'POST',
          body: JSON.stringify({ seatId: seat.seatId }),
        });
        setHeldSeatIds((prev) => [...prev, seat.seatId]);
      } else if (heldSeatIds.includes(seat.seatId)) {
        await authFetch(`/ticketing/showtimes/${showtimeId}/holds/${seat.seatId}`, { method: 'DELETE' });
        setHeldSeatIds((prev) => prev.filter((id) => id !== seat.seatId));
      } else {
        return; // ocupada por otra taquilla o ya vendida
      }
      loadSeatMap(showtimeId);
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar la butaca'));
      loadSeatMap(showtimeId);
    }
  };

  const lookupClient = async () => {
    setError(null);
    try {
      const found = await authFetch<Client | null>(`/clients/lookup?whatsapp=${encodeURIComponent(whatsapp)}`);
      setClient(found);
      if (!found) setError('No se encontró ningún cliente MetroClub con ese WhatsApp');
    } catch (err) {
      setError(describeError(err, 'No se pudo buscar al cliente'));
    }
  };

  const confirmSale = async () => {
    if (heldSeatIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<Ticket[]>('/ticketing/sales', {
        method: 'POST',
        body: JSON.stringify({
          showtimeId,
          seatIds: heldSeatIds,
          clientId: client?.id,
          channel: 'BOX_OFFICE',
          acceptedRisk,
        }),
      });
      setTickets(result);
      setHeldSeatIds([]);
    } catch (err) {
      setError(describeError(err, 'No se pudo confirmar la venta'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTickets(null);
    setClient(null);
    setWhatsapp('');
    setAcceptedRisk(false);
    if (showtimeId) loadSeatMap(showtimeId);
  };

  const seatColor = (status: SeatMapSeat['status'], seatId: string) => {
    if (status === 'SOLD') return { background: 'var(--black-20)', color: 'var(--black-40)', cursor: 'not-allowed' };
    if (status === 'HELD' && heldSeatIds.includes(seatId)) {
      return { background: 'var(--blue-100, #2563eb)', color: '#fff', cursor: 'pointer' };
    }
    if (status === 'HELD') return { background: '#fff3cd', color: '#8a6d1a', cursor: 'not-allowed' };
    return { background: 'var(--success-10)', color: 'var(--success-150)', cursor: 'pointer' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Taquilla</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={mode === 'sell' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('sell')}>
            Vender
          </button>
          <button className={mode === 'scan' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('scan')}>
            Escanear boleto
          </button>
          <button
            className={mode === 'concessions' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMode('concessions')}
          >
            Confitería
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {mode === 'scan' ? (
        <ScanTickets />
      ) : mode === 'concessions' ? (
        <SellConcessions complexId={complexId} complexes={complexes} onComplexChange={setComplexId} />
      ) : (
        <>
          <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={complexId} onChange={(e) => setComplexId(e.target.value)}>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.city}
                </option>
              ))}
            </select>
            <select value={movieId} onChange={(e) => setMovieId(e.target.value)}>
              <option value="">Todas las películas</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Funciones</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {showtimes.map((s) => (
                <button
                  key={s.id}
                  className={showtimeId === s.id ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => selectShowtime(s.id)}
                >
                  {s.movie.title} · {s.screen.name} · {new Date(s.startsAt).toLocaleString('es-HN')} · {s.format}
                  {s.status === 'AT_RISK' ? ' ⚠️' : ''}
                </button>
              ))}
              {showtimes.length === 0 && <span style={{ color: 'var(--black-60)' }}>No hay funciones para este filtro.</span>}
            </div>
          </div>

          {seatMap && !tickets && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  {seatMap.movie} — {seatMap.screen} — {new Date(seatMap.startsAt).toLocaleString('es-HN')}
                </span>
                <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
                  Precio base: {seatMap.price != null ? `L. ${seatMap.price.toFixed(2)}` : '—'} · Vendidos: {seatMap.soldCount}
                </span>
              </div>

              {seatMap.isAtRisk && (
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: '#fff3cd', color: '#8a6d1a' }}>
                  ⚠️ Esta función aún no alcanza el mínimo de asistentes y podría cambiar de horario. Metro Cinemas no
                  realiza devoluciones en efectivo — si esto ocurre, el cliente será reasignado a otra función.
                  <label style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={acceptedRisk} onChange={(e) => setAcceptedRisk(e.target.checked)} />
                    El cliente acepta continuar bajo su responsabilidad
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {seatMap.seats.map((seat) => (
                  <button
                    key={seat.seatId}
                    onClick={() => toggleSeat(seat)}
                    style={{
                      width: 48,
                      height: 40,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      ...seatColor(seat.status, seat.seatId),
                    }}
                    title={`${seat.row}${seat.number} — ${seat.status}`}
                  >
                    {seat.row}
                    {seat.number}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  placeholder="WhatsApp del cliente MetroClub (opcional)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <button className="btn-secondary" onClick={lookupClient}>
                  Identificar cliente
                </button>
                {client && (
                  <span className="badge" style={{ background: 'var(--success-10)', color: 'var(--success-150)' }}>
                    {client.name} — descuento MetroClub se aplicará automáticamente
                  </span>
                )}
              </div>

              <button
                className="btn-primary"
                disabled={heldSeatIds.length === 0 || (seatMap.isAtRisk && !acceptedRisk) || loading}
                onClick={confirmSale}
              >
                {loading ? 'Cobrando…' : `Cobrar ${heldSeatIds.length} butaca(s)`}
              </button>
            </div>
          )}

          {tickets && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Venta confirmada</span>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, border: '1px solid var(--black-10)', borderRadius: 'var(--radius-sm)' }}
                  >
                    <QrCanvas value={ticket.qrToken} />
                    <span style={{ fontSize: 13 }}>L. {Number(ticket.price).toFixed(2)}</span>
                    {Number(ticket.discountApplied) > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--success-150)' }}>
                        Ahorro MetroClub: L. {Number(ticket.discountApplied).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn-secondary" onClick={reset}>
                Nueva venta
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScanTickets() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'idle' | 'active' | 'error'>('idle');
  const [result, setResult] = useState<ScannedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus('idle');
  };

  const handleDetected = async (qrToken: string) => {
    stop();
    setBusy(true);
    setError(null);
    try {
      const ticket = await authFetch<ScannedTicket>('/ticketing/tickets/scan', {
        method: 'POST',
        body: JSON.stringify({ qrToken }),
      });
      setResult(ticket);
    } catch (err) {
      setError(describeError(err, 'No se pudo validar el boleto'));
      setTimeout(() => start(), 2000);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (streamRef.current) return;
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setStatus('active');

      const tick = () => {
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code?.data) {
              handleDetected(code.data);
              return;
            }
          }
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>Escanear boleto en la entrada</span>
      {error && <p className="error-text">{error}</p>}

      <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
        <video ref={videoRef} style={{ width: '100%', borderRadius: 'var(--radius-sm)' }} muted playsInline />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {status !== 'active' && !result && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--black-60)' }}>
            {busy ? 'Validando…' : status === 'error' ? 'No se pudo acceder a la cámara' : 'Iniciando cámara…'}
          </div>
        )}
      </div>

      {result && (
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--radius-sm)',
            background: result.status === 'USED' ? 'var(--success-10)' : 'var(--black-10)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{result.showtime.movie.title}</p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Butaca {result.seat.row}
            {result.seat.number} — {new Date(result.showtime.startsAt).toLocaleString('es-HN')}
          </p>
          {result.client && <p style={{ margin: 0, fontSize: 13 }}>Cliente MetroClub: {result.client.name}</p>}
          <p style={{ margin: '8px 0 0', fontWeight: 700 }}>✅ Acceso válido</p>
          <button className="btn-secondary" style={{ marginTop: 10 }} onClick={start}>
            Escanear otro
          </button>
        </div>
      )}
    </div>
  );
}

function SellConcessions({
  complexId,
  complexes,
  onComplexChange,
}: {
  complexId: string;
  complexes: Complex[];
  onComplexChange: (id: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [whatsapp, setWhatsapp] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [sale, setSale] = useState<ConcessionSale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!complexId) return;
    authFetch<Product[]>(`/concessions/products?complexId=${complexId}`)
      .then(setProducts)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los productos')));
  }, [complexId]);

  const lookupClient = async () => {
    setError(null);
    try {
      const found = await authFetch<Client | null>(`/clients/lookup?whatsapp=${encodeURIComponent(whatsapp)}`);
      setClient(found);
      if (!found) setError('No se encontró ningún cliente MetroClub con ese WhatsApp');
    } catch (err) {
      setError(describeError(err, 'No se pudo buscar al cliente'));
    }
  };

  const addToCart = (productId: string) => setCart((c) => ({ ...c, [productId]: (c[productId] ?? 0) + 1 }));
  const removeFromCart = (productId: string) =>
    setCart((c) => {
      const next = { ...c };
      if (next[productId] > 1) next[productId] -= 1;
      else delete next[productId];
      return next;
    });

  const cartEntries = Object.entries(cart);
  const cartTotal = cartEntries.reduce((sum, [productId, qty]) => {
    const product = products.find((p) => p.id === productId);
    return sum + (product ? Number(product.price) * qty : 0);
  }, 0);

  const confirmSale = async () => {
    if (cartEntries.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<ConcessionSale>('/concessions/sales', {
        method: 'POST',
        body: JSON.stringify({
          complexId,
          clientId: client?.id,
          channel: 'BOX_OFFICE',
          items: cartEntries.map(([productId, quantity]) => ({ productId, quantity })),
        }),
      });
      setSale(result);
      setCart({});
    } catch (err) {
      setError(describeError(err, 'No se pudo confirmar la venta'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSale(null);
    setClient(null);
    setWhatsapp('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ display: 'flex', gap: 8 }}>
        <select value={complexId} onChange={(e) => onComplexChange(e.target.value)}>
          {complexes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.city}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!sale ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Productos</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {products.map((p) => (
              <button key={p.id} className="btn-secondary" onClick={() => addToCart(p.id)}>
                {p.name} — L. {Number(p.price).toFixed(2)}
              </button>
            ))}
            {products.length === 0 && (
              <span style={{ color: 'var(--black-60)' }}>No hay productos configurados para este complejo.</span>
            )}
          </div>

          {cartEntries.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cartEntries.map(([productId, qty]) => {
                  const product = products.find((p) => p.id === productId);
                  return (
                    <tr key={productId}>
                      <td>{product?.name ?? '—'}</td>
                      <td>{qty}</td>
                      <td>L. {(Number(product?.price ?? 0) * qty).toFixed(2)}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => removeFromCart(productId)}>
                          Quitar uno
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="WhatsApp del cliente MetroClub (opcional)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <button className="btn-secondary" onClick={lookupClient}>
              Identificar cliente
            </button>
            {client && (
              <span className="badge" style={{ background: 'var(--success-10)', color: 'var(--success-150)' }}>
                {client.name}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Total: L. {cartTotal.toFixed(2)}</span>
            <button className="btn-primary" disabled={cartEntries.length === 0 || loading} onClick={confirmSale}>
              {loading ? 'Cobrando…' : 'Cobrar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Venta confirmada — Total L. {Number(sale.total).toFixed(2)}</span>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {sale.items.map((item, index) => (
              <li key={index}>
                {item.quantity} × {item.product.name} — L. {Number(item.unitPrice).toFixed(2)} c/u
              </li>
            ))}
          </ul>
          <button className="btn-secondary" onClick={reset}>
            Nueva venta
          </button>
        </div>
      )}
    </div>
  );
}
