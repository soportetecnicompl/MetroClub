'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, ApiError } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  type: string;
  body: string;
  isActive: boolean;
}

const TYPES = ['POST_VISIT', 'REVIEW_REQUEST', 'WIN_BACK', 'BIRTHDAY', 'CAMPAIGN'];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ name: '', type: TYPES[0], body: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => authFetch<Template[]>('/whatsapp/templates').then(setTemplates).catch(() => undefined);

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await authFetch('/whatsapp/templates', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', type: TYPES[0], body: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la plantilla');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Plantillas de WhatsApp</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Fuente de verdad que consumen los flujos de <strong>n8n</strong> + <strong>Chatwoot</strong> para RF-11 a
          RF-15.
        </span>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre (ej. post_visit_feedback)"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            placeholder="Texto de la plantilla"
            required
            style={{ flex: 1, minWidth: 240 }}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Crear plantilla
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Texto</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.name}</td>
                <td>
                  <span className="badge" style={{ background: 'var(--info-10)', color: 'var(--info-150)' }}>
                    {template.type}
                  </span>
                </td>
                <td>{template.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
