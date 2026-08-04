import React, { useEffect, useState, useRef } from 'react';
import {
  getAdminBarbers,
  createBarber,
  updateBarber,
  deleteBarber,
  uploadBarberPhoto,
} from '../api/adminApi.js';
import { Pencil, Trash2, Plus, X, AlertTriangle, User, Upload } from 'lucide-react';

export default function AdminBarbers({ onAuthError }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null);

  const [formName, setFormName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
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

  useEffect(() => {
    load();
  }, []);

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
      } else {
        const created = await createBarber({ name: formName, photoUrl: '', sortOrder });
        barberId = created.id;
      }
      // Upload photo if a new file was selected
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
    if (!window.confirm(`Вы уверены, что хотите удалить барбера «${b.name}»?`)) return;
    try {
      const result = await deleteBarber(b.id);
      if (result.deleted) {
        showToast(`Барбер «${b.name}» удалён полностью`);
      } else if (result.archived) {
        showToast(`Удаление невозможно: есть связанные записи. Барбер «${b.name}» архивирован.`);
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
      await load();
    } catch (err) {
      if (err.status === 401) return onAuthError();
      setError(err.message);
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderAvatar = (b, size = 36) => {
    if (b.photoUrl) {
      return (
        <img
          src={b.photoUrl}
          alt={b.name}
          className="barber-avatar"
          style={{ width: size, height: size }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
            if (e.target.nextSibling) {
              e.target.nextSibling.style.display = 'flex';
            }
          }}
        />
      );
    }
    return null;
  };

  const renderInitials = (b, size = 36) => (
    <div
      className="barber-initials"
      style={{ width: size, height: size, display: b.photoUrl ? 'none' : 'flex' }}
    >
      {getInitials(b.name)}
    </div>
  );

  const active = barbers.filter((b) => b.isActive === 1);
  const inactive = barbers.filter((b) => b.isActive === 0);

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2 className="section-title">Управление барберами</h2>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} />
          <span>Добавить барбера</span>
        </button>
      </div>

      {error && <div className="admin-error-banner">{error}</div>}
      {toast && (
        <div className={`admin-toast ${toast.includes('архивирован') ? 'toast-warning' : 'toast-success'}`}>
          {toast.includes('архивирован') && <AlertTriangle size={16} />}
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
                  <th>Фото</th>
                  <th>Имя</th>
                  <th>Порядок</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {active.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="avatar-cell">
                        {renderAvatar(b)}
                        {renderInitials(b, 36)}
                      </div>
                    </td>
                    <td className="cell-bold">{b.name}</td>
                    <td>{b.sortOrder}</td>
                    <td><span className="status-pill confirmed">Активен</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" title="Редактировать" onClick={() => openEdit(b)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Удалить" onClick={() => handleDelete(b)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inactive.length > 0 && (
            <>
              <h3 className="subsection-title">Архивированные барберы</h3>
              <div className="table-responsive">
                <table className="admin-table table-muted">
                  <thead>
                    <tr>
                      <th>Фото</th>
                      <th>Имя</th>
                      <th>Порядок</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactive.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div className="avatar-cell">
                            {renderAvatar(b)}
                            {renderInitials(b, 36)}
                          </div>
                        </td>
                        <td className="cell-bold cell-dim">{b.name}</td>
                        <td>{b.sortOrder}</td>
                        <td><span className="status-pill cancelled">Архив</span></td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-icon btn-icon-success" title="Восстановить" onClick={() => handleRestore(b)}>
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

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingBarber ? 'Редактировать барбера' : 'Новый барбер'}</h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
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
                      <User size={32} />
                    </div>
                  )}
                  <div className="photo-overlay">
                    <Upload size={18} />
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

              <label className="form-label">
                Имя
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} />
              </label>
              <label className="form-label">
                Порядок сортировки
                <input type="number" required min="0" value={formSortOrder} onChange={(e) => setFormSortOrder(e.target.value)} />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn-primary btn-full">
                {editingBarber ? 'Сохранить' : 'Создать'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
