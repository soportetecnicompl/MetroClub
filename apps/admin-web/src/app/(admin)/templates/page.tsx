'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, describeError } from '@/lib/api';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ type: TYPES[0], body: '' });

  const load = () =>
    authFetch<Template[]>('/whatsapp/templates')
      .then(setTemplates)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la lista de plantillas')));

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
      setError(describeError(err, 'No se pudo crear la plantilla'));
    }
  };

  const startEdit = (template: Template) => {
    setEditingId(template.id);
    setEditForm({ type: template.type, body: template.body });
  };

  const saveEdit = async (id: string) => {
    setError(null);
    try {
      await authFetch(`/whatsapp/templates/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar la plantilla'));
    }
  };

  const toggleActive = async (template: Template) => {
    setError(null);
    try {
      if (template.isActive) {
        await authFetch(`/whatsapp/templates/${template.id}`, { method: 'DELETE' });
      } else {
        await authFetch(`/whatsapp/templates/${template.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) });
      }
      load();
    } catch (err) {
      setError(describeError(err, 'No se pudo cambiar el estado de la plantilla'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Plantillas de WhatsApp</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          Fuente de verdad que consumen los flujos de <strong>n8n</strong> + <strong>Chatwoot</strong> para RF-11 a
          RF-15. Las campañas por segmento (en <em>Clientes</em> y el <em>Dashboard</em>) usan el nombre exacto de la
          plantilla para encolar los mensajes.
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
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) =>
              editingId === template.id ? (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                      {TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      style={{ width: '100%' }}
                      value={editForm.body}
                      onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className="badge">{template.isActive ? 'Activa' : 'Inactiva'}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => saveEdit(template.id)}>
                      Guardar
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>
                    <span className="badge" style={{ background: 'var(--info-10)', color: 'var(--info-150)' }}>
                      {template.type}
                    </span>
                  </td>
                  <td>{template.body}</td>
                  <td>
                    <span
                      className="badge"
                      style={
                        template.isActive
                          ? { background: 'var(--success-10)', color: 'var(--success-150)' }
                          : { background: 'var(--black-10)', color: 'var(--black-40)' }
                      }
                    >
                      {template.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => startEdit(template)}>
                      Editar
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => toggleActive(template)}>
                      {template.isActive ? 'Desactivar' : 'Reactivar'}
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
