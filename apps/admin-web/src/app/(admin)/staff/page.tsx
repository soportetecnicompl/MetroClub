'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import jsQR from 'jsqr';
import { authFetch, ApiError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
  city: string;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  stamps: number;
  points: number;
}

interface Reward {
  id: string;
  name: string;
  stampsCost: number | null;
  pointsCost: number | null;
}

interface Toast {
  id: number;
  message: string;
}

type Step = 'lookup' | 'enroll' | 'visit';

/** Mensaje detallado (incluye el status HTTP cuando viene de la API) en vez del genérico "Internal server error". */
function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return `${fallback} — Error ${err.status}: ${err.message}`;
  }
  if (err instanceof Error) {
    return `${fallback} — ${err.message}`;
  }
  return fallback;
}

export default function StaffPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complexId, setComplexId] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [whatsapp, setWhatsapp] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [consent, setConsent] = useState(false);

  const [client, setClient] = useState<Client | null>(null);
  const [amountSpent, setAmountSpent] = useState('');
  const [visitMessage, setVisitMessage] = useState<string | null>(null);
  // El escaneo de QR ya registra la visita solo; si además se muestra el botón "Confirmar
  // visita" en la misma pantalla, un clic de más suma un segundo sello para la misma visita.
  const [visitAlreadyStamped, setVisitAlreadyStamped] = useState(false);

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);

  // El bucle de escaneo (requestAnimationFrame) arranca una sola vez y vive fuera del ciclo
  // normal de render, así que su closure se queda con el complexId que existía al arrancar.
  // Este ref siempre tiene el valor más reciente, evitando que el escaneo quede pegado con un
  // complexId vacío/viejo si /complexes todavía no había respondido cuando arrancó la cámara.
  const complexIdRef = useRef(complexId);
  useEffect(() => {
    complexIdRef.current = complexId;
  }, [complexId]);

  const pushToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const loadComplexes = () => {
    authFetch<Complex[]>('/complexes')
      .then((data) => {
        setComplexes(data);
        if (data[0]) {
          setComplexId(data[0].id);
        } else {
          pushToast('No hay complejos activos configurados — pide a un admin que cree uno en el panel.');
        }
      })
      .catch((err) => {
        pushToast(describeError(err, 'No se pudo cargar la lista de complejos, reintentando…'));
        setTimeout(loadComplexes, 4000);
      });
  };

  useEffect(() => {
    loadComplexes();
    authFetch<Reward[]>('/loyalty/rewards').then(setRewards).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const found = await authFetch<Client | null>(`/clients/lookup?whatsapp=${encodeURIComponent(whatsapp)}`);
      if (found) {
        setClient(found);
        setVisitAlreadyStamped(false);
        setStep('visit');
      } else {
        setStep('enroll');
      }
    } catch (err) {
      pushToast(describeError(err, 'No se pudo buscar al cliente'));
    } finally {
      setLoading(false);
    }
  };

  const stopScanning = () => {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStatus('idle');
  };

  const handleQrDetected = async (clientId: string) => {
    stopScanning();

    const currentComplexId = complexIdRef.current;
    if (!currentComplexId) {
      pushToast('Todavía se está cargando la lista de complejos — espera un segundo e intenta de nuevo.');
      setTimeout(() => startScanning(), 1200);
      return;
    }

    setLoading(true);
    try {
      const found = await authFetch<Client>(`/clients/${clientId}`);
      const updated = await authFetch<Client>(`/clients/${clientId}/visits`, {
        method: 'POST',
        body: JSON.stringify({ complexId: currentComplexId, channel: 'QR' }),
      });
      setClient(updated);
      setVisitAlreadyStamped(true);
      setStep('visit');
      setVisitMessage(
        `+1 sello agregado por QR (antes: ${found.stamps}). Wallet pass actualizado en tiempo real (RF-05).`,
      );
      // Se queda en esta pantalla (canjear premio, ver tarjeta, etc.) hasta que el staff
      // le dé clic a "Buscar otro cliente" — antes se borraba sola a los 4s sin dar tiempo
      // a interactuar con los botones.
    } catch (err) {
      pushToast(describeError(err, 'No se pudo procesar el QR escaneado'));
      // Seguimos en el paso de búsqueda (el step no cambió), así que hay que reiniciar la
      // cámara a mano: el efecto atado a `step` no se vuelve a disparar solo.
      setTimeout(() => startScanning(), 2000);
    } finally {
      setLoading(false);
    }
  };

  const startScanning = async () => {
    if (streamRef.current) return; // ya está corriendo
    setCameraStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraStatus('active');

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
              handleQrDetected(code.data);
              return;
            }
          }
        }
        scanFrameRef.current = requestAnimationFrame(tick);
      };
      scanFrameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      pushToast(describeError(err, 'No se pudo acceder a la cámara. Revisa los permisos del navegador.'));
      setCameraStatus('error');
    }
  };

  // La cámara se abre sola al llegar (o volver) al paso de búsqueda, y se apaga al salir de él.
  useEffect(() => {
    if (step === 'lookup') {
      startScanning();
    } else {
      stopScanning();
    }
    return stopScanning;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleEnroll = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const created = await authFetch<Client>('/clients/enroll', {
        method: 'POST',
        body: JSON.stringify({ name, whatsapp, birthDate: birthDate || undefined }),
      });
      setClient(created);
      setVisitAlreadyStamped(false);
      setStep('visit');
    } catch (err) {
      pushToast(describeError(err, 'No se pudo enrolar al cliente'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVisit = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const updated = await authFetch<Client>(`/clients/${client.id}/visits`, {
        method: 'POST',
        body: JSON.stringify({ complexId, amountSpent: amountSpent ? Number(amountSpent) : undefined }),
      });
      setClient(updated);
      setVisitMessage('+1 sello agregado. Wallet pass actualizado en tiempo real (RF-05).');
    } catch (err) {
      pushToast(describeError(err, 'No se pudo registrar la visita'));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (rewardId: string) => {
    if (!client) return;
    try {
      await authFetch('/loyalty/redemptions', {
        method: 'POST',
        body: JSON.stringify({ clientId: client.id, rewardId, complexId }),
      });
      setVisitMessage('Premio canjeado correctamente.');
      const refreshed = await authFetch<Client | null>(`/clients/lookup?whatsapp=${encodeURIComponent(client.whatsapp)}`);
      if (refreshed) setClient(refreshed);
    } catch (err) {
      pushToast(describeError(err, 'No se pudo canjear el premio'));
    }
  };

  const reset = () => {
    stopScanning();
    setStep('lookup');
    setClient(null);
    setWhatsapp('');
    setName('');
    setBirthDate('');
    setConsent(false);
    setAmountSpent('');
    setVisitMessage(null);
    setVisitAlreadyStamped(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 420 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="kicker">Modo staff · RF-01 a RF-05</span>
        <h1>Enrolamiento y sellado</h1>
      </div>

      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 340,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderLeft: '4px solid var(--error-150, #e5484d)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Cerrar"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--black-60)' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {step === 'lookup' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
              padding: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 100,
                background: 'var(--blue-10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📶
            </div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              Acerca el celular del cliente por NFC, o escanea el QR de su MetroClub
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                background: '#000',
                aspectRatio: '1 / 1',
              }}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: '15%',
                  border: '3px solid var(--blue-100)',
                  borderRadius: 12,
                  boxShadow: '0 0 0 1000px rgba(0,0,0,0.35)',
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {cameraStatus !== 'active' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: 16,
                    color: '#fff',
                    fontSize: 13,
                    background: 'rgba(0,0,0,0.55)',
                  }}
                >
                  {cameraStatus === 'starting' && 'Iniciando cámara…'}
                  {cameraStatus === 'error' && 'No se pudo acceder a la cámara. Revisa los permisos y recarga la página.'}
                  {cameraStatus === 'idle' && 'Cámara detenida.'}
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, textAlign: 'center', color: 'var(--black-60)' }}>
              Apunta al código QR de la tarjeta digital del cliente (Google/Apple Wallet)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--black-60)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--black-10, #eee)' }} />
            o
            <div style={{ flex: 1, height: 1, background: 'var(--black-10, #eee)' }} />
          </div>

          <form onSubmit={handleLookup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              WhatsApp del cliente
              <input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+504 9999-9999" />
            </label>
            <button type="submit" className="btn-secondary" disabled={loading}>
              {loading ? 'Buscando…' : 'Buscar por WhatsApp'}
            </button>
          </form>
        </div>
      )}

      {step === 'enroll' && (
        <form onSubmit={handleEnroll} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
            Cliente no encontrado — es su primera visita. Completa sus datos para crear su MetroClub.
          </span>
          <label>
            Nombre completo
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ana Martínez" />
          </label>
          <label>
            WhatsApp
            <input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </label>
          <label>
            Fecha de cumpleaños (opcional)
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2 }}
            />
            <span style={{ fontWeight: 400, color: 'var(--black-60)' }}>
              El cliente autoriza recibir mensajes de WhatsApp de Metrocinemas y acepta el tratamiento de sus datos
              (consentimiento explícito, RF-02).
            </span>
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando…' : 'Crear tarjeta MetroClub'}
          </button>
        </form>
      )}

      {step === 'visit' && client && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{client.name}</span>
              <span style={{ fontSize: 12, color: 'var(--black-60)' }}>{client.whatsapp}</span>
            </div>
            <span className="badge">Sin datos que pedir</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: 'var(--background-page)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--black-60)' }}>Sellos / puntos actuales</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {client.stamps} sellos · {client.points} pts
            </span>
          </div>

          {visitMessage && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 100,
                  background: 'var(--success-150)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: 14, color: 'var(--black-60)' }}>{visitMessage}</span>
            </div>
          )}

          <label>
            Complejo
            <select value={complexId} onChange={(e) => setComplexId(e.target.value)}>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.city}
                </option>
              ))}
            </select>
          </label>

          {visitAlreadyStamped ? (
            <span
              style={{
                fontSize: 13,
                textAlign: 'center',
                color: 'var(--black-60)',
                background: 'var(--background-page)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
              }}
            >
              Esta visita ya quedó registrada por el escaneo de QR — no hace falta confirmarla de nuevo.
            </span>
          ) : (
            <>
              <label>
                Gasto en confitería (opcional, para puntos RF-07)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="L. 0.00"
                  value={amountSpent}
                  onChange={(e) => setAmountSpent(e.target.value)}
                />
              </label>

              <button className="btn-primary" onClick={handleConfirmVisit} disabled={loading || !complexId}>
                {loading ? 'Confirmando…' : 'Confirmar visita'}
              </button>
            </>
          )}

          {rewards.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Canjear premio</span>
              {rewards.map((reward) => (
                <button key={reward.id} className="btn-secondary" onClick={() => handleRedeem(reward.id)}>
                  {reward.name} ({reward.stampsCost ? `${reward.stampsCost} sellos` : `${reward.pointsCost} pts`})
                </button>
              ))}
            </div>
          )}

          <a
            href={`/mi-tarjeta/${client.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, textAlign: 'center', color: 'var(--blue-100)', fontWeight: 600 }}
          >
            Ver tarjeta digital del cliente ↗
          </a>

          <button className="btn-secondary" onClick={reset}>
            Buscar otro cliente
          </button>
        </div>
      )}
    </div>
  );
}
