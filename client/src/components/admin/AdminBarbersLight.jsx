import React, { useEffect, useState, useRef } from 'react';
import {
  getAdminBarbers,
  createBarber,
  updateBarber,
  deleteBarber,
  uploadBarberPhoto,
} from '../../api/adminApi.js';
import { Pencil, Trash2, Plus, X, AlertTriangle, CheckCircle, User, Upload } from 'lucide-react';

export default function AdminBarbersLight({ onAuthError }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null);
  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 4000);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminBarbers();
      setBarbers(data);
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetPhotoState = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditingBarber(null);
    setFormName('');
    setFormSortOrder('0');
    resetPhotoState();
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingBarber(b);
    setFormName(b.name);
    setFormSortOrder(String(b.sortOrder));
    resetPhotoState();
    setPhotoPreview(b.photoUrl || null);
    setModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const sortOrder = Number(formSortOrder);
    try {
      let barberId;
      if (editingBarber) {
        await updateBarber(editingBarber.id, { name: formName, sortOrder });
        barberId = editingBarber.id;
        showToast(`Барбер «${formName}» обновлён`);
      } else {
        const created = await createBarber({ name: formName, photoUrl: '', sortOrder });
        barberId = created.id;
        showToast(`Барбер «${formName}» добавлен`);
      }
      if (photoFile && barberId) {
        await uploadBarberPhoto(barberId, photoFile);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Удалить барбера «${b.name}»?`)) return;
    try {
      const result = await deleteBarber(b.id);
      if (result.deleted) {
        showToast(`Барбер «${b.name}» удалён`);
      } else if (result.archived) {
        showToast(`Барбер «${b.name}» архивирован (есть связанные записи)`, 'warning');
      }
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const handleRestore = async (b) => {
    try {
      await updateBarber(b.id, { isActive: 1 });
      showToast(`Барбер «${b.name}» восстановлен`);
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const active = barbers.filter((b) => b.isActive === 1);
  const inactive = barbers.filter((b) => b.isActive === 0);

  return (
    <div className="light-section-page">
      <div className="section-action-bar">
        <h2 className="section-page-title">Команда барберов</h2>
        <button className="saas-btn-primary" onClick={openCreate}>
          <Plus size={16} />
          <span>Добавить барбера</span>
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
        <div className="saas-loading-state"><span>Загрузка барберов...</span></div>
      ) : (
        <>
          <div className="barbers-cards-grid">
            {active.map((b) => (
              <div key={b.id} className="barber-mgmt-card">
                <div className="barber-mgmt-avatar">
                  {b.photoUrl ? (
                    <img
                      src={b.photoUrl}
                      alt={b.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="barber-mgmt-initials"
                    style={{ display: b.photoUrl ? 'none' : 'flex' }}
                  >
                    {getInitials(b.name)}
                  </div>
                </div>
                <div className="barber-mgmt-info">
                  <h3 className="barber-mgmt-name">{b.name}</h3>
                  <span className="barber-mgmt-role">Мастер барбершопа</span>
                </div>
                <div className="barber-mgmt-footer">
                  <span className="svc-status-badge active">Активен</span>
                  <div className="barber-mgmt-actions">
                    <button className="saas-icon-btn" title="Редактировать" onClick={() => openEdit(b)}>
                      <Pencil size={14} />
                    </button>
                    <button className="saas-icon-btn danger" title="Удалить" onClick={() => handleDelete(b)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {inactive.length > 0 && (
            <>
              <h3 className="section-sub-heading">Архивированные барберы</h3>
              <div className="barbers-cards-grid muted">
                {inactive.map((b) => (
                  <div key={b.id} className="barber-mgmt-card archived">
                    <div className="barber-mgmt-avatar muted">
                      <div className="barber-mgmt-initials" style={{ display: 'flex' }}>
                        {getInitials(b.name)}
                      </div>
                    </div>
                    <div className="barber-mgmt-info">
                      <h3 className="barber-mgmt-name muted">{b.name}</h3>
                      <span className="barber-mgmt-role">Архивирован</span>
                    </div>
                    <div className="barber-mgmt-footer">
                      <span className="svc-status-badge archived">Архив</span>
                      <button className="saas-icon-btn success" title="Восстановить" onClick={() => handleRestore(b)}>
                        <Plus size={14} />
                      </button>
                    </div>
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
              <h3>{editingBarber ? 'Редактировать барбера' : 'Новый барбер'}</h3>
              <button className="saas-icon-btn" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="saas-modal-form">
              {/* Photo upload */}
              <div className="photo-upload-area">
                <div
                  className="photo-preview-circle"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" />
                  ) : (
                    <div className="photo-placeholder">
                      <User size={28} />
                    </div>
                  )}
                  <div className="photo-overlay">
                    <Upload size={16} />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <span className="photo-hint">Нажмите для загрузки фото</span>
              </div>
              <div className="saas-form-field">
                <label>Имя барбера</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Например: Алекс" />
              </div>
              <div className="saas-form-field">
                <label>Порядок сортировки</label>
                <input type="number" required min="0" value={formSortOrder} onChange={(e) => setFormSortOrder(e.target.value)} />
              </div>
              {error && <div className="saas-alert error">{error}</div>}
              <button type="submit" className="saas-btn-primary w-full">
                {editingBarber ? 'Сохранить изменения' : 'Добавить барбера'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
