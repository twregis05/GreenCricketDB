import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { clientName } from '../utils/client';
import './Schedule.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQ = ['weekly', 'bi-weekly'];

const BLANK_FORM = {
  clientId: '',
  propertyId: '',
  dayOfWeek: 'Monday',
  frequency: 'weekly',
  route: 1,
  notes: '',
};

// Resolve a schedule entry's property from the populated clientId
const resolveProperty = (entry) => {
  if (!entry.propertyId || !entry.clientId?.properties) return null;
  return entry.clientId.properties.find(
    (p) => p._id?.toString() === entry.propertyId?.toString()
  ) || null;
};

export default function Schedule() {
  const [schedules, setSchedules] = useState([]);
  const [clients, setClients] = useState([]);
  const [routeFilter, setRouteFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/schedules'), api.get('/clients')]).then(([s, c]) => {
      setSchedules(s.data);
      setClients(c.data);
      setLoading(false);
    });
  }, []);

  const set = (field) => (e) => {
    const val = field === 'route' ? Number(e.target.value) : e.target.value;
    // Reset propertyId when client changes
    if (field === 'clientId') {
      setForm((f) => ({ ...f, clientId: val, propertyId: '' }));
    } else {
      setForm((f) => ({ ...f, [field]: val }));
    }
  };

  const openNew = () => {
    setForm(BLANK_FORM);
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({
      clientId: s.clientId._id,
      propertyId: s.propertyId?.toString() || '',
      dayOfWeek: s.dayOfWeek,
      frequency: s.frequency,
      route: s.route,
      notes: s.notes || '',
    });
    setEditId(s._id);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.clientId) { setError('Select a client.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, propertyId: form.propertyId || null };
      if (editId) {
        const { data } = await api.put(`/schedules/${editId}`, payload);
        setSchedules((prev) => prev.map((s) => (s._id === editId ? data : s)));
      } else {
        const { data } = await api.post('/schedules', payload);
        setSchedules((prev) => [...prev, data]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this schedule entry?')) return;
    await api.delete(`/schedules/${id}`);
    setSchedules((prev) => prev.filter((s) => s._id !== id));
  };

  const filtered = schedules.filter(
    (s) => routeFilter === 'all' || s.route === Number(routeFilter)
  );

  // Properties for the currently selected client in the form
  const formClient = clients.find((c) => c._id === form.clientId);
  const formProperties = formClient?.properties || [];

  return (
    <div className="page">
      <Navbar />

      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Lawn Schedule</h1>
            <p className="page-subtitle">Weekly view — organized by route and day</p>
          </div>
          <div className="header-actions">
            <select
              className="route-select no-print"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
            >
              <option value="all">All Routes</option>
              <option value="1">Route 1</option>
              <option value="2">Route 2</option>
            </select>
            <button className="btn-action btn-csv no-print" onClick={() => window.print()}>
              🖨 Print PDF
            </button>
            <button className="btn-action btn-add no-print" onClick={openNew}>
              + Add Entry
            </button>
          </div>
        </div>

        {loading ? (
          <div className="state-msg">Loading schedule…</div>
        ) : (
          <>
            {(routeFilter === 'all' || routeFilter === '1') && (
              <RouteCalendar
                route={1}
                schedules={filtered.filter((s) => s.route === 1)}
                onEdit={openEdit}
                onDelete={remove}
              />
            )}
            {(routeFilter === 'all' || routeFilter === '2') && (
              <RouteCalendar
                route={2}
                schedules={filtered.filter((s) => s.route === 2)}
                onEdit={openEdit}
                onDelete={remove}
              />
            )}
          </>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Edit Schedule Entry' : 'New Schedule Entry'}</h2>
              <button className="btn-icon btn-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {/* Client */}
                <div className="form-group form-span">
                  <label>Client *</label>
                  <select value={form.clientId} onChange={set('clientId')}>
                    <option value="">— Select client —</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {clientName(c)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Property — only shown when the selected client has properties */}
                {form.clientId && (
                  <div className="form-group form-span">
                    <label>Property</label>
                    {formProperties.length === 0 ? (
                      <p className="field-hint">
                        This client has no properties on file.{' '}
                        <em>Add properties on their client profile first.</em>
                      </p>
                    ) : (
                      <select value={form.propertyId} onChange={set('propertyId')}>
                        <option value="">— No specific property —</option>
                        {formProperties.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.label ? `${p.label} — ${p.address}` : p.address}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Day of Week</label>
                  <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                    {DAYS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={form.frequency} onChange={set('frequency')}>
                    {FREQ.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Route</label>
                  <select value={form.route} onChange={set('route')}>
                    <option value={1}>Route 1</option>
                    <option value={2}>Route 2</option>
                  </select>
                </div>
                <div className="form-group form-span">
                  <label>Notes</label>
                  <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Special instructions…" />
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
              <div className="modal-footer-actions">
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Entry'}
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

function RouteCalendar({ route, schedules, onEdit, onDelete }) {
  return (
    <div className="route-section">
      <div className="route-label">
        <span className={`route-badge route-badge-${route}`}>Route {route}</span>
        <span className="route-count">{schedules.length} entr{schedules.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      <div className="calendar-grid">
        {DAYS.map((day) => {
          const entries = schedules.filter((s) => s.dayOfWeek === day);
          return (
            <div key={day} className="cal-day">
              <div className="cal-day-header">{day}</div>
              <div className="cal-day-body">
                {entries.length === 0 ? (
                  <div className="cal-empty">—</div>
                ) : (
                  entries.map((s) => {
                    const property = resolveProperty(s);
                    return (
                      <div key={s._id} className={`cal-entry freq-${s.frequency.replace('-', '')}`}>
                        <div className="cal-entry-name">
                          {clientName(s.clientId)}
                        </div>
                        {property && (
                          <div className="cal-entry-property">
                            📍 {property.label
                              ? <><strong>{property.label}</strong> — {property.address}</>
                              : property.address}
                          </div>
                        )}
                        <div className="cal-entry-meta">
                          <span className="freq-tag">{s.frequency}</span>
                        </div>
                        {s.notes && <div className="cal-entry-notes">{s.notes}</div>}
                        <div className="cal-entry-actions no-print">
                          <button className="cal-btn" onClick={() => onEdit(s)} title="Edit">✏️</button>
                          <button className="cal-btn" onClick={() => onDelete(s._id)} title="Delete">🗑</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
