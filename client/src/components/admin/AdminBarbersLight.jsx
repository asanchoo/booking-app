import React, { useEffect, useState, useRef } from 'react';
import {
  getAdminBarbers,
  createBarber,
  updateBarber,
  deleteBarber,
  uploadBarberPhoto,
  createBarberAccount,
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
  const [formSpecialty, setFormSpecialty] = useState('Мастер салона');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formAccountUsername, setFormAccountUsername] = useState('');
  const [formAccountPassword, setFormAccountPassword] = useState('');
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
    setFormSpecialty('Мастер салона');
    setFormAccountUsername('');
    setFormAccountPassword('');
    resetPhotoState();
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingBarber(b);
    setFormName(b.name);
    setFormSpecialty(b.specialty || 'Мастер салона');
    setFormAccountUsername(b.accountUsername || '');
    setFormAccountPassword('');
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
    const existingUsername = editingBarber?.accountUsername || '';
    const accountChanged = formAccountUsername !== existingUsername || Boolean(formAccountPassword);
    if (accountChanged && (!formAccountUsername || !formAccountPassword)) {
      setError('Для создания или изменения доступа мастера укажите и логин, и пароль');
      return;
    }
    try {
      let barberId;
      if (editingBarber) {
        await updateBarber(editingBarber.id, { name: formName, specialty: formSpecialty });
        barberId = editingBarber.id;
        showToast(`Мастер «${formName}» обновлён`);
      } else {
        const created = await createBarber({ name: formName, photoUrl: '', specialty: formSpecialty });
        barberId = created.id;
        showToast(`Мастер «${formName}» добавлен`);
      }
      if (photoFile && barberId) {
        await uploadBarberPhoto(barberId, photoFile);
      }
      if (accountChanged) {
        await createBarberAccount(barberId, { username: formAccountUsername, password: formAccountPassword });
        showToast(`Доступ мастера «${formAccountUsername}» сохранён`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Удалить мастера «${b.name}»?`)) return;
    try {
      const result = await deleteBarber(b.id);
      if (result.deleted) {
        showToast(`Мастер «${b.name}» удалён`);
      } else if (result.archived) {
        showToast(`Мастер «${b.name}» архивирован (есть связанные записи)`, 'warning');
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
      showToast(`Мастер «${b.name}» восстановлен`);
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
        <h2 className="section-page-title">Команда мастеров</h2>
        <button className="saas-btn-primary" onClick={openCreate}>
          <Plus size={16} />
          <span>Добавить мастера</span>
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
        <div className="saas-loading-state"><span>Загрузка мастеров...</span></div>
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
                  <span className="barber-mgmt-role">{b.specialty || 'Мастер салона'}</span>
                  {b.accountUsername && <span className="barber-mgmt-role">Логин: {b.accountUsername}</span>}
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
              <h3 className="section-sub-heading">Архивированные мастера</h3>
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
              <h3>{editingBarber ? 'Редактировать мастера' : 'Новый мастер'}</h3>
              <button type="button" className="saas-icon-btn" onClick={() => setModalOpen(false)} aria-label="Закрыть окно мастера">
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
                <label>Имя мастера</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Например: Алекс" />
              </div>
              <div className="saas-form-field">
                <label>Роль мастера</label>
                <input
                  type="text"
                  required
                  maxLength="80"
                  list="master-specialties"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  placeholder="Например: Парикмахер"
                />
                <datalist id="master-specialties">
                  <option value="Парикмахер" />
                  <option value="Барбер" />
                  <option value="Мастер маникюра" />
                  <option value="Бровист" />
                  <option value="Визажист" />
                  <option value="Массажист" />
                </datalist>
              </div>
              <div className="saas-form-field">
                <label>Логин для кабинета</label>
                <input type="text" value={formAccountUsername} onChange={(e) => setFormAccountUsername(e.target.value.toLowerCase())} placeholder="например: dias.barber" autoComplete="username" />
              </div>
              <div className="saas-form-field">
                <label>{editingBarber?.accountUsername ? 'Новый пароль' : 'Пароль для входа'}</label>
                <input type="password" value={formAccountPassword} onChange={(e) => setFormAccountPassword(e.target.value)} placeholder="Оставьте пустым, если доступ не нужен" autoComplete="new-password" />
              </div>
              {error && <div className="saas-alert error">{error}</div>}
              <button type="submit" className="saas-btn-primary w-full">
                {editingBarber ? 'Сохранить изменения' : 'Добавить мастера'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
