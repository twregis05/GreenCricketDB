import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ClientSearch from '../components/ClientSearch';
import api from '../utils/api';
import { clientName } from '../utils/client';
import './LawnCuts.css';

const BLANK_FORM = {
  clientId: '',
  propertyId: '',
  cutDate: '',
  cutTime: '',
  notes: '',
};

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const fmtTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function LawnCuts() {
  const { clientId: routeClientId } = useParams();
  const navigate = useNavigate();

  const [clients, setClients]               = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(routeClientId || '');
  const [cuts, setCuts]                     = useState([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [showForm, setShowForm]             = useState(false);
  const [form, setForm]                     = useState(BLANK_FORM);
  const [editId, setEditId]                 = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data));
  }, []);

  useEffect(() => {
    if (!selectedClientId) { setCuts([]); return; }
    setLoading(true);
    api.get(`/lawncuts/client/${selectedClientId}`)
      .then(({ data }) => setCuts(data))
      .finally(() => setLoading(false));
  }, [selectedClientId]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedClient = clients.find((c) => c._id === selectedClientId);
  const clientProperties = selectedClient?.properties || [];

  const filteredCuts = propertyFilter === 'all'
    ? cuts
    : cuts.filter((c) => c.propertyId?.toString() === propertyFilter);

  // Resolve a property object from a cut entry using the already-loaded client
  const resolveProperty = (cut) => {
    if (!cut.propertyId) return null;
    return clientProperties.find((p) => p._id?.toString() === cut.propertyId?.toString()) || null;
  };

  const openNew = () => {
    setForm({ ...BLANK_FORM, clientId: selectedClientId });
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (cut) => {
    setForm({
      clientId: cut.clientId,
      propertyId: cut.propertyId?.toString() || '',
      cutDate: cut.cutDate ? new Date(cut.cutDate).toISOString().slice(0, 10) : '',
      cutTime: cut.cutTime || '',
      notes: cut.notes || '',
    });
    setEditId(cut._id);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.cutDate) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const payload = { ...form, propertyId: form.propertyId || null };
    try {
      if (editId) {
        const { data } = await api.put(`/lawncuts/${editId}`, payload);
        setCuts((prev) => prev.map((c) => (c._id === editId ? data : c)));
      } else {
        const { data } = await api.post('/lawncuts', payload);
        setCuts((prev) => [data, ...prev]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this lawn cut entry?')) return;
    await api.delete(`/lawncuts/${id}`);
    setCuts((prev) => prev.filter((c) => c._id !== id));
  };

  const lastCut = cuts[0] ? fmtDate(cuts[0].cutDate) : '—';

  return (
    <div className="page">
      <Navbar />

      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Lawn Cut Log</h1>
            <p className="page-subtitle">Track every service visit per client</p>
          </div>
        </div>

        {/* Client selector */}
        <div className="client-selector-row">
          <ClientSearch
            clients={clients}
            value={selectedClientId}
            onChange={(id) => {
              setSelectedClientId(id);
              setPropertyFilter('all');
              navigate(id ? `/lawncuts/${id}` : '/lawncuts');
            }}
          />
          {selectedClientId && (
            <button className="btn-action btn-add" onClick={openNew}>
              + Log Cut
            </button>
          )}
        </div>

        {/* Summary + property filter */}
        {selectedClient && (
          <div className="lc-summary">
            <div className="lc-summary-left">
              <div className="lc-avatar">
                {clientName(selectedClient).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="lc-client-name">{clientName(selectedClient)}</div>
                <div className="lc-meta">
                  {cuts.length} cut{cuts.length !== 1 ? 's' : ''} on record
                  {cuts.length > 0 && <> &middot; Last cut: <strong>{lastCut}</strong></>}
                </div>
              </div>
            </div>

            {clientProperties.length > 0 && (
              <div className="lc-filter">
                <label className="lc-filter-label">Filter by property</label>
                <div className="lc-filter-pills">
                  <button
                    className={`pill ${propertyFilter === 'all' ? 'pill-active' : ''}`}
                    onClick={() => setPropertyFilter('all')}
                  >
                    All
                  </button>
                  {clientProperties.map((p) => (
                    <button
                      key={p._id}
                      className={`pill ${propertyFilter === p._id.toString() ? 'pill-active' : ''}`}
                      onClick={() => setPropertyFilter(p._id.toString())}
                    >
                      {p.label || p.address}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cut entries */}
        {!selectedClientId ? (
          <div className="state-msg">Select a client above to view their lawn cut history.</div>
        ) : loading ? (
          <div className="state-msg">Loading entries…</div>
        ) : filteredCuts.length === 0 ? (
          <div className="state-msg empty">
            {cuts.length === 0 ? 'No cuts logged yet for this client.' : 'No cuts match the selected property.'}
          </div>
        ) : (
          <div className="lc-list">
            {filteredCuts.map((cut) => {
              const prop = resolveProperty(cut);
              return (
                <div key={cut._id} className="lc-card">
                  <div className="lc-card-date-col">
                    <div className="lc-date">{fmtDate(cut.cutDate)}</div>
                    {cut.cutTime && <div className="lc-time">{fmtTime(cut.cutTime)}</div>}
                  </div>

                  <div className="lc-card-body">
                    {prop ? (
                      <div className="lc-property">
                        📍 {prop.label
                          ? <><strong>{prop.label}</strong> — {prop.address}</>
                          : prop.address}
                      </div>
                    ) : (
                      <div className="lc-property lc-property-none">No property specified</div>
                    )}
                    {cut.notes && <div className="lc-notes">{cut.notes}</div>}
                  </div>

                  <div className="lc-card-actions">
                    <button className="cal-btn" onClick={() => openEdit(cut)}>✏️</button>
                    <button className="cal-btn danger" onClick={() => remove(cut._id)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Edit Cut Entry' : 'Log Lawn Cut'}</h2>
              <button className="btn-icon btn-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">

                {/* Client */}
                <div className="form-group form-span">
                  <label>Client</label>
                  <select
                    value={form.clientId}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, propertyId: '' }))}
                  >
                    <option value="">— Select —</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>{clientName(c)}</option>
                    ))}
                  </select>
                </div>

                {/* Property */}
                {form.clientId && (() => {
                  const fc = clients.find((c) => c._id === form.clientId);
                  const props = fc?.properties || [];
                  return (
                    <div className="form-group form-span">
                      <label>Property / Location</label>
                      {props.length === 0 ? (
                        <p className="field-hint">No properties on file for this client.</p>
                      ) : (
                        <select value={form.propertyId} onChange={set('propertyId')}>
                          <option value="">— No specific property —</option>
                          {props.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.label ? `${p.label} — ${p.address}` : p.address}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })()}

                {/* Date */}
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" value={form.cutDate} onChange={set('cutDate')} />
                </div>

                {/* Time (optional) */}
                <div className="form-group">
                  <label>Time <span className="optional-label">(optional)</span></label>
                  <input type="time" value={form.cutTime} onChange={set('cutTime')} />
                </div>

                {/* Notes */}
                <div className="form-group form-span">
                  <label>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={set('notes')}
                    rows={3}
                    placeholder="Extra trim, gate was open, equipment used…"
                  />
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
              <div className="modal-footer-actions">
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Log Cut'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
