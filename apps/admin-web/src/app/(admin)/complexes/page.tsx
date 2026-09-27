'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, ApiError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
  city: string;
  address: string | null;
}

export default function ComplexesPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => authFetch<Complex[]>('/complexes').then(setComplexes).catch(() => undefined);

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await authFetch('/complexes', {
        method: 'POST',
        body: JSON.stringify({ name, city, address: address || undefined }),
      });
      setName('');
      setCity('');
      setAddress('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el complejo');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Complejos</h1>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Ciudad" required value={city} onChange={(e) => setCity(e.target.value)} />
          <input placeholder="Dirección (opcional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          <button type="submit" className="btn-primary">
            Agregar complejo
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Ciudad</th>
              <th>Dirección</th>
            </tr>
          </thead>
          <tbody>
            {complexes.map((complex) => (
              <tr key={complex.id}>
                <td>{complex.name}</td>
                <td>{complex.city}</td>
                <td>{complex.address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
