import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './ClientModal.css';

const EMPTY = {
  clientType: 'individual',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  groupName: '',
  contacts: [],
  properties: [],
  notes: '',
};

const displayName = (c) =>
  c.clientType === 'group' ? c.groupName : `${c.firstName} ${c.lastName}`;

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ClientModal({ client, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(client ? { ...EMPTY, ...client } : EMPTY);
  const [editing, setEditing] = useState(!client);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [schedules, setSchedules] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // Fetch this client's schedule entries whenever viewing (not editing)
  useEffect(() => {
    if (client?._id && !editing) {
      api.get(`/schedules/client/${client._id}`)
        .then(({ data }) => setSchedules(data))
        .catch(() => setSchedules([]));
    }
  }, [client?._id, editing]);

  // Schedule entries for a given property _id
  const schedulesForProperty = (propertyId) =>
    schedules
      .filter((s) => s.propertyId?.toString() === propertyId?.toString())
      .sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // ── Contacts ──────────────────────────────────────────
  const addContact = () =>
    setForm((f) => ({ ...f, contacts: [...f.contacts, { name: '', phone: '', email: '' }] }));

  const removeContact = (i) =>
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));

  const setContact = (i, field) => (e) =>
    setForm((f) => {
      const contacts = [...f.contacts];
      contacts[i] = { ...contacts[i], [field]: e.target.value };
      return { ...f, contacts };
    });

  // ── Properties ────────────────────────────────────────
  const addProperty = () =>
    setForm((f) => ({ ...f, properties: [...f.properties, { label: '', address: '' }] }));

  const removeProperty = (i) =>
    setForm((f) => ({ ...f, properties: f.properties.filter((_, idx) => idx !== i) }));

  const setProperty = (i, field) => (e) =>
    setForm((f) => {
      const properties = [...f.properties];
      properties[i] = { ...properties[i], [field]: e.target.value };
      return { ...f, properties };
    });

  // ── Save ──────────────────────────────────────────────
  const save = async () => {
    if (form.clientType === 'individual') {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setError('First and last name are required.');
        return;
      }
    } else {
      if (!form.groupName.trim()) {
        setError('Group name is required.');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const { data } = client?._id
        ? await api.put(`/clients/${client._id}`, form)
        : await api.post('/clients', form);
      onSaved(data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${displayName(client)}? This cannot be undone.`)) return;
    try {
      await api.delete(`/clients/${client._id}`);
      onDeleted(client._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed.');
    }
  };

  const cancelEdit = () => {
    setForm({ ...EMPTY, ...client });
    setEditing(false);
    setError('');
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card modal-card-lg">
        <div className="modal-header">
          <div className="modal-header-left">
            <h2 className="modal-title">
              {client ? displayName(client) : 'New Client'}
            </h2>
            {client && (
              <span className={`type-badge ${client.clientType === 'group' ? 'type-group' : 'type-individual'}`}>
                {client.clientType === 'group' ? 'Group' : 'Individual'}
              </span>
            )}
          </div>
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

            {client.clientType === 'individual' ? (
              <div className="info-grid">
                <Field label="Phone" value={client.phone} />
                <Field label="Email" value={client.email} />
              </div>
            ) : (
              <Section title="Contacts">
                {(!client.contacts || client.contacts.length === 0) ? (
                  <p className="section-empty">No contacts on record.</p>
                ) : (
                  <div className="contact-list">
                    {client.contacts.map((c, i) => (
                      <div key={i} className="contact-row-view">
                        <span className="contact-name">{c.name || '—'}</span>
                        {c.phone && <span className="contact-detail">{c.phone}</span>}
                        {c.email && <span className="contact-detail">{c.email}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            <Section title="Properties">
              {(!client.properties || client.properties.length === 0) ? (
                <p className="section-empty">No properties on record.</p>
              ) : (
                <div className="property-list">
                  {client.properties.map((p, i) => {
                    const propSchedules = schedulesForProperty(p._id);
                    return (
                      <div key={i} className="property-row-view property-row-expanded">
                        <div className="property-row-header">
                          {p.label && <span className="property-label">{p.label}</span>}
                          <span className="property-address">{p.address || '—'}</span>
                        </div>
                        {propSchedules.length > 0 ? (
                          <div className="property-schedules">
                            {propSchedules.map((s) => (
                              <div key={s._id} className="prop-schedule-pill">
                                <span className="prop-sched-day">{s.dayOfWeek}</span>
                                <span className="prop-sched-sep">·</span>
                                <span className="prop-sched-freq">{s.frequency}</span>
                                <span className="prop-sched-sep">·</span>
                                <span className="prop-sched-route">Route {s.route}</span>
                                {s.notes && (
                                  <span className="prop-sched-notes" title={s.notes}>
                                    — {s.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="property-no-schedule">Not yet scheduled</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {client.notes && (
              <Section title="Notes">
                <p className="notes-text">{client.notes}</p>
              </Section>
            )}

            <div className="field-item" style={{ marginBottom: '1.25rem' }}>
              <span className="field-label">Invoice Status</span>
              <span className={`badge ${client.invoicePending ? 'badge-warning' : 'badge-ok'}`}>
                {client.invoicePending ? 'Pending' : 'Paid / None'}
              </span>
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

            {/* Client type toggle */}
            <div className="type-toggle">
              <button
                className={`type-btn ${form.clientType === 'individual' ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, clientType: 'individual' }))}
                type="button"
              >
                👤 Individual
              </button>
              <button
                className={`type-btn ${form.clientType === 'group' ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, clientType: 'group' }))}
                type="button"
              >
                🏢 Group
              </button>
            </div>

            {/* Individual fields */}
            {form.clientType === 'individual' && (
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
                  <input type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" />
                </div>
              </div>
            )}

            {/* Group fields */}
            {form.clientType === 'group' && (
              <>
                <div className="form-grid">
                  <div className="form-group form-span">
                    <label>Group Name *</label>
                    <input value={form.groupName} onChange={set('groupName')} placeholder="Smith Family / Acme Corp" />
                  </div>
                </div>

                <div className="array-section">
                  <div className="array-section-header">
                    <span className="array-section-title">Contacts</span>
                    <button className="btn-add-row" onClick={addContact} type="button">+ Add Contact</button>
                  </div>
                  {form.contacts.length === 0 && (
                    <p className="section-empty">No contacts yet — click Add Contact.</p>
                  )}
                  {form.contacts.map((c, i) => (
                    <div key={i} className="array-row">
                      <div className="array-row-fields">
                        <input
                          placeholder="Name"
                          value={c.name}
                          onChange={setContact(i, 'name')}
                        />
                        <input
                          placeholder="Phone"
                          value={c.phone}
                          onChange={setContact(i, 'phone')}
                        />
                        <input
                          placeholder="Email"
                          type="email"
                          value={c.email}
                          onChange={setContact(i, 'email')}
                        />
                      </div>
                      <button className="btn-remove-row" onClick={() => removeContact(i)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Properties (all client types) */}
            <div className="array-section">
              <div className="array-section-header">
                <span className="array-section-title">Properties</span>
                <button className="btn-add-row" onClick={addProperty} type="button">+ Add Property</button>
              </div>
              {form.properties.length === 0 && (
                <p className="section-empty">No properties yet — click Add Property.</p>
              )}
              {form.properties.map((p, i) => (
                <div key={i} className="array-row">
                  <div className="array-row-fields property-fields">
                    <input
                      placeholder="Label (e.g. Main, Rental)"
                      value={p.label}
                      onChange={setProperty(i, 'label')}
                      className="property-label-input"
                    />
                    <input
                      placeholder="Full address"
                      value={p.address}
                      onChange={setProperty(i, 'address')}
                      className="property-address-input"
                    />
                  </div>
                  <button className="btn-remove-row" onClick={() => removeProperty(i)} title="Remove">✕</button>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Special Notes</label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                rows={3}
                placeholder="Gate code, dog name, specific instructions…"
              />
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-footer-actions">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : client ? 'Save Changes' : 'Add Client'}
              </button>
              {client && (
                <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="view-section">
      <h4 className="view-section-title">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field-item">
      <span className="field-label">{label}</span>
      <span className="field-value">{value || <em className="field-empty">—</em>}</span>
    </div>
  );
}
