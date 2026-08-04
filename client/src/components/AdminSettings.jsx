import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/adminApi.js';
import { Save } from 'lucide-react';

const DAY_LABELS = [
  { value: '1', label: 'Пн' },
  { value: '2', label: 'Вт' },
  { value: '3', label: 'Ср' },
  { value: '4', label: 'Чт' },
  { value: '5', label: 'Пт' },
  { value: '6', label: 'Сб' },
  { value: '0', label: 'Вс' },
];

export default function AdminSettings({ onAuthError }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('21:00');
  const [slotStep, setSlotStep] = useState('30');
  const [workDays, setWorkDays] = useState(new Set(['1', '2', '3', '4', '5']));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSettings();
      setWorkStart(data.workStart);
      setWorkEnd(data.workEnd);
      setSlotStep(String(data.slotStepMinutes));
      // Parse work_days CSV "1,2,3,4,5" into Set
      const days = data.workDays.split(',').map((d) => d.trim());
      setWorkDays(new Set(days));
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (day) => {
    setWorkDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const workDaysStr = Array.from(workDays).sort().join(',');
      if (!workDaysStr) {
        setError('Выберите хотя бы один рабочий день');
        setSaving(false);
        return;
      }
      await updateSettings({
        workStart,
        workEnd,
        slotStepMinutes: Number(slotStep),
        workDays: workDaysStr,
      });
      setSuccess('Настройки сохранены!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="table-loading"><span>Загрузка настроек...</span></div>;
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2 className="section-title">Настройки бизнеса</h2>
      </div>

      {error && <div className="admin-error-banner">{error}</div>}
      {success && <div className="admin-success-banner">{success}</div>}

      <form onSubmit={handleSubmit} className="settings-form glass-panel">
        <div className="settings-grid">
          <label className="form-label">
            Начало рабочего дня
            <input type="time" required value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
          </label>
          <label className="form-label">
            Конец рабочего дня
            <input type="time" required value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
          </label>
          <label className="form-label">
            Шаг слота (мин)
            <input type="number" required min="1" value={slotStep} onChange={(e) => setSlotStep(e.target.value)} />
          </label>
        </div>

        <div className="form-label">
          Рабочие дни
          <div className="days-grid">
            {DAY_LABELS.map((d) => (
              <label key={d.value} className={`day-chip ${workDays.has(d.value) ? 'day-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={workDays.has(d.value)}
                  onChange={() => toggleDay(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary btn-full" disabled={saving}>
          <Save size={16} />
          <span>{saving ? 'Сохранение...' : 'Сохранить настройки'}</span>
        </button>
      </form>
    </div>
  );
}
