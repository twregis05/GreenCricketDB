import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import ClientModal from '../components/ClientModal';
import api from '../utils/api';
import './Dashboard.css';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [csvMsg, setCsvMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    let list = clients;
    if (statusFilter === 'pending') list = list.filter((c) => c.invoicePending);
    if (statusFilter === 'paid') list = list.filter((c) => !c.invoicePending);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const name = c.clientType === 'group'
          ? (c.groupName || '').toLowerCase()
          : `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const contactMatch = (c.contacts || []).some(
          (ct) => (ct.name || '').toLowerCase().includes(q) || (ct.email || '').toLowerCase().includes(q) || (ct.phone || '').includes(q)
        );
        return name.includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || contactMatch;
      });
    }
    setFiltered(list);
  }, [clients, search, statusFilter]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients');
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (saved) => {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c._id === saved._id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    setSelected(null);
    setShowNew(false);
  };

  const handleDeleted = (id) => {
    setClients((prev) => prev.filter((c) => c._id !== id));
    setSelected(null);
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setCsvMsg('Importing…');
    try {
      const { data } = await api.post('/clients/import/csv', form);
      setCsvMsg(`✓ Imported ${data.imported} client(s)`);
      fetchClients();
    } catch (err) {
      setCsvMsg('Import failed. Check CSV format.');
    }
    e.target.value = '';
    setTimeout(() => setCsvMsg(''), 4000);
  };

  return (
    <div className="page">
      <Navbar />

      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Client Directory</h1>
            <p className="page-subtitle">{clients.length} client{clients.length !== 1 ? 's' : ''} on record</p>
          </div>
          <div className="header-actions">
            <button className="btn-action btn-csv" onClick={() => fileRef.current.click()}>
              ↑ Import CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCsvImport}
            />
            <button className="btn-action btn-add" onClick={() => setShowNew(true)}>
              + Add Client
            </button>
          </div>
        </div>

        {csvMsg && <div className="csv-banner">{csvMsg}</div>}

        <div className="filter-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="status-filter-pills">
            {['all', 'pending', 'paid'].map((s) => (
              <button
                key={s}
                className={`pill ${statusFilter === s ? 'pill-active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Paid'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="state-msg">Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div className="state-msg empty">
            {clients.length === 0
              ? 'No clients yet. Add your first client or import a CSV.'
              : 'No clients match your search.'}
          </div>
        ) : (
          <div className="clients-grid">
            {filtered.map((c) => {
              const isGroup = c.clientType === 'group';
              const name = isGroup ? c.groupName : `${c.firstName} ${c.lastName}`;
              const initials = isGroup
                ? (c.groupName || 'G').slice(0, 2).toUpperCase()
                : `${(c.firstName || '?')[0]}${(c.lastName || '?')[0]}`.toUpperCase();
              const primaryPhone = isGroup ? c.contacts?.[0]?.phone : c.phone;
              const primaryEmail = isGroup ? c.contacts?.[0]?.email : c.email;
              const firstAddress = c.properties?.[0]?.address;
              return (
                <div
                  key={c._id}
                  className={`client-card ${c.invoicePending ? 'pending' : ''}`}
                  onClick={() => setSelected(c)}
                >
                  <div className={`client-avatar ${isGroup ? 'avatar-group' : ''}`}>
                    {initials}
                  </div>
                  <div className="client-info">
                    <div className="client-name-row">
                      <h3 className="client-name">{name}</h3>
                      {isGroup && <span className="card-type-badge">Group</span>}
                    </div>
                    {primaryPhone && <p className="client-detail">{primaryPhone}</p>}
                    {primaryEmail && <p className="client-detail">{primaryEmail}</p>}
                    {firstAddress && <p className="client-detail client-addr">{firstAddress}</p>}
                    {isGroup && c.contacts?.length > 0 && (
                      <p className="client-detail client-addr">{c.contacts.length} contact{c.contacts.length !== 1 ? 's' : ''}</p>
                    )}
                    {c.properties?.length > 1 && (
                      <p className="client-detail client-addr">{c.properties.length} properties</p>
                    )}
                  </div>
                  {c.invoicePending && (
                    <span className="pending-dot" title="Invoice Pending" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <ClientModal
          client={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {showNew && (
        <ClientModal
          client={null}
          onClose={() => setShowNew(false)}
          onSaved={handleSaved}
          onDeleted={() => {}}
        />
      )}
    </div>
  );
}
