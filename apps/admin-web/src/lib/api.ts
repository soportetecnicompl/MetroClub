import { clearSession, getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? `Error ${res.status} al consultar ${path}`);
  }

  // NestJS manda el body vacío (Content-Length: 0) cuando el handler devuelve null o
  // undefined (ej. una búsqueda que no encontró nada, o un endpoint void) — res.json()
  // sobre un body vacío truena con "Unexpected end of JSON input". Un 204 explícito
  // tampoco trae body. En ambos casos el valor real es "nada", así que se devuelve null.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

/**
 * Igual que apiFetch, pero adjunta el token JWT de la sesión actual (RF-16). Si el backend
 * responde 401 (token vencido o inválido), en vez de dejar que cada pantalla muestre su
 * propio "Error 401: Unauthorized" por separado, se limpia la sesión y se manda a /login
 * una sola vez — el JWT expira a las 8h (JWT_EXPIRES_IN) y antes esto se veía como un error
 * genérico en cada widget sin ninguna pista de que solo hacía falta iniciar sesión de nuevo.
 */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  try {
    return await apiFetch<T>(path, {
      ...init,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && typeof window !== 'undefined') {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw err;
  }
}

/** Da contexto real al error (status + mensaje del backend) en vez de un mensaje genérico. */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return `${fallback} — Error ${err.status}: ${err.message}`;
  }
  if (err instanceof Error) {
    return `${fallback} — ${err.message}`;
  }
  return fallback;
}
