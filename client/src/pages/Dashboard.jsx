import { useState, useEffect, useRef, useMemo } from 'react';
import Navbar from '../components/Navbar';
import ClientModal from '../components/ClientModal';
import api from '../utils/api';
import { clientName, clientInitials, primaryContact } from '../utils/client';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import './Dashboard.css';

const ALL_CLIENT_EXPORT_COLS = [
  'Client', 'Group', 'Client Type', 'Primary Email', 'Primary Contact',
  'Contact Name', 'Contact Phone', 'Contact Email', 'Contact Type',
  'Primary Address', 'All Properties', 'Property Count',
  'Invoice Status', 'Invoice Pending',
  'Total Billed', 'Total Paid', 'Balance', 'Credit',
  'Invoice Count', 'Last Invoice Date',
  'Notes', 'Date Added',
];

// Most-urgent-first; a client takes the first status any of its invoices has.
const CLIENT_STATUS_PRIORITY = ['overdue', 'pending', 'processing', 'overpaid', 'paid'];

export default function Dashboard() {
  const { canEdit } = useAuth();
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy]   = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [csvMsg, setCsvMsg] = useState('');
  const fileRef = useRef();

  // Advanced search
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [allInvoices, setAllInvoices]     = useState([]);
  const [invLoading, setInvLoading]       = useState(false);
  const [advQ, setAdvQ]                   = useState('');
  const [advType, setAdvType]             = useState('all');
  const [advStatus, setAdvStatus]         = useState('all');
  const [advPending, setAdvPending]       = useState('all');
  const [advHasProps, setAdvHasProps]     = useState('all');
  const [advContactInfo, setAdvContactInfo] = useState('all');
  const [advMinBal, setAdvMinBal]         = useState('');
  const [advMaxBal, setAdvMaxBal]         = useState('');
  const [advHasCredit, setAdvHasCredit]   = useState('all');
  const [advSortBy, setAdvSortBy]         = useState('name');
  const [advSortDir, setAdvSortDir]       = useState('asc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCols, setExportCols]       = useState(new Set(ALL_CLIENT_EXPORT_COLS));
  const [exportScope, setExportScope]     = useState('filtered');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    let list = [...clients];
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
        const addressMatch = (c.properties || []).some(
          (p) => (p.address || '').toLowerCase().includes(q) || (p.label || '').toLowerCase().includes(q)
        );
        return name.includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || contactMatch || addressMatch;
      });
    }
    const clientDisplayName = (c) => c.clientType === 'group'
      ? (c.groupName || '')
      : `${c.lastName || ''} ${c.firstName || ''}`.trim();
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = clientDisplayName(a).localeCompare(clientDisplayName(b));
      } else if (sortBy === 'dateAdded') {
        cmp = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      } else if (sortBy === 'status') {
        cmp = (b.invoicePending ? 1 : 0) - (a.invoicePending ? 1 : 0);
      } else if (sortBy === 'properties') {
        cmp = (a.properties?.length || 0) - (b.properties?.length || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    setFiltered(list);
  }, [clients, search, statusFilter, sortBy, sortDir]);

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

  const loadAllInvoices = async () => {
    setInvLoading(true);
    try {
      const { data } = await api.get('/invoices');
      setAllInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setInvLoading(false);
    }
  };

  const invStatus = (inv) => {
    const due  = inv.amountDue  || 0;
    const paid = inv.amountPaid || 0;
    if (paid > due)  return 'overpaid';
    if (paid >= due) return 'paid';
    if (inv.paymentProcessing) return 'processing';
    if (inv.dateSent) {
      const daysSince = (Date.now() - new Date(inv.dateSent).getTime()) / 86400000;
      if (daysSince > 3) return 'overdue';
    }
    return 'pending';
  };

  // clientId -> rolled-up invoice totals
  const invoiceStats = useMemo(() => {
    const map = new Map();
    allInvoices.forEach((inv) => {
      const cid = (inv.clientId?._id || inv.clientId)?.toString();
      if (!cid) return;
      if (!map.has(cid)) {
        map.set(cid, { count: 0, billed: 0, paid: 0, balance: 0, credit: 0, statuses: new Set(), lastSent: null });
      }
      const s    = map.get(cid);
      const due  = inv.amountDue  || 0;
      const paid = inv.amountPaid || 0;
      s.count   += 1;
      s.billed  += due;
      s.paid    += paid;
      s.balance += Math.max(0, due - paid);
      s.credit  += Math.max(0, paid - due);
      s.statuses.add(invStatus(inv));
      const sent = inv.dateSent ? new Date(inv.dateSent).getTime() : 0;
      if (sent && (!s.lastSent || sent > s.lastSent)) s.lastSent = sent;
    });
    return map;
  }, [allInvoices]);

  const statsFor = (c) => {
    const s = invoiceStats.get(c._id?.toString());
    const manual = c.manualCredit || 0;
    if (!s) return { count: 0, billed: 0, paid: 0, balance: 0, credit: manual, lastSent: null, status: 'none' };
    return {
      ...s,
      credit: s.credit + manual,
      status: CLIENT_STATUS_PRIORITY.find((st) => s.statuses.has(st)) || 'none',
    };
  };

  const advFiltered = useMemo(() => {
    const list = clients.filter((c) => {
      const st = statsFor(c);
      if (advQ) {
        const q = advQ.toLowerCase();
        const nameMatch = clientName(c).toLowerCase().includes(q);
        const contactMatch = (c.contacts || []).some(
          (ct) => (ct.name || '').toLowerCase().includes(q) || (ct.email || '').toLowerCase().includes(q) || (ct.phone || '').includes(q)
        );
        const propMatch = (c.properties || []).some(
          (p) => (p.address || '').toLowerCase().includes(q) || (p.label || '').toLowerCase().includes(q)
        );
        const ok = nameMatch || contactMatch || propMatch
          || (c.email || '').toLowerCase().includes(q)
          || (c.phone || '').includes(q)
          || (c.notes || '').toLowerCase().includes(q);
        if (!ok) return false;
      }
      if (advType   !== 'all' && (c.clientType || 'individual') !== advType) return false;
      if (advStatus !== 'all' && st.status !== advStatus)                    return false;
      if (advPending === 'yes' && !c.invoicePending)                         return false;
      if (advPending === 'no'  &&  c.invoicePending)                         return false;

      const propCount = (c.properties || []).length;
      if (advHasProps === 'yes' && propCount === 0)                          return false;
      if (advHasProps === 'no'  && propCount  >  0)                          return false;

      if (advContactInfo !== 'all') {
        const emails = [c.email, ...(c.contacts || []).map((ct) => ct.email)].filter(Boolean);
        const phones = [c.phone, ...(c.contacts || []).map((ct) => ct.phone)].filter(Boolean);
        if (advContactInfo === 'noEmail' && emails.length > 0)               return false;
        if (advContactInfo === 'noPhone' && phones.length > 0)               return false;
        if (advContactInfo === 'complete' && (emails.length === 0 || phones.length === 0)) return false;
      }

      if (advMinBal !== '' && st.balance < Number(advMinBal))                return false;
      if (advMaxBal !== '' && st.balance > Number(advMaxBal))                return false;
      if (advHasCredit === 'yes' && st.credit <= 0)                          return false;
      if (advHasCredit === 'no'  && st.credit  > 0)                          return false;
      return true;
    });

    const sortName = (c) => c.clientType === 'group'
      ? (c.groupName || '')
      : `${c.lastName || ''} ${c.firstName || ''}`.trim();

    return list.sort((a, b) => {
      const dir = advSortDir === 'asc' ? 1 : -1;
      const sa = statsFor(a);
      const sb = statsFor(b);
      switch (advSortBy) {
        case 'dateAdded':   return (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) * dir;
        case 'balance':     return (sa.balance - sb.balance) * dir;
        case 'credit':      return (sa.credit - sb.credit) * dir;
        case 'invoices':    return (sa.count - sb.count) * dir;
        case 'properties':  return (((a.properties || []).length) - ((b.properties || []).length)) * dir;
        case 'lastInvoice': return ((sa.lastSent || 0) - (sb.lastSent || 0)) * dir;
        case 'name':
        default:            return sortName(a).localeCompare(sortName(b)) * dir;
      }
    });
  }, [clients, invoiceStats, advQ, advType, advStatus, advPending, advHasProps,
      advContactInfo, advMinBal, advMaxBal, advHasCredit, advSortBy, advSortDir]);

  const resetAdvFilters = () => {
    setAdvQ(''); setAdvType('all'); setAdvStatus('all'); setAdvPending('all');
    setAdvHasProps('all'); setAdvContactInfo('all'); setAdvMinBal(''); setAdvMaxBal('');
    setAdvHasCredit('all'); setAdvSortBy('name'); setAdvSortDir('asc');
  };

  // One row per contact so every group contact is listed, but never fewer than
  // one row per client — clients with no contacts still get a row.
  const buildExportRows = (list) => {
    const fmtD = (v) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '');
    const rows = [];

    list.forEach((c) => {
      const isGroup   = c.clientType === 'group';
      const st        = statsFor(c);
      const props     = c.properties || [];
      const propText  = (p) => (p.label ? `${p.label} — ${p.address || ''}` : (p.address || ''));
      const primary   = isGroup ? primaryContact(c) : null;
      const base = {
        'Client':           clientName(c),
        'Group':            isGroup ? (c.groupName || 'Unnamed Group') : 'N/A',
        'Client Type':      isGroup ? 'Group' : 'Individual',
        'Primary Email':    c.email || '',
        'Primary Contact':  isGroup ? (primary?.name || '') : clientName(c),
        'Primary Address':  props[0]?.address || '',
        'All Properties':   props.map(propText).filter(Boolean).join('; '),
        'Property Count':   props.length,
        'Invoice Status':   st.status === 'none' ? 'No Invoices' : st.status.charAt(0).toUpperCase() + st.status.slice(1),
        'Invoice Pending':  c.invoicePending ? 'Yes' : 'No',
        'Total Billed':     st.billed,
        'Total Paid':       st.paid,
        'Balance':          st.balance,
        'Credit':           st.credit,
        'Invoice Count':    st.count,
        'Last Invoice Date': st.lastSent ? fmtD(new Date(st.lastSent)) : '',
        'Notes':            c.notes || '',
        'Date Added':       fmtD(c.createdAt),
      };
      const contactRow = (name, phone, email, type) => ({
        ...base,
        'Contact Name':  name  || '',
        'Contact Phone': phone || '',
        'Contact Email': email || '',
        'Contact Type':  type,
      });

      if (!isGroup) rows.push(contactRow(clientName(c), c.phone, c.email, 'Primary'));
      (c.contacts || []).forEach((ct) =>
        rows.push(contactRow(ct.name, ct.phone, ct.email, ct === primary ? 'Primary Contact' : 'Contact'))
      );
      if (isGroup && (c.contacts || []).length === 0) rows.push(contactRow('', '', '', ''));
    });

    return rows;
  };

  const exportExcel = (cols, scope) => {
    const source  = scope === 'all' ? clients : advFiltered;
    const allRows = buildExportRows(source);
    const ordered = ALL_CLIENT_EXPORT_COLS.filter((c) => cols.has(c));
    const rows    = allRows.map((row) => Object.fromEntries(ordered.map((c) => [c, row[c]])));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length)) + 2,
    }));

    ['Total Billed', 'Total Paid', 'Balance', 'Credit'].forEach((col) => {
      const ci = headers.indexOf(col);
      if (ci === -1) return;
      const colLetter = XLSX.utils.encode_col(ci);
      for (let ri = 1; ri <= rows.length; ri++) {
        const ref = `${colLetter}${ri + 1}`;
        if (ws[ref]) ws[ref].z = '0.00';
      }
    });

    XLSX.writeFile(wb, `clients-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            <button
              className="btn-action"
              onClick={() => {
                if (showAdvSearch) {
                  setShowAdvSearch(false);
                } else {
                  setShowAdvSearch(true);
                  if (allInvoices.length === 0) loadAllInvoices();
                }
              }}
            >
              {showAdvSearch ? '← Directory' : '⚲ Advanced Search'}
            </button>
            {canEdit && (
              <>
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
              </>
            )}
          </div>
        </div>

        {csvMsg && <div className="csv-banner">{csvMsg}</div>}

        {showAdvSearch && (
          <div className="adv-search-section">
            <div className="adv-filter-card">
              <input
                className="adv-search-input"
                type="text"
                placeholder="Search by client name, contact, address, or notes…"
                value={advQ}
                onChange={(e) => setAdvQ(e.target.value)}
              />
              <div className="adv-filter-row">
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Invoice Status</label>
                  <div className="adv-pills">
                    {['all', 'overdue', 'pending', 'processing', 'paid', 'overpaid', 'none'].map((s) => (
                      <button
                        key={s}
                        className={`pill ${advStatus === s ? 'pill-active' : ''}`}
                        onClick={() => setAdvStatus(s)}
                      >
                        {s === 'all' ? 'All' : s === 'none' ? 'No Invoices' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Client Type</label>
                  <div className="adv-pills">
                    {[['all', 'All'], ['individual', 'Individuals'], ['group', 'Groups']].map(([v, l]) => (
                      <button key={v} className={`pill ${advType === v ? 'pill-active' : ''}`} onClick={() => setAdvType(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Invoice Pending Flag</label>
                  <div className="adv-pills">
                    {[['all', 'All'], ['yes', 'Yes'], ['no', 'No']].map(([v, l]) => (
                      <button key={v} className={`pill ${advPending === v ? 'pill-active' : ''}`} onClick={() => setAdvPending(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Has Properties</label>
                  <div className="adv-pills">
                    {[['all', 'All'], ['yes', 'Yes'], ['no', 'None']].map(([v, l]) => (
                      <button key={v} className={`pill ${advHasProps === v ? 'pill-active' : ''}`} onClick={() => setAdvHasProps(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Contact Info</label>
                  <select className="adv-select" value={advContactInfo} onChange={(e) => setAdvContactInfo(e.target.value)}>
                    <option value="all">All</option>
                    <option value="complete">Has email &amp; phone</option>
                    <option value="noEmail">Missing email</option>
                    <option value="noPhone">Missing phone</option>
                  </select>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Outstanding Balance</label>
                  <div className="adv-range-row">
                    <input
                      className="adv-range-input"
                      type="number" min="0" step="0.01" placeholder="Min"
                      value={advMinBal}
                      onChange={(e) => setAdvMinBal(e.target.value)}
                    />
                    <span className="adv-range-sep">–</span>
                    <input
                      className="adv-range-input"
                      type="number" min="0" step="0.01" placeholder="Max"
                      value={advMaxBal}
                      onChange={(e) => setAdvMaxBal(e.target.value)}
                    />
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Has Credit</label>
                  <div className="adv-pills">
                    {[['all', 'All'], ['yes', 'Yes'], ['no', 'No']].map(([v, l]) => (
                      <button key={v} className={`pill ${advHasCredit === v ? 'pill-active' : ''}`} onClick={() => setAdvHasCredit(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group adv-sort-group">
                  <label className="adv-filter-label">Sort By</label>
                  <div className="adv-range-row">
                    <select className="adv-select" value={advSortBy} onChange={(e) => setAdvSortBy(e.target.value)}>
                      <option value="name">Name</option>
                      <option value="dateAdded">Date Added</option>
                      <option value="balance">Balance</option>
                      <option value="credit">Credit</option>
                      <option value="invoices"># Invoices</option>
                      <option value="properties"># Properties</option>
                      <option value="lastInvoice">Last Invoice</option>
                    </select>
                    <button
                      className="adv-sort-dir"
                      onClick={() => setAdvSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      title={advSortDir === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {advSortDir === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">&nbsp;</label>
                  <button className="btn-text-sm" onClick={resetAdvFilters}>Reset filters</button>
                </div>
              </div>
            </div>

            {invLoading ? (
              <div className="state-msg">Loading invoice data…</div>
            ) : (
              <>
                <div className="adv-results-bar">
                  <p className="adv-result-count">
                    {advFiltered.length} client{advFiltered.length !== 1 ? 's' : ''} found
                    {clients.length !== advFiltered.length && ` (of ${clients.length} total)`}
                  </p>
                  <button className="btn-action btn-export" onClick={() => setShowExportModal(true)}>
                    ↓ Export Excel
                  </button>
                </div>
                {advFiltered.length === 0 ? (
                  <div className="state-msg empty">No clients match your filters.</div>
                ) : (
                  <div className="adv-client-list">
                    {advFiltered.map((c) => {
                      const st       = statsFor(c);
                      const isGroup  = c.clientType === 'group';
                      const props    = c.properties || [];
                      const contacts = c.contacts   || [];
                      const primary  = isGroup ? primaryContact(c) : null;
                      const groupEmail = c.email || primary?.email;
                      return (
                        <div key={c._id} className="adv-client-card" onClick={() => setSelected(c)}>
                          <div className={`adv-client-avatar ${isGroup ? 'avatar-group' : ''}`}>
                            {clientInitials(c)}
                          </div>
                          <div className="adv-client-body">
                            <div className="adv-client-title-row">
                              <span className="adv-client-name">{clientName(c)}</span>
                              {isGroup && <span className="card-type-badge">Group</span>}
                              <span className={`adv-status-badge adv-status-${st.status}`}>
                                {st.status === 'none' ? 'No Invoices' : st.status.charAt(0).toUpperCase() + st.status.slice(1)}
                              </span>
                            </div>
                            <div className="adv-client-meta">
                              <span>Balance <span className="adv-meta-strong">${st.balance.toFixed(2)}</span></span>
                              {st.credit > 0 && <span>Credit <span className="adv-meta-strong">${st.credit.toFixed(2)}</span></span>}
                              <span>{st.count} invoice{st.count !== 1 ? 's' : ''}</span>
                              <span>{props.length} propert{props.length === 1 ? 'y' : 'ies'}</span>
                              {isGroup && <span>{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>}
                            </div>
                            {props[0]?.address && (
                              <div className="adv-client-contacts">{props[0].address}</div>
                            )}
                            {(isGroup ? groupEmail || primary?.phone : c.email || c.phone) && (
                              <div className="adv-client-contacts">
                                {isGroup
                                  ? [primary?.name, primary?.phone, groupEmail].filter(Boolean).join(' · ')
                                  : [c.phone, c.email].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!showAdvSearch && (
        <>
        <div className="filter-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, email, phone, or address…"
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
        <div className="client-sort-row">
          <span className="client-sort-label">Sort by</span>
          <select className="client-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="dateAdded">Date Added</option>
            <option value="status">Invoice Status</option>
            <option value="properties"># Properties</option>
          </select>
          <button
            className="client-sort-dir"
            onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
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
              const primary = isGroup ? primaryContact(c) : null;
              const primaryPhone = isGroup ? primary?.phone : c.phone;
              const primaryEmail = isGroup ? (c.email || primary?.email) : c.email;
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
        </>
        )}
      </div>

      {selected && (
        <ClientModal
          client={selected}
          allClients={clients}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {showNew && canEdit && (
        <ClientModal
          client={null}
          allClients={clients}
          onClose={() => setShowNew(false)}
          onSaved={handleSaved}
          onDeleted={() => {}}
        />
      )}

      {showExportModal && (() => {
        const source   = exportScope === 'all' ? clients : advFiltered;
        const rowCount = buildExportRows(source).length;
        return (
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}>
            <div className="modal-card">
              <div className="modal-header">
                <h2 className="modal-title">Export Clients</h2>
                <button className="btn-icon btn-close" onClick={() => setShowExportModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="adv-export-scope">
                  <span className="adv-export-scope-label">Which clients</span>
                  <label className="adv-export-scope-opt">
                    <input
                      type="radio"
                      checked={exportScope === 'filtered'}
                      onChange={() => setExportScope('filtered')}
                    />
                    <span>Current filter results ({advFiltered.length} client{advFiltered.length !== 1 ? 's' : ''})</span>
                  </label>
                  <label className="adv-export-scope-opt">
                    <input
                      type="radio"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                    />
                    <span>All clients ({clients.length})</span>
                  </label>
                </div>

                <p className="adv-export-hint">
                  Groups get one row per contact so every contact is listed — use the <strong>Group</strong>{' '}
                  column to tell them apart. Individuals show <strong>N/A</strong> there. Clients with no
                  contacts still get their own row.
                </p>

                <div className="export-col-actions">
                  <button className="btn-text-sm" onClick={() => setExportCols(new Set(ALL_CLIENT_EXPORT_COLS))}>Select all</button>
                  <button className="btn-text-sm" onClick={() => setExportCols(new Set())}>Deselect all</button>
                </div>
                <div className="export-col-grid">
                  {ALL_CLIENT_EXPORT_COLS.map((col) => (
                    <label key={col} className="export-col-item">
                      <input
                        type="checkbox"
                        checked={exportCols.has(col)}
                        onChange={(e) => {
                          setExportCols((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(col) : next.delete(col);
                            return next;
                          });
                        }}
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
                <div className="modal-footer-actions">
                  <button
                    className="btn btn-primary"
                    disabled={exportCols.size === 0 || rowCount === 0}
                    onClick={() => { exportExcel(exportCols, exportScope); setShowExportModal(false); }}
                  >
                    ↓ Export {rowCount} row{rowCount !== 1 ? 's' : ''}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
