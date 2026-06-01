import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './ClientModal.css';

const EMPTY = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  invoicePending: false,
};

export default function ClientModal({ client, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(client || EMPTY);
  const [editing, setEditing] = useState(!client);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved;
      if (client?._id) {
        const { data } = await api.put(`/clients/${client._id}`, form);
        saved = data;
      } else {
        const { data } = await api.post('/clients', form);
        saved = data;
      }
      onSaved(saved);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${client.firstName} ${client.lastName}? This cannot be undone.`)) return;
    try {
      await api.delete(`/clients/${client._id}`);
      onDeleted(client._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">
            {client ? `${client.firstName} ${client.lastName}` : 'New Client'}
          </h2>
          <div className="modal-header-actions">
            {client && !editing && (
              <button className="btn-icon" onClick={() => setEditing(true)} title="Edit">✏️</button>
            )}
            <button className="btn-icon btn-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {client && !editing ? (
          /* ── View mode ── */
          <div className="modal-body">
            <div className="info-grid">
              <Field label="Phone" value={client.phone} />
              <Field label="Email" value={client.email} />
              <Field label="Address" value={client.address} span />
              <Field label="Special Notes" value={client.notes} span />
              <div className="field-item">
                <span className="field-label">Invoice Status</span>
                <span className={`badge ${client.invoicePending ? 'badge-warning' : 'badge-ok'}`}>
                  {client.invoicePending ? 'Pending' : 'Paid / None'}
                </span>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                className="btn btn-primary"
                onClick={() => { navigate(`/payments/${client._id}`); onClose(); }}
              >
                View Invoices
              </button>
              <button className="btn btn-danger-outline" onClick={remove}>
                Delete Client
              </button>
            </div>
          </div>
        ) : (
          /* ── Edit / Create mode ── */
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input value={form.firstName} onChange={set('firstName')} placeholder="Jane" />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input value={form.lastName} onChange={set('lastName')} placeholder="Smith" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={form.email} onChange={set('email')} placeholder="jane@example.com" type="email" />
              </div>
              <div className="form-group form-span">
                <label>Address</label>
                <input value={form.address} onChange={set('address')} placeholder="123 Main St, City, ST 00000" />
              </div>
              <div className="form-group form-span">
                <label>Special Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Gate code, dog name, specific instructions…" />
              </div>
              <div className="form-group form-span form-check">
                <input
                  type="checkbox"
                  id="invoicePending"
                  checked={form.invoicePending}
                  onChange={set('invoicePending')}
                />
                <label htmlFor="invoicePending">Invoice Pending</label>
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-footer-actions">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : client ? 'Save Changes' : 'Add Client'}
              </button>
              {client && (
                <button className="btn btn-ghost" onClick={() => { setForm(client); setEditing(false); setError(''); }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, span }) {
  return (
    <div className={`field-item${span ? ' field-span' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-value">{value || <em className="field-empty">—</em>}</span>
    </div>
  );
}
