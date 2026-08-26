import React, { useEffect, useState } from 'react';
import {
  getAdminServices,
  createService,
  updateService,
  deleteService,
} from '../api/adminApi.js';
import { Pencil, Trash2, Plus, X, AlertTriangle } from 'lucide-react';

export default function AdminServices({ onAuthError }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formPrice, setFormPrice] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminServices();
      setServices(data);
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

  const openCreate = () => {
    setEditingService(null);
    setFormName('');
    setFormDuration('');
    setFormPrice('');
    setModalOpen(true);
  };

  const openEdit = (svc) => {
    setEditingService(svc);
    setFormName(svc.name);
    setFormDuration(String(svc.durationMinutes));
    setFormPrice(String(svc.priceCents / 100));
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const priceCents = Math.round(Number(formPrice) * 100);
    const durationMinutes = Number(formDuration);
    try {
      if (editingService) {
        await updateService(editingService.id, {
          name: formName,
          durationMinutes,
          priceCents,
        });
      } else {
        await createService({ name: formName, durationMinutes, priceCents });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const handleDelete = async (svc) => {
    if (!window.confirm(`Вы уверены, что хотите удалить услугу «${svc.name}»?`)) return;
    try {
      const result = await deleteService(svc.id);
      if (result.deleted) {
        // Physically removed — remove from local state completely
        showToast(`Услуга «${svc.name}» удалена полностью`);
      } else if (result.archived) {
        // Soft-deleted — show notification
        showToast(`Удаление невозможно: есть связанные записи. Услуга «${svc.name}» архивирована.`);
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
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const activeServices = services.filter((s) => s.isActive === 1);
  const inactiveServices = services.filter((s) => s.isActive === 0);

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2 className="section-title">Управление услугами</h2>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} />
          <span>Добавить услугу</span>
        </button>
      </div>

      {error && <div className="admin-error-banner">{error}</div>}
      {toast && (
        <div className={`admin-toast ${toast.includes('архивирована') ? 'toast-warning' : 'toast-success'}`}>
          {toast.includes('архивирована') && <AlertTriangle size={16} />}
          <span>{toast}</span>
        </div>
      )}

      {loading ? (
        <div className="table-loading"><span>Загрузка...</span></div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Длительность</th>
                  <th>Цена</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {activeServices.map((svc) => (
                  <tr key={svc.id}>
                    <td className="cell-bold">{svc.name}</td>
                    <td>{svc.durationMinutes} мин</td>
                    <td>{(svc.priceCents / 100).toLocaleString('ru-RU')} ₸</td>
                    <td><span className="status-pill confirmed">Активна</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" title="Редактировать" onClick={() => openEdit(svc)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Удалить" onClick={() => handleDelete(svc)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inactiveServices.length > 0 && (
            <>
              <h3 className="subsection-title">Архивированные услуги</h3>
              <div className="table-responsive">
                <table className="admin-table table-muted">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Длительность</th>
                      <th>Цена</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveServices.map((svc) => (
                      <tr key={svc.id}>
                        <td className="cell-bold cell-dim">{svc.name}</td>
                        <td>{svc.durationMinutes} мин</td>
                        <td>{(svc.priceCents / 100).toLocaleString('ru-RU')} ₸</td>
                        <td><span className="status-pill cancelled">Архив</span></td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-icon btn-icon-success" title="Восстановить" onClick={() => handleRestore(svc)}>
                              <Plus size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingService ? 'Редактировать услугу' : 'Новая услуга'}</h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <label className="form-label">
                Название
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              </label>
              <label className="form-label">
                Длительность (мин)
                <input type="number" required min="1" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} />
              </label>
              <label className="form-label">
                Цена (₸)
                <input type="number" required min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn-primary btn-full">
                {editingService ? 'Сохранить' : 'Создать'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
