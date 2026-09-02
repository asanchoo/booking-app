import React, { useEffect, useState } from 'react';
import {
  getAdminServices,
  createService,
  updateService,
  deleteService,
  getAdminBarbers,
} from '../../api/adminApi.js';
import { Pencil, Trash2, Plus, X, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';

export default function AdminServicesLight({ onAuthError }) {
  const [services, setServices] = useState([]);
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMasterIds, setFormMasterIds] = useState([]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 4000);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [servicesData, mastersData] = await Promise.all([getAdminServices(), getAdminBarbers()]);
      setServices(servicesData);
      setMasters(mastersData.filter((master) => master.isActive === 1));
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingService(null);
    setFormName('');
    setFormDuration('');
    setFormPrice('');
    setFormDescription('');
    setFormMasterIds([]);
    setModalOpen(true);
  };

  const openEdit = (svc) => {
    setEditingService(svc);
    setFormName(svc.name);
    setFormDuration(String(svc.durationMinutes));
    setFormPrice(String(svc.priceCents / 100));
    setFormDescription(svc.description || '');
    setFormMasterIds(svc.masterIds || []);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const priceCents = Math.round(Number(formPrice) * 100);
    const durationMinutes = Number(formDuration);
    try {
      if (editingService) {
        await updateService(editingService.id, { name: formName, description: formDescription, durationMinutes, priceCents, masterIds: formMasterIds });
        showToast(`Услуга «${formName}» обновлена`);
      } else {
        await createService({ name: formName, description: formDescription, durationMinutes, priceCents, masterIds: formMasterIds });
        showToast(`Услуга «${formName}» создана`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const handleDelete = async (svc) => {
    if (!window.confirm(`Удалить услугу «${svc.name}»?`)) return;
    try {
      const result = await deleteService(svc.id);
      if (result.deleted) {
        showToast(`Услуга «${svc.name}» удалена`);
      } else if (result.archived) {
        showToast(`Услуга «${svc.name}» архивирована (есть связанные записи)`, 'warning');
      }
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const handleRestore = async (svc) => {
    try {
      await updateService(svc.id, { isActive: 1 });
      showToast(`Услуга «${svc.name}» восстановлена`);
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const activeServices = services.filter((s) => s.isActive === 1);
  const inactiveServices = services.filter((s) => s.isActive === 0);

  return (
    <div className="light-section-page">
      {/* Page action row */}
      <div className="section-action-bar">
        <h2 className="section-page-title">Услуги и прайс</h2>
        <button className="saas-btn-primary" onClick={openCreate}>
          <Plus size={16} />
          <span>Добавить услугу</span>
        </button>
      </div>

      {error && <div className="saas-alert error"><span>{error}</span></div>}
      {toast.msg && (
        <div className={`saas-alert ${toast.type}`}>
          {toast.type === 'warning' ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {loading ? (
        <div className="saas-loading-state"><span>Загрузка услуг...</span></div>
      ) : (
        <>
          {/* Active Services Cards */}
          <div className="services-cards-grid">
            {activeServices.map((svc) => (
              <div key={svc.id} className="service-mgmt-card">
                <div className="svc-card-top">
                  <div className="svc-card-actions">
                    <button className="saas-icon-btn" title="Редактировать" onClick={() => openEdit(svc)}>
                      <Pencil size={14} />
                    </button>
                    <button className="saas-icon-btn danger" title="Удалить" onClick={() => handleDelete(svc)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="svc-card-name">{svc.name}</h3>
                {svc.description && <p className="svc-card-description">{svc.description}</p>}
                <div className="svc-card-meta">
                  <span className="svc-meta-item">
                    <Clock size={13} /> {svc.durationMinutes} мин
                  </span>
                  <span className="svc-meta-item price">
                    <DollarSign size={13} /> {(svc.priceCents / 100).toLocaleString('ru-RU')} ₸
                  </span>
                </div>
                <p className="svc-card-description">Мастера: {svc.masters?.map((master) => master.name).join(', ') || 'не назначены'}</p>
                <span className="svc-status-badge active">Активна</span>
              </div>
            ))}
          </div>

          {/* Archived Services */}
          {inactiveServices.length > 0 && (
            <>
              <h3 className="section-sub-heading">Архивированные услуги</h3>
              <div className="services-cards-grid muted">
                {inactiveServices.map((svc) => (
                  <div key={svc.id} className="service-mgmt-card archived">
                    <div className="svc-card-top">
                      <div className="svc-card-actions">
                        <button className="saas-icon-btn success" title="Восстановить" onClick={() => handleRestore(svc)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <h3 className="svc-card-name muted">{svc.name}</h3>
                    <div className="svc-card-meta">
                      <span className="svc-meta-item"><Clock size={13} /> {svc.durationMinutes} мин</span>
                    </div>
                    <span className="svc-status-badge archived">Архив</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="saas-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="saas-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>{editingService ? 'Редактировать услугу' : 'Новая услуга'}</h3>
              <button className="saas-icon-btn" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="saas-modal-form">
              <div className="saas-form-field">
                <label>Название услуги</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Например: Стрижка" />
              </div>
              <div className="saas-form-field">
                <label>Описание услуги</label>
                <textarea maxLength="500" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Кратко расскажите, что входит в услугу" rows="3" />
              </div>
              <div className="saas-form-field">
                <label>Длительность (мин)</label>
                <input type="number" required min="1" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} placeholder="30" />
              </div>
              <div className="saas-form-field">
                <label>Цена (₸)</label>
                <input type="number" required min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="1500" />
              </div>
              <div className="saas-form-field">
                <label>Мастера, выполняющие услугу</label>
                {masters.length === 0 ? (
                  <p className="svc-card-description">Сначала добавьте хотя бы одного активного мастера.</p>
                ) : masters.map((master) => (
                  <label key={master.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={formMasterIds.includes(master.id)}
                      onChange={(e) => setFormMasterIds((ids) => e.target.checked ? [...ids, master.id] : ids.filter((id) => id !== master.id))}
                    />
                    {master.name}
                  </label>
                ))}
              </div>
              {error && <div className="saas-alert error">{error}</div>}
              <button type="submit" className="saas-btn-primary w-full">
                {editingService ? 'Сохранить изменения' : 'Создать услугу'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
