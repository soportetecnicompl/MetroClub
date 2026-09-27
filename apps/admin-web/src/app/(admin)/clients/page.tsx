'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch, describeError } from '@/lib/api';

interface ClientRow {
  id: string;
  name: string;
  whatsapp: string;
  stamps: number;
  points: number;
  lastVisitAt: string | null;
  createdAt: string;
  _count: { visits: number; redemptions: number };
}

interface ClientsPage {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
}

type SortBy = 'stamps' | 'points' | 'lastVisitAt' | 'createdAt';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'lastVisitAt', label: 'Última visita' },
  { value: 'stamps', label: 'Sellos' },
  { value: 'points', label: 'Puntos' },
  { value: 'createdAt', label: 'Más nuevos' },
];

export default function ClientsPage() {
  const [result, setResult] = useState<ClientsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('lastVisitAt');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy });
    if (search) params.set('search', search);
    authFetch<ClientsPage>(`/reports/clients?${params.toString()}`)
      .then(setResult)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la lista de clientes')));
  }, [search, sortBy, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Clientes</h1>
      {error && <p className="error-text">{error}</p>}

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
              <th>Sellos</th>
              <th>Puntos</th>
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
                <td>{client.stamps}</td>
                <td>{client.points}</td>
                <td>{client._count.visits}</td>
                <td>{client._count.redemptions}</td>
                <td>{client.lastVisitAt ? new Date(client.lastVisitAt).toLocaleDateString('es-HN') : '—'}</td>
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--black-60)' }}>
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
