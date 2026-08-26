import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../../api/adminApi.js';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

const DAY_LABELS = [
  { value: '1', label: 'Пн' },
  { value: '2', label: 'Вт' },
  { value: '3', label: 'Ср' },
  { value: '4', label: 'Чт' },
  { value: '5', label: 'Пт' },
  { value: '6', label: 'Сб' },
  { value: '0', label: 'Вс' },
];

export default function AdminSettingsLight({ onAuthError }) {
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
      const days = data.workDays.split(',').map((d) => d.trim());
      setWorkDays(new Set(days));
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDay = (day) => {
    setWorkDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) { next.delete(day); } else { next.add(day); }
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
      await updateSettings({ workStart, workEnd, slotStepMinutes: Number(slotStep), workDays: workDaysStr });
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
    return <div className="saas-loading-state"><span>Загрузка настроек...</span></div>;
  }

  return (
    <div className="light-settings-page">
      {error && (
        <div className="saas-alert error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="saas-alert success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="light-settings-form">
        {/* Work Hours Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Рабочие часы</h3>
            <p>Время начала и окончания работы барбершопа</p>
          </div>
          <div className="settings-fields-grid">
            <div className="settings-field-group">
              <label className="settings-field-label">Начало рабочего дня</label>
              <input
                type="time"
                className="settings-input"
                required
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
              />
            </div>
            <div className="settings-field-group">
              <label className="settings-field-label">Конец рабочего дня</label>
              <input
                type="time"
                className="settings-input"
                required
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
              />
            </div>
            <div className="settings-field-group">
              <label className="settings-field-label">Шаг слота (минуты)</label>
              <select
                className="settings-input"
                value={slotStep}
                onChange={(e) => setSlotStep(e.target.value)}
              >
                <option value="15">15 минут</option>
                <option value="20">20 минут</option>
                <option value="30">30 минут</option>
                <option value="45">45 минут</option>
                <option value="60">60 минут</option>
              </select>
            </div>
          </div>
        </div>

        {/* Work Days Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Рабочие дни</h3>
            <p>Выберите дни, когда барбершоп принимает клиентов</p>
          </div>
          <div className="work-days-toggles">
            {DAY_LABELS.map((d) => {
              const isActive = workDays.has(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  className={`day-toggle-btn ${isActive ? 'active' : ''}`}
                  onClick={() => toggleDay(d.value)}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <p className="work-days-hint">
            Выбрано {workDays.size} из 7 дней
          </p>
        </div>

        {/* Submit */}
        <div className="settings-submit-row">
          <button type="submit" className="saas-btn-primary" disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Сохранение...' : 'Сохранить настройки'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
