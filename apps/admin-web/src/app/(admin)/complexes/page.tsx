'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
  city: string;
  address: string | null;
  isActive: boolean;
}

export default function ComplexesPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', city: '', address: '' });

  const load = () =>
    authFetch<Complex[]>('/complexes?includeInactive=true')
      .then(setComplexes)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la lista de complejos')));

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
      setError(describeError(err, 'No se pudo crear el complejo'));
    }
  };

  const startEdit = (complex: Complex) => {
    setEditingId(complex.id);
    setEditForm({ name: complex.name, city: complex.city, address: complex.address ?? '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    setError(null);
    try {
      await authFetch(`/complexes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editForm.name, city: editForm.city, address: editForm.address || undefined }),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar el complejo'));
    }
  };

  const toggleActive = async (complex: Complex) => {
    setError(null);
    try {
      if (complex.isActive) {
        await authFetch(`/complexes/${complex.id}`, { method: 'DELETE' });
      } else {
        await authFetch(`/complexes/${complex.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) });
      }
      load();
    } catch (err) {
      setError(describeError(err, 'No se pudo cambiar el estado del complejo'));
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
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {complexes.map((complex) =>
              editingId === complex.id ? (
                <tr key={complex.id}>
                  <td>
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </td>
                  <td>
                    <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                  </td>
                  <td>
                    <input
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={
                        complex.isActive
                          ? { background: 'var(--success-10)', color: 'var(--success-150)' }
                          : { background: 'var(--black-10)', color: 'var(--black-40)' }
                      }
                    >
                      {complex.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => saveEdit(complex.id)}>
                      Guardar
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={cancelEdit}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={complex.id}>
                  <td>{complex.name}</td>
                  <td>{complex.city}</td>
                  <td>{complex.address ?? '—'}</td>
                  <td>
                    <span
                      className="badge"
                      style={
                        complex.isActive
                          ? { background: 'var(--success-10)', color: 'var(--success-150)' }
                          : { background: 'var(--black-10)', color: 'var(--black-40)' }
                      }
                    >
                      {complex.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => startEdit(complex)}>
                      Editar
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => toggleActive(complex)}>
                      {complex.isActive ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
