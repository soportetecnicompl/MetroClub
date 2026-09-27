'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface LoyaltyRule {
  id: string;
  name: string;
  stampsPerVisit: number;
  pointsPerCurrency: string;
  currencyUnit: string;
  isActive: boolean;
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  stampsCost: number | null;
  pointsCost: number | null;
  monetaryValue: string | null;
  isActive: boolean;
}

export default function LoyaltyPage() {
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState({ name: '', stampsPerVisit: 1, pointsPerCurrency: 1, currencyUnit: 10 });
  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    stampsCost: '',
    pointsCost: '',
    monetaryValue: '',
  });

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleEditForm, setRuleEditForm] = useState({ name: '', stampsPerVisit: 1, pointsPerCurrency: 1, currencyUnit: 10 });

  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardEditForm, setRewardEditForm] = useState({
    name: '',
    description: '',
    stampsCost: '',
    pointsCost: '',
    monetaryValue: '',
  });

  const loadRules = () =>
    authFetch<LoyaltyRule[]>('/loyalty/rules')
      .then(setRules)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la lista de reglas')));
  const loadRewards = () =>
    authFetch<Reward[]>('/loyalty/rewards?includeInactive=true')
      .then(setRewards)
      .catch((err) => setError(describeError(err, 'No se pudo cargar la lista de premios')));

  useEffect(() => {
    loadRules();
    loadRewards();
  }, []);

  const handleCreateRule = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await authFetch('/loyalty/rules', { method: 'POST', body: JSON.stringify(ruleForm) });
      setRuleForm({ name: '', stampsPerVisit: 1, pointsPerCurrency: 1, currencyUnit: 10 });
      loadRules();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear la regla'));
    }
  };

  const startEditRule = (rule: LoyaltyRule) => {
    setEditingRuleId(rule.id);
    setRuleEditForm({
      name: rule.name,
      stampsPerVisit: rule.stampsPerVisit,
      pointsPerCurrency: Number(rule.pointsPerCurrency),
      currencyUnit: Number(rule.currencyUnit),
    });
  };

  const saveRuleEdit = async (id: string) => {
    setError(null);
    try {
      await authFetch(`/loyalty/rules/${id}`, { method: 'PATCH', body: JSON.stringify(ruleEditForm) });
      setEditingRuleId(null);
      loadRules();
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar la regla'));
    }
  };

  const toggleRuleActive = async (rule: LoyaltyRule) => {
    setError(null);
    try {
      if (rule.isActive) {
        await authFetch(`/loyalty/rules/${rule.id}`, { method: 'DELETE' });
      } else {
        await authFetch(`/loyalty/rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) });
      }
      loadRules();
    } catch (err) {
      setError(describeError(err, 'No se pudo cambiar el estado de la regla'));
    }
  };

  const handleCreateReward = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await authFetch('/loyalty/rewards', {
        method: 'POST',
        body: JSON.stringify({
          name: rewardForm.name,
          description: rewardForm.description || undefined,
          stampsCost: rewardForm.stampsCost ? Number(rewardForm.stampsCost) : undefined,
          pointsCost: rewardForm.pointsCost ? Number(rewardForm.pointsCost) : undefined,
          monetaryValue: rewardForm.monetaryValue ? Number(rewardForm.monetaryValue) : undefined,
        }),
      });
      setRewardForm({ name: '', description: '', stampsCost: '', pointsCost: '', monetaryValue: '' });
      loadRewards();
    } catch (err) {
      setError(describeError(err, 'No se pudo crear el premio'));
    }
  };

  const startEditReward = (reward: Reward) => {
    setEditingRewardId(reward.id);
    setRewardEditForm({
      name: reward.name,
      description: reward.description ?? '',
      stampsCost: reward.stampsCost != null ? String(reward.stampsCost) : '',
      pointsCost: reward.pointsCost != null ? String(reward.pointsCost) : '',
      monetaryValue: reward.monetaryValue != null ? String(Number(reward.monetaryValue)) : '',
    });
  };

  const saveRewardEdit = async (id: string) => {
    setError(null);
    try {
      await authFetch(`/loyalty/rewards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: rewardEditForm.name,
          description: rewardEditForm.description || undefined,
          stampsCost: rewardEditForm.stampsCost ? Number(rewardEditForm.stampsCost) : undefined,
          pointsCost: rewardEditForm.pointsCost ? Number(rewardEditForm.pointsCost) : undefined,
          monetaryValue: rewardEditForm.monetaryValue ? Number(rewardEditForm.monetaryValue) : undefined,
        }),
      });
      setEditingRewardId(null);
      loadRewards();
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar el premio'));
    }
  };

  const toggleRewardActive = async (reward: Reward) => {
    setError(null);
    try {
      if (reward.isActive) {
        await authFetch(`/loyalty/rewards/${reward.id}`, { method: 'DELETE' });
      } else {
        await authFetch(`/loyalty/rewards/${reward.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) });
      }
      loadRewards();
    } catch (err) {
      setError(describeError(err, 'No se pudo cambiar el estado del premio'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1>Lealtad</h1>
      {error && <p className="error-text">{error}</p>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Reglas (RF-06/RF-07)</h2>
        <form onSubmit={handleCreateRule} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre"
            required
            value={ruleForm.name}
            onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
          />
          <input
            type="number"
            min={0}
            placeholder="Sellos por visita"
            required
            value={ruleForm.stampsPerVisit}
            onChange={(e) => setRuleForm({ ...ruleForm, stampsPerVisit: Number(e.target.value) })}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Puntos por unidad"
            required
            value={ruleForm.pointsPerCurrency}
            onChange={(e) => setRuleForm({ ...ruleForm, pointsPerCurrency: Number(e.target.value) })}
          />
          <input
            type="number"
            min={0.01}
            step="0.01"
            placeholder="Lempiras por unidad"
            required
            value={ruleForm.currencyUnit}
            onChange={(e) => setRuleForm({ ...ruleForm, currencyUnit: Number(e.target.value) })}
          />
          <button type="submit" className="btn-primary">
            Crear regla activa
          </button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Sellos/visita</th>
              <th>Puntos por L.</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) =>
              editingRuleId === rule.id ? (
                <tr key={rule.id}>
                  <td>
                    <input
                      value={ruleEditForm.name}
                      onChange={(e) => setRuleEditForm({ ...ruleEditForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={ruleEditForm.stampsPerVisit}
                      onChange={(e) => setRuleEditForm({ ...ruleEditForm, stampsPerVisit: Number(e.target.value) })}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={ruleEditForm.pointsPerCurrency}
                      onChange={(e) => setRuleEditForm({ ...ruleEditForm, pointsPerCurrency: Number(e.target.value) })}
                    />
                    <span>por L.</span>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={ruleEditForm.currencyUnit}
                      onChange={(e) => setRuleEditForm({ ...ruleEditForm, currencyUnit: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <span className="badge">{rule.isActive ? 'Activa' : 'Inactiva'}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => saveRuleEdit(rule.id)}>
                      Guardar
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setEditingRuleId(null)}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.stampsPerVisit}</td>
                  <td>
                    {rule.pointsPerCurrency} por L.{rule.currencyUnit}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={
                        rule.isActive
                          ? undefined
                          : { background: 'var(--black-10)', color: 'var(--black-40)' }
                      }
                    >
                      {rule.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => startEditRule(rule)}>
                      Editar
                    </button>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => toggleRuleActive(rule)}>
                      {rule.isActive ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Premios (RF-08)</h2>
        <form onSubmit={handleCreateReward} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre"
            required
            value={rewardForm.name}
            onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
          />
          <input
            placeholder="Descripción (opcional)"
            value={rewardForm.description}
            onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
          />
          <input
            type="number"
            min={1}
            placeholder="Costo en sellos"
            value={rewardForm.stampsCost}
            onChange={(e) => setRewardForm({ ...rewardForm, stampsCost: e.target.value })}
          />
          <input
            type="number"
            min={1}
            placeholder="Costo en puntos"
            value={rewardForm.pointsCost}
            onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor en L. (opcional, para mostrar el ahorro)"
            value={rewardForm.monetaryValue}
            onChange={(e) => setRewardForm({ ...rewardForm, monetaryValue: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Crear premio
          </button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Costo sellos</th>
              <th>Costo puntos</th>
              <th>Valor</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((reward) =>
              editingRewardId === reward.id ? (
                <tr key={reward.id}>
                  <td>
                    <input
                      value={rewardEditForm.name}
                      onChange={(e) => setRewardEditForm({ ...rewardEditForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={rewardEditForm.stampsCost}
                      onChange={(e) => setRewardEditForm({ ...rewardEditForm, stampsCost: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={rewardEditForm.pointsCost}
                      onChange={(e) => setRewardEditForm({ ...rewardEditForm, pointsCost: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={rewardEditForm.monetaryValue}
                      onChange={(e) => setRewardEditForm({ ...rewardEditForm, monetaryValue: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className="badge">{reward.isActive ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => saveRewardEdit(reward.id)}>
                      Guardar
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px' }}
                      onClick={() => setEditingRewardId(null)}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={reward.id}>
                  <td>{reward.name}</td>
                  <td>{reward.stampsCost ?? '—'}</td>
                  <td>{reward.pointsCost ?? '—'}</td>
                  <td>{reward.monetaryValue ? `L. ${Number(reward.monetaryValue).toFixed(2)}` : '—'}</td>
                  <td>
                    <span
                      className="badge"
                      style={
                        reward.isActive
                          ? undefined
                          : { background: 'var(--black-10)', color: 'var(--black-40)' }
                      }
                    >
                      {reward.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px' }}
                      onClick={() => startEditReward(reward)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px' }}
                      onClick={() => toggleRewardActive(reward)}
                    >
                      {reward.isActive ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
