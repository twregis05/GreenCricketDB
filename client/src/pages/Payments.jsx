import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ClientSearch from '../components/ClientSearch';
import api from '../utils/api';
import { clientName, clientInitials } from '../utils/client';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import './Payments.css';

const ALL_EXPORT_COLS = [
  'Invoice #', 'Client', 'Status', 'Amount Due', 'Amount Paid', 'Balance', 'Credit',
  'Billing Month', 'Date Sent', 'Payment Type', 'Property',
  'Zelle Date', 'Zelle Notes', 'Check Date', 'Check #', 'Check Memo',
  'Date Processed', 'Payment Memo', 'Cash Date', 'Cash Notes', 'Notes',
  'Payment Processing', 'Job Completed', 'Job Completed Date',
];

const BLANK_INVOICE = {
  clientId: '',
  propertyId: '',
  invoiceNumber: '',
  amountDue: '',
  amountPaid: '',
  dateSent: '',
  paymentType: '',
  zelleDate: '',
  zelleNotes: '',
  checkDate: '',
  cashDate: '',
  cashNotes: '',
  checkNumber: '',
  checkMemo: '',
  processedDate: '',
  paymentMemo: '',
  invoiceMonth: '',
  notes: '',
  paymentProcessing: false,
  jobCompleted: false,
  jobCompletedDate: '',
};

export default function Payments() {
  const { canEdit } = useAuth();
  const { clientId: routeClientId } = useParams();
  const navigate = useNavigate();

  const [clients, setClients]               = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(routeClientId || '');
  const [invoices, setInvoices]             = useState([]);
  const [showForm, setShowForm]             = useState(false);
  const [form, setForm]                     = useState(BLANK_INVOICE);
  const [editId, setEditId]                 = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);

  const [propertyFilter, setPropertyFilter] = useState('all');
  const [invSortBy, setInvSortBy]           = useState('dateSent');
  const [invSortDir, setInvSortDir]         = useState('desc');

  // Advanced search
  const [showAdvSearch, setShowAdvSearch]   = useState(false);
  const [allInvoices, setAllInvoices]       = useState([]);
  const [allLoading, setAllLoading]         = useState(false);
  const [advQ, setAdvQ]                     = useState('');
  const [advStatus, setAdvStatus]           = useState('all');
  const [advPayType, setAdvPayType]         = useState('all');
  const [advMonth, setAdvMonth]             = useState('');
  const [advMinAmt, setAdvMinAmt]           = useState('');
  const [advMaxAmt, setAdvMaxAmt]           = useState('');
  const [advMinInv, setAdvMinInv]           = useState('');
  const [advMaxInv, setAdvMaxInv]           = useState('');
  const [advProcessing, setAdvProcessing]   = useState('all');
  const [advJobCompleted, setAdvJobCompleted] = useState('all');
  const [advSortBy, setAdvSortBy]           = useState('dateSent');
  const [advSortDir, setAdvSortDir]         = useState('desc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCols, setExportCols]         = useState(new Set(ALL_EXPORT_COLS));

  // Manual credit manager
  const [showCreditMgr, setShowCreditMgr]   = useState(false);
  const [creditMgrMode, setCreditMgrMode]   = useState('add');
  const [creditMgrAmt, setCreditMgrAmt]     = useState('');
  const [creditMgrErr, setCreditMgrErr]     = useState('');
  const [creditMgrSaving, setCreditMgrSaving] = useState(false);

  // Apply-credit modal
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditTargetId, setCreditTargetId] = useState('');
  const [creditAmount, setCreditAmount]     = useState('');
  const [creditError, setCreditError]       = useState('');
  const [applyingCredit, setApplyingCredit] = useState(false);

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data));
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      setLoading(true);
      api.get(`/invoices/client/${selectedClientId}`)
        .then(({ data }) => setInvoices(data))
        .finally(() => setLoading(false));
    } else {
      setInvoices([]);
    }
  }, [selectedClientId]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const loadAllInvoices = async () => {
    setAllLoading(true);
    try {
      const { data } = await api.get('/invoices');
      setAllInvoices(data);
    } finally {
      setAllLoading(false);
    }
  };

  const openNew = () => {
    setForm({ ...BLANK_INVOICE, clientId: selectedClientId });
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (inv) => {
    const toDateStr = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
    setForm({
      // handle both plain-ID (client view) and populated object (adv search)
      clientId:     inv.clientId?._id?.toString() || inv.clientId?.toString() || '',
      propertyId:   inv.propertyId?.toString() || '',
      invoiceNumber: inv.invoiceNumber || '',
      amountDue:    inv.amountDue ?? '',
      amountPaid:   inv.amountPaid ?? '',
      dateSent:     toDateStr(inv.dateSent),
      paymentType:  inv.paymentType || '',
      zelleDate:    toDateStr(inv.zelleDate ?? inv.zelleDateTime),
      zelleNotes:   inv.zelleNotes || '',
      checkDate:    toDateStr(inv.checkDate),
      cashDate:     toDateStr(inv.cashDate),
      cashNotes:    inv.cashNotes || '',
      checkNumber:  inv.checkNumber || '',
      checkMemo:    inv.checkMemo || '',
      processedDate: toDateStr(inv.processedDate),
      paymentMemo:  inv.paymentMemo || '',
      invoiceMonth:      inv.invoiceMonth || '',
      notes:             inv.notes || '',
      paymentProcessing: inv.paymentProcessing || false,
      jobCompleted:      inv.jobCompleted || false,
      jobCompletedDate:  toDateStr(inv.jobCompletedDate),
    });
    setEditId(inv._id);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.clientId)      { setError('Client is required.');       return; }
    if (!form.invoiceNumber) { setError('Invoice number is required.'); return; }
    if (form.amountDue === '') { setError('Amount due is required.');  return; }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      amountDue:   Number(form.amountDue),
      amountPaid:  Number(form.amountPaid || 0),
      paymentType: form.paymentType || null,
      propertyId:  form.propertyId  || null,
    };
    try {
      if (editId) {
        const { data } = await api.put(`/invoices/${editId}`, payload);
        setInvoices((prev) => prev.map((i) => (i._id === editId ? data : i)));
      } else {
        const { data } = await api.post('/invoices', payload);
        setInvoices((prev) => [data, ...prev]);
      }
      if (showAdvSearch) loadAllInvoices();
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    await api.delete(`/invoices/${id}`);
    setInvoices((prev) => prev.filter((i) => i._id !== id));
    if (showAdvSearch) loadAllInvoices();
  };

  const openCreditForm = () => {
    setCreditTargetId('');
    setCreditAmount('');
    setCreditError('');
    setShowCreditForm(true);
  };

  const applyCredit = async () => {
    const target = invoices.find((i) => i._id === creditTargetId);
    if (!target) { setCreditError('Select an invoice to apply credit to.'); return; }
    const amount = Number(creditAmount);
    if (!amount || amount <= 0) { setCreditError('Enter a valid credit amount.'); return; }
    if (amount > totalCredit) { setCreditError(`Cannot exceed available credit of ${fmt(totalCredit)}.`); return; }
    const targetBalance = (target.amountDue || 0) - (target.amountPaid || 0);
    if (amount > targetBalance) { setCreditError(`Cannot exceed this invoice's remaining balance of ${fmt(targetBalance)}.`); return; }
    setApplyingCredit(true);
    setCreditError('');
    try {
      const sources = invoices
        .filter((i) => (i.amountPaid || 0) > (i.amountDue || 0))
        .sort((a, b) => (b.amountPaid - b.amountDue) - (a.amountPaid - a.amountDue));
      let toDrain = amount;
      const sourcePuts = [];
      for (const src of sources) {
        if (toDrain <= 0) break;
        const excess = (src.amountPaid || 0) - (src.amountDue || 0);
        const drain  = Math.min(excess, toDrain);
        sourcePuts.push(
          api.put(`/invoices/${src._id}`, { ...src, amountPaid: (src.amountPaid || 0) - drain, paymentType: src.paymentType || null })
            .then((r) => r.data)
        );
        toDrain -= drain;
      }
      const targetPut = api.put(`/invoices/${target._id}`, {
        ...target,
        amountPaid:  (target.amountPaid || 0) + amount,
        paymentType: target.paymentType || null,
      }).then((r) => r.data);
      const promises = [...sourcePuts, targetPut];
      if (toDrain > 0) {
        promises.push(
          api.patch(`/clients/${selectedClient._id}/credit`, { adjustment: -toDrain })
            .then((r) => { setClients((prev) => prev.map((c) => c._id === r.data._id ? r.data : c)); })
        );
      }
      const results = await Promise.all(promises);
      setInvoices((prev) => prev.map((i) => results.find((r) => r && r._id === i._id) || i));
      setShowCreditForm(false);
    } catch (err) {
      setCreditError(err.response?.data?.message || 'Failed to apply credit.');
    } finally {
      setApplyingCredit(false);
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const selectedClient    = clients.find((c) => c._id === selectedClientId);
  const clientProperties  = selectedClient?.properties || [];

  const resolveProperty = (inv) => {
    if (!inv.propertyId) return null;
    return clientProperties.find((p) => p._id?.toString() === inv.propertyId?.toString()) || null;
  };

  const resolveAdvProperty = (inv) => {
    if (!inv.propertyId) return null;
    const props = inv.clientId?.properties || [];
    return props.find((p) => p._id?.toString() === inv.propertyId?.toString()) || null;
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

  const filteredInvoices = (() => {
    const base = propertyFilter === 'all'
      ? [...invoices]
      : invoices.filter((i) => i.propertyId?.toString() === propertyFilter);

    base.sort((a, b) => {
      let cmp = 0;
      if (invSortBy === 'dateSent') {
        cmp = new Date(a.dateSent || 0) - new Date(b.dateSent || 0);
      } else if (invSortBy === 'invoiceMonth') {
        cmp = (a.invoiceMonth || '').localeCompare(b.invoiceMonth || '');
      } else if (invSortBy === 'invoiceNumber') {
        cmp = parseInt(a.invoiceNumber || 0, 10) - parseInt(b.invoiceNumber || 0, 10);
      } else if (invSortBy === 'amountDue') {
        cmp = (a.amountDue || 0) - (b.amountDue || 0);
      } else if (invSortBy === 'status') {
        cmp = invStatus(a).localeCompare(invStatus(b));
      }
      return invSortDir === 'asc' ? cmp : -cmp;
    });

    return base;
  })();

  const totalDue    = invoices.reduce((s, i) => s + (i.amountDue  || 0), 0);
  const totalPaid   = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const invoiceCredit = invoices.reduce((s, i) => {
    const over = (i.amountPaid || 0) - (i.amountDue || 0);
    return s + (over > 0 ? over : 0);
  }, 0);
  const manualCredit = selectedClient?.manualCredit || 0;
  const totalCredit  = invoiceCredit + manualCredit;

  const fmt     = (v) => `$${Number(v || 0).toFixed(2)}`;
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—');
  const fmtMonth = (m) => m
    ? new Date(m + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null;

  const advFiltered = allInvoices.filter((inv) => {
    if (advQ) {
      const q    = advQ.toLowerCase();
      const name = clientName(inv.clientId).toLowerCase();
      if (!name.includes(q) && !(inv.invoiceNumber || '').toLowerCase().includes(q) && !(inv.notes || '').toLowerCase().includes(q)) return false;
    }
    if (advStatus  !== 'all' && invStatus(inv) !== advStatus)                         return false;
    if (advPayType !== 'all' && (inv.paymentType || 'none') !== advPayType)            return false;
    if (advProcessing   === 'yes' && !inv.paymentProcessing)                          return false;
    if (advProcessing   === 'no'  &&  inv.paymentProcessing)                          return false;
    if (advJobCompleted === 'yes' && !inv.jobCompleted)                               return false;
    if (advJobCompleted === 'no'  &&  inv.jobCompleted)                               return false;
    if (advMonth   && inv.invoiceMonth !== advMonth)                         return false;
    if (advMinAmt !== '' && (inv.amountDue || 0) < Number(advMinAmt))        return false;
    if (advMaxAmt !== '' && (inv.amountDue || 0) > Number(advMaxAmt))        return false;
    if (advMinInv !== '' || advMaxInv !== '') {
      const n = parseInt(inv.invoiceNumber, 10);
      if (isNaN(n))                                                           return false;
      if (advMinInv !== '' && n < parseInt(advMinInv, 10))                   return false;
      if (advMaxInv !== '' && n > parseInt(advMaxInv, 10))                   return false;
    }
    return true;
  }).sort((a, b) => {
    const dir = advSortDir === 'asc' ? 1 : -1;
    switch (advSortBy) {
      case 'clientName': {
        const na = clientName(a.clientId).toLowerCase();
        const nb = clientName(b.clientId).toLowerCase();
        return na < nb ? -dir : na > nb ? dir : 0;
      }
      case 'amountDue':
        return ((a.amountDue || 0) - (b.amountDue || 0)) * dir;
      case 'invoiceNumber': {
        const na = parseInt(a.invoiceNumber, 10);
        const nb = parseInt(b.invoiceNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '') * dir;
      }
      case 'invoiceMonth': {
        const ma = a.invoiceMonth || '';
        const mb = b.invoiceMonth || '';
        return ma < mb ? -dir : ma > mb ? dir : 0;
      }
      case 'dateSent':
      default: {
        const da = a.dateSent ? new Date(a.dateSent).getTime() : 0;
        const db = b.dateSent ? new Date(b.dateSent).getTime() : 0;
        return (da - db) * dir;
      }
    }
  });

  const exportExcel = (cols) => {
    const fmtD = (v) => v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '';
    const fmtM = (m) => m ? new Date(m + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

    const allRows = advFiltered.map((inv) => {
      const status = invStatus(inv);
      const prop   = resolveAdvProperty(inv);
      const due    = inv.amountDue  || 0;
      const paid   = inv.amountPaid || 0;
      return {
        'Invoice #':      inv.invoiceNumber || '',
        'Client':         clientName(inv.clientId),
        'Status':         status.charAt(0).toUpperCase() + status.slice(1),
        'Amount Due':     due,
        'Amount Paid':    paid,
        'Balance':        Math.max(0, due - paid),
        'Credit':         paid > due ? paid - due : 0,
        'Billing Month':  fmtM(inv.invoiceMonth),
        'Date Sent':      fmtD(inv.dateSent),
        'Payment Type':   inv.paymentType || 'None',
        'Property':       prop ? (prop.label ? `${prop.label} — ${prop.address}` : prop.address) : '',
        'Zelle Date':     fmtD(inv.zelleDate ?? inv.zelleDateTime),
        'Zelle Notes':    inv.zelleNotes   || '',
        'Check Date':     fmtD(inv.checkDate),
        'Check #':        inv.checkNumber  || '',
        'Check Memo':     inv.checkMemo    || '',
        'Date Processed':     fmtD(inv.processedDate),
        'Payment Memo':       inv.paymentMemo  || '',
        'Cash Date':          fmtD(inv.cashDate),
        'Cash Notes':         inv.cashNotes    || '',
        'Notes':              inv.notes        || '',
        'Payment Processing':  inv.paymentProcessing ? 'Yes' : 'No',
        'Job Completed':       inv.jobCompleted      ? 'Yes' : 'No',
        'Job Completed Date':  fmtD(inv.jobCompletedDate),
      };
    });

    // Keep only the columns the user selected, preserving ALL_EXPORT_COLS order
    const rows = allRows.map((row) =>
      Object.fromEntries(ALL_EXPORT_COLS.filter((c) => cols.has(c)).map((c) => [c, row[c]]))
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

    // Auto-size columns
    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length)) + 2,
    }));

    // Format monetary columns to always show 2 decimal places
    const moneyCols = ['Amount Due', 'Amount Paid', 'Balance', 'Credit'].filter((c) => cols.has(c));
    moneyCols.forEach((col) => {
      const ci = headers.indexOf(col);
      if (ci === -1) return;
      const colLetter = XLSX.utils.encode_col(ci);
      for (let ri = 1; ri <= rows.length; ri++) {
        const ref = `${colLetter}${ri + 1}`;
        if (ws[ref]) ws[ref].z = '0.00';
      }
    });

    XLSX.writeFile(wb, `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <Navbar />

      <div className="page-content">

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Payments &amp; Invoices</h1>
            <p className="page-subtitle">Track invoice history per client</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-action"
              onClick={() => {
                if (showAdvSearch) {
                  setShowAdvSearch(false);
                } else {
                  setShowAdvSearch(true);
                  loadAllInvoices();
                }
              }}
            >
              {showAdvSearch ? '← Client View' : '⚲ Advanced Search'}
            </button>
          </div>
        </div>

        {/* ── Advanced search view ── */}
        {showAdvSearch && (
          <div className="adv-search-section">
            <div className="adv-filter-card">
              <input
                className="adv-search-input"
                type="text"
                placeholder="Search by client name, invoice #, or notes…"
                value={advQ}
                onChange={(e) => setAdvQ(e.target.value)}
              />
              <div className="adv-filter-row">
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Status</label>
                  <div className="adv-pills">
                    {['all', 'pending', 'overdue', 'processing', 'paid', 'overpaid'].map((s) => (
                      <button
                        key={s}
                        className={`pill ${advStatus === s ? 'pill-active' : ''}`}
                        onClick={() => setAdvStatus(s)}
                      >
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Payment Type</label>
                  <select className="adv-select" value={advPayType} onChange={(e) => setAdvPayType(e.target.value)}>
                    <option value="all">All</option>
                    <option value="none">Unpaid / None</option>
                    <option value="zelle">Zelle</option>
                    <option value="check">Check</option>
                    <option value="credit">Credit / Online</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Billing Month</label>
                  <input
                    className="adv-month-input"
                    type="month"
                    value={advMonth}
                    onChange={(e) => setAdvMonth(e.target.value)}
                  />
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Amount Due</label>
                  <div className="adv-range-row">
                    <input
                      className="adv-range-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Min"
                      value={advMinAmt}
                      onChange={(e) => setAdvMinAmt(e.target.value)}
                    />
                    <span className="adv-range-sep">–</span>
                    <input
                      className="adv-range-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Max"
                      value={advMaxAmt}
                      onChange={(e) => setAdvMaxAmt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Invoice #</label>
                  <div className="adv-range-row">
                    <input
                      className="adv-range-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Min"
                      value={advMinInv}
                      onChange={(e) => setAdvMinInv(e.target.value)}
                    />
                    <span className="adv-range-sep">–</span>
                    <input
                      className="adv-range-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Max"
                      value={advMaxInv}
                      onChange={(e) => setAdvMaxInv(e.target.value)}
                    />
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Payment Processing</label>
                  <div className="adv-pills">
                    {[['all','All'],['yes','Yes'],['no','No']].map(([v,l]) => (
                      <button key={v} className={`pill ${advProcessing === v ? 'pill-active' : ''}`} onClick={() => setAdvProcessing(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group">
                  <label className="adv-filter-label">Job Completed</label>
                  <div className="adv-pills">
                    {[['all','All'],['yes','Yes'],['no','No']].map(([v,l]) => (
                      <button key={v} className={`pill ${advJobCompleted === v ? 'pill-active' : ''}`} onClick={() => setAdvJobCompleted(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="adv-filter-group adv-sort-group">
                  <label className="adv-filter-label">Sort By</label>
                  <div className="adv-range-row">
                    <select className="adv-select" value={advSortBy} onChange={(e) => setAdvSortBy(e.target.value)}>
                      <option value="dateSent">Date Sent</option>
                      <option value="invoiceMonth">Billing Month</option>
                      <option value="clientName">Client Name</option>
                      <option value="amountDue">Amount Due</option>
                      <option value="invoiceNumber">Invoice #</option>
                    </select>
                    <button
                      className="adv-sort-dir"
                      onClick={() => setAdvSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                      title={advSortDir === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {advSortDir === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {allLoading ? (
              <div className="state-msg">Loading invoices…</div>
            ) : (
              <>
                <div className="adv-results-bar">
                  <p className="adv-result-count">
                    {advFiltered.length} invoice{advFiltered.length !== 1 ? 's' : ''} found
                    {allInvoices.length !== advFiltered.length && ` (of ${allInvoices.length} total)`}
                  </p>
                  {advFiltered.length > 0 && (
                    <button className="btn-action btn-export" onClick={() => setShowExportModal(true)}>
                      ↓ Export Excel
                    </button>
                  )}
                </div>
                {advFiltered.length === 0 ? (
                  <div className="state-msg empty">No invoices match your filters.</div>
                ) : (
                  <div className="invoice-list">
                    {advFiltered.map((inv) => {
                      const status = invStatus(inv);
                      const credit = (inv.amountPaid || 0) - (inv.amountDue || 0);
                      const prop   = resolveAdvProperty(inv);
                      return (
                        <div key={inv._id} className={`invoice-card status-${status}`}>
                          <div className="adv-client-header">
                            <div className="adv-client-avatar">{clientInitials(inv.clientId)}</div>
                            <span className="adv-client-name">{clientName(inv.clientId)}</span>
                          </div>
                          <div className="inv-top">
                            <div className="inv-num">#{inv.invoiceNumber}</div>
                            <span className={`inv-status-badge badge-${status}`}>
                              {status === 'paid' ? 'Paid' : status === 'overpaid' ? 'Overpaid' : status === 'processing' ? 'Processing' : status === 'overdue' ? 'Overdue' : 'Pending'}
                            </span>
                            {inv.jobCompleted && <span className="inv-status-badge badge-job-done">✓ Job Done</span>}
                          </div>
                          <div className="inv-amounts">
                            <div className="inv-amt">
                              <span className="inv-lbl">Due</span>
                              <span className="inv-val">{fmt(inv.amountDue)}</span>
                            </div>
                            <div className="inv-amt">
                              <span className="inv-lbl">Paid</span>
                              <span className="inv-val paid-val">{fmt(inv.amountPaid)}</span>
                            </div>
                            {status === 'overpaid' && (
                              <div className="inv-amt">
                                <span className="inv-lbl">Credit</span>
                                <span className="inv-val credit-val">{fmt(credit)}</span>
                              </div>
                            )}
                          </div>
                          {prop && (
                            <div className="inv-property-tag">
                              📍 {prop.label ? <><strong>{prop.label}</strong> — {prop.address}</> : prop.address}
                            </div>
                          )}
                          <div className="inv-dates">
                            {inv.invoiceMonth && <span>{fmtMonth(inv.invoiceMonth)}</span>}
                            <span>Sent: {fmtDate(inv.dateSent)}</span>
                            {inv.jobCompleted && inv.jobCompletedDate && <span>Completed: {fmtDate(inv.jobCompletedDate)}</span>}
                          </div>
                          {inv.paymentType && (
                            <div className="inv-payment-detail">
                              <PaymentDetail inv={inv} />
                            </div>
                          )}
                          {inv.notes && <div className="inv-notes">{inv.notes}</div>}
                          {canEdit && (
                            <div className="inv-actions">
                              <button className="cal-btn" onClick={() => openEdit(inv)}>✏️ Edit</button>
                              <button className="cal-btn danger" onClick={() => remove(inv._id)}>🗑 Delete</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Normal client view ── */}
        {!showAdvSearch && (
          <>
            <div className="client-selector-row">
              <ClientSearch
                clients={clients}
                value={selectedClientId}
                onChange={(id) => {
                  setSelectedClientId(id);
                  setPropertyFilter('all');
                  navigate(id ? `/payments/${id}` : '/payments');
                }}
              />
              {selectedClientId && canEdit && (
                <button className="btn-action btn-add" onClick={openNew}>
                  + New Invoice
                </button>
              )}
            </div>

            {selectedClient && (
              <div className="payment-summary">
                <div className="summary-client">
                  <div className="client-avatar-sm">{clientInitials(selectedClient)}</div>
                  <div>
                    <div className="summary-name">{clientName(selectedClient)}</div>
                    {selectedClient.phone && <div className="summary-sub">{selectedClient.phone}</div>}
                  </div>
                </div>
                <div className="summary-stats">
                  <Stat label="Invoices"     value={invoices.length} />
                  <Stat label="Total Due"    value={fmt(totalDue)} />
                  <Stat label="Total Paid"   value={fmt(totalPaid)} />
                  <Stat label="Balance Owed" value={fmt(Math.max(0, totalDue - totalPaid))} highlight={totalDue > totalPaid} />
                  {manualCredit > 0 && <Stat label="Manual Credit" value={fmt(manualCredit)} credit />}
                  {totalCredit > 0 && <Stat label="Total Credit" value={fmt(totalCredit)} credit />}
                  {totalCredit > 0 && canEdit && (
                    <button className="btn-apply-credit" onClick={openCreditForm}>Apply Credit</button>
                  )}
                  {canEdit && (
                    <button className="btn-apply-credit" onClick={() => { setCreditMgrMode('add'); setCreditMgrAmt(''); setCreditMgrErr(''); setShowCreditMgr(true); }}>
                      + / − Credit
                    </button>
                  )}
                </div>
                {clientProperties.length > 0 && (
                  <div className="inv-property-filter">
                    <label className="inv-filter-label">Filter by property</label>
                    <div className="inv-filter-pills">
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

            {selectedClientId && !loading && invoices.length > 1 && (
              <div className="lc-sort-row">
                <span className="lc-sort-label">Sort by</span>
                <select className="lc-sort-select" value={invSortBy} onChange={(e) => setInvSortBy(e.target.value)}>
                  <option value="dateSent">Date Sent</option>
                  <option value="invoiceMonth">Billing Month</option>
                  <option value="invoiceNumber">Invoice #</option>
                  <option value="amountDue">Amount Due</option>
                  <option value="status">Status</option>
                </select>
                <button
                  className="adv-sort-dir"
                  onClick={() => setInvSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                  title={invSortDir === 'desc' ? 'Descending' : 'Ascending'}
                >
                  {invSortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            )}

            {!selectedClientId ? (
              <div className="state-msg">Select a client above to view their invoices.</div>
            ) : loading ? (
              <div className="state-msg">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="state-msg empty">No invoices yet for this client.</div>
            ) : (
              <div className="invoice-list">
                {filteredInvoices.length === 0 ? (
                  <div className="state-msg empty">No invoices match the selected property.</div>
                ) : filteredInvoices.map((inv) => {
                  const status = invStatus(inv);
                  const credit = (inv.amountPaid || 0) - (inv.amountDue || 0);
                  const prop   = resolveProperty(inv);
                  return (
                    <div key={inv._id} className={`invoice-card status-${status}`}>
                      <div className="inv-top">
                        <div className="inv-num">#{inv.invoiceNumber}</div>
                        <span className={`inv-status-badge badge-${status}`}>
                          {status === 'paid' ? 'Paid' : status === 'overpaid' ? 'Overpaid' : status === 'processing' ? 'Processing' : status === 'overdue' ? 'Overdue' : 'Pending'}
                        </span>
                        {inv.jobCompleted && <span className="inv-status-badge badge-job-done">✓ Job Done</span>}
                      </div>
                      <div className="inv-amounts">
                        <div className="inv-amt">
                          <span className="inv-lbl">Due</span>
                          <span className="inv-val">{fmt(inv.amountDue)}</span>
                        </div>
                        <div className="inv-amt">
                          <span className="inv-lbl">Paid</span>
                          <span className="inv-val paid-val">{fmt(inv.amountPaid)}</span>
                        </div>
                        {status === 'overpaid' && (
                          <div className="inv-amt">
                            <span className="inv-lbl">Client Credit</span>
                            <span className="inv-val credit-val">{fmt(credit)}</span>
                          </div>
                        )}
                      </div>
                      {status === 'overpaid' && (
                        <div className="overpaid-notice">
                          ⚠ Client overpaid by {fmt(credit)} — apply as credit to next invoice or issue a refund.
                        </div>
                      )}
                      {prop && (
                        <div className="inv-property-tag">
                          📍 {prop.label ? <><strong>{prop.label}</strong> — {prop.address}</> : prop.address}
                        </div>
                      )}
                      <div className="inv-dates">
                        {inv.invoiceMonth && <span>{fmtMonth(inv.invoiceMonth)}</span>}
                        <span>Sent: {fmtDate(inv.dateSent)}</span>
                        {inv.jobCompleted && inv.jobCompletedDate && <span>Completed: {fmtDate(inv.jobCompletedDate)}</span>}
                      </div>
                      {inv.paymentType && (
                        <div className="inv-payment-detail">
                          <PaymentDetail inv={inv} />
                        </div>
                      )}
                      {inv.notes && <div className="inv-notes">{inv.notes}</div>}
                      {canEdit && (
                        <div className="inv-actions">
                          <button className="cal-btn" onClick={() => openEdit(inv)}>✏️ Edit</button>
                          <button className="cal-btn danger" onClick={() => remove(inv._id)}>🗑 Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>{/* end page-content */}

      {/* Invoice form modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-card modal-wide">
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Edit Invoice' : 'New Invoice'}</h2>
              <button className="btn-icon btn-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
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

                {form.clientId && (() => {
                  const fc    = clients.find((c) => c._id === form.clientId);
                  const props = fc?.properties || [];
                  if (props.length === 0) return null;
                  return (
                    <div className="form-group form-span">
                      <label>Property / Location</label>
                      <select value={form.propertyId} onChange={set('propertyId')}>
                        <option value="">— No specific property —</option>
                        {props.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.label ? `${p.label} — ${p.address}` : p.address}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                <div className="form-group">
                  <label>Invoice Number *</label>
                  <div className="credit-amount-row">
                    <input value={form.invoiceNumber} onChange={set('invoiceNumber')} placeholder="0001" />
                    <button
                      type="button"
                      className="btn-max"
                      onClick={async () => {
                        const { data } = await api.get('/invoices/next-number');
                        setForm((f) => ({ ...f, invoiceNumber: data.next }));
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Amount Due *</label>
                  <input type="number" min="0" step="0.01" value={form.amountDue} onChange={set('amountDue')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Amount Paid</label>
                  <input type="number" min="0" step="0.01" value={form.amountPaid} onChange={set('amountPaid')} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Date Sent</label>
                  <input type="date" value={form.dateSent} onChange={set('dateSent')} />
                </div>
                <div className="form-group form-span">
                  <label>Payment Type</label>
                  <select value={form.paymentType} onChange={set('paymentType')}>
                    <option value="">None / Unpaid</option>
                    <option value="zelle">Zelle</option>
                    <option value="check">Check</option>
                    <option value="credit">Credit / Online</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                {form.paymentType === 'zelle' && (
                  <>
                    <div className="form-group">
                      <label>Zelle Date Received</label>
                      <input type="date" value={form.zelleDate} onChange={set('zelleDate')} />
                    </div>
                    <div className="form-group">
                      <label>Zelle Notes / Memo</label>
                      <input value={form.zelleNotes} onChange={set('zelleNotes')} placeholder="Memo from sender…" />
                    </div>
                  </>
                )}

                {form.paymentType === 'check' && (
                  <>
                    <div className="form-group">
                      <label>Date on Check</label>
                      <input type="date" value={form.checkDate} onChange={set('checkDate')} />
                    </div>
                    <div className="form-group">
                      <label>Check Number</label>
                      <input value={form.checkNumber} onChange={set('checkNumber')} placeholder="1234" />
                    </div>
                    <div className="form-group form-span">
                      <label>Check Memo</label>
                      <input value={form.checkMemo} onChange={set('checkMemo')} placeholder="Memo line…" />
                    </div>
                  </>
                )}

                {(form.paymentType === 'credit' || form.paymentType === 'online') && (
                  <>
                    <div className="form-group">
                      <label>Date Processed</label>
                      <input type="date" value={form.processedDate} onChange={set('processedDate')} />
                    </div>
                    <div className="form-group">
                      <label>Payment Memo</label>
                      <input value={form.paymentMemo} onChange={set('paymentMemo')} placeholder="Memo…" />
                    </div>
                  </>
                )}

                {form.paymentType === 'cash' && (
                  <>
                    <div className="form-group">
                      <label>Date Received</label>
                      <input type="date" value={form.cashDate} onChange={set('cashDate')} />
                    </div>
                    <div className="form-group">
                      <label>Cash Notes</label>
                      <input value={form.cashNotes} onChange={set('cashNotes')} placeholder="e.g. received in envelope…" />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Billing Month</label>
                  <input type="month" value={form.invoiceMonth} onChange={set('invoiceMonth')} />
                </div>

                <div className="form-group">
                  <label>Job Completed</label>
                  <label className="inv-toggle">
                    <input
                      type="checkbox"
                      checked={!!form.jobCompleted}
                      onChange={(e) => setForm((f) => ({ ...f, jobCompleted: e.target.checked, jobCompletedDate: e.target.checked ? f.jobCompletedDate : '' }))}
                    />
                    <span>Mark as completed</span>
                  </label>
                  {form.jobCompleted && (
                    <div style={{ marginTop: '.5rem' }}>
                      <label className="inv-subfield-label">Date completed</label>
                      <input
                        type="date"
                        value={form.jobCompletedDate}
                        onChange={(e) => setForm((f) => ({ ...f, jobCompletedDate: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Payment Processing</label>
                  <label className="inv-toggle">
                    <input
                      type="checkbox"
                      checked={!!form.paymentProcessing}
                      onChange={(e) => setForm((f) => ({ ...f, paymentProcessing: e.target.checked }))}
                    />
                    <span>Payment in progress</span>
                  </label>
                </div>
                <div className="form-group form-span">
                  <label>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={set('notes')}
                    rows={2}
                    placeholder="Any additional notes about this invoice…"
                  />
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
              <div className="modal-footer-actions">
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Invoice'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual credit manager modal */}
      {showCreditMgr && selectedClient && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowCreditMgr(false); }}>
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">Client Credit — {clientName(selectedClient)}</h2>
              <button className="btn-icon btn-close" onClick={() => setShowCreditMgr(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="credit-available-banner">
                Current manual credit: <strong>{fmt(manualCredit)}</strong>
              </div>
              <div className="form-grid">
                <div className="form-group form-span">
                  <label>Action</label>
                  <div className="adv-pills">
                    <button
                      className={`pill ${creditMgrMode === 'add' ? 'pill-active' : ''}`}
                      onClick={() => { setCreditMgrMode('add'); setCreditMgrAmt(''); setCreditMgrErr(''); }}
                    >
                      Add Credit
                    </button>
                    <button
                      className={`pill ${creditMgrMode === 'remove' ? 'pill-active' : ''}`}
                      onClick={() => { setCreditMgrMode('remove'); setCreditMgrAmt(''); setCreditMgrErr(''); }}
                    >
                      Remove Credit
                    </button>
                  </div>
                </div>
                <div className="form-group form-span">
                  <label>Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={creditMgrAmt}
                    onChange={(e) => setCreditMgrAmt(e.target.value)}
                  />
                  {creditMgrMode === 'remove' && (
                    <p className="field-hint">Max removable: {fmt(manualCredit)}</p>
                  )}
                </div>
              </div>
              {creditMgrErr && <p className="form-error">{creditMgrErr}</p>}
              <div className="modal-footer-actions">
                <button
                  className="btn btn-primary"
                  disabled={creditMgrSaving || !creditMgrAmt}
                  onClick={async () => {
                    const amt = Number(creditMgrAmt);
                    if (!amt || amt <= 0) { setCreditMgrErr('Enter a valid amount.'); return; }
                    if (creditMgrMode === 'remove' && amt > manualCredit) {
                      setCreditMgrErr(`Cannot remove more than the current balance of ${fmt(manualCredit)}.`);
                      return;
                    }
                    setCreditMgrSaving(true);
                    setCreditMgrErr('');
                    try {
                      const adjustment = creditMgrMode === 'add' ? amt : -amt;
                      const { data } = await api.patch(`/clients/${selectedClient._id}/credit`, { adjustment });
                      setClients((prev) => prev.map((c) => c._id === data._id ? data : c));
                      setShowCreditMgr(false);
                    } catch (err) {
                      setCreditMgrErr(err.response?.data?.message || 'Failed to update credit.');
                    } finally {
                      setCreditMgrSaving(false);
                    }
                  }}
                >
                  {creditMgrSaving ? 'Saving…' : creditMgrMode === 'add' ? `Add ${creditMgrAmt ? fmt(Number(creditMgrAmt)) : 'Credit'}` : `Remove ${creditMgrAmt ? fmt(Number(creditMgrAmt)) : 'Credit'}`}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowCreditMgr(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export column picker modal */}
      {showExportModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}>
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">Choose Columns to Export</h2>
              <button className="btn-icon btn-close" onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="export-col-actions">
                <button className="btn-text-sm" onClick={() => setExportCols(new Set(ALL_EXPORT_COLS))}>Select all</button>
                <button className="btn-text-sm" onClick={() => setExportCols(new Set())}>Deselect all</button>
              </div>
              <div className="export-col-grid">
                {ALL_EXPORT_COLS.map((col) => (
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
                  disabled={exportCols.size === 0}
                  onClick={() => { exportExcel(exportCols); setShowExportModal(false); }}
                >
                  ↓ Export {exportCols.size} column{exportCols.size !== 1 ? 's' : ''}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Credit modal */}
      {showCreditForm && (() => {
        const pendingInvoices = invoices.filter((i) => (i.amountPaid || 0) < (i.amountDue || 0));
        const target = invoices.find((i) => i._id === creditTargetId);
        const maxApplicable = target
          ? Math.min(totalCredit, (target.amountDue || 0) - (target.amountPaid || 0))
          : totalCredit;
        return (
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowCreditForm(false); }}>
            <div className="modal-card">
              <div className="modal-header">
                <h2 className="modal-title">Apply Client Credit</h2>
                <button className="btn-icon btn-close" onClick={() => setShowCreditForm(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="credit-available-banner">
                  Available credit: <strong>{fmt(totalCredit)}</strong>
                </div>
                <div className="form-grid">
                  <div className="form-group form-span">
                    <label>Apply to Invoice</label>
                    <select value={creditTargetId} onChange={(e) => { setCreditTargetId(e.target.value); setCreditAmount(''); }}>
                      <option value="">— Select a pending invoice —</option>
                      {pendingInvoices.map((i) => {
                        const bal = (i.amountDue || 0) - (i.amountPaid || 0);
                        return (
                          <option key={i._id} value={i._id}>
                            #{i.invoiceNumber} — balance {fmt(bal)}
                          </option>
                        );
                      })}
                    </select>
                    {pendingInvoices.length === 0 && (
                      <p className="field-hint">No pending invoices to apply credit to.</p>
                    )}
                  </div>
                  <div className="form-group form-span">
                    <label>
                      Credit Amount
                      {target && <span className="field-hint-inline"> (max {fmt(maxApplicable)})</span>}
                    </label>
                    <div className="credit-amount-row">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={maxApplicable}
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={!creditTargetId}
                      />
                      {creditTargetId && (
                        <button className="btn-max" onClick={() => setCreditAmount(maxApplicable.toFixed(2))}>
                          Max
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {creditError && <p className="form-error">{creditError}</p>}
                <div className="modal-footer-actions">
                  <button
                    className="btn btn-primary"
                    onClick={applyCredit}
                    disabled={applyingCredit || !creditTargetId || !creditAmount}
                  >
                    {applyingCredit ? 'Applying…' : 'Apply Credit'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowCreditForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value, highlight, credit }) {
  return (
    <div className={`stat-item ${highlight ? 'stat-highlight' : ''} ${credit ? 'stat-credit' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function PaymentDetail({ inv }) {
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—');
  if (inv.paymentType === 'zelle') {
    const zelleDate = inv.zelleDate ?? inv.zelleDateTime;
    return (
      <span className="payment-pill pill-zelle">
        Zelle{zelleDate ? ` · ${fmtDate(zelleDate)}` : ''}{inv.zelleNotes ? ` · "${inv.zelleNotes}"` : ''}
      </span>
    );
  }
  if (inv.paymentType === 'check') {
    return (
      <span className="payment-pill pill-check">
        Check #{inv.checkNumber}{inv.checkDate ? ` · ${fmtDate(inv.checkDate)}` : ''}{inv.checkMemo ? ` · "${inv.checkMemo}"` : ''}
      </span>
    );
  }
  if (inv.paymentType === 'cash') {
    return (
      <span className="payment-pill pill-cash">
        Cash{inv.cashDate ? ` · ${fmtDate(inv.cashDate)}` : ''}{inv.cashNotes ? ` · "${inv.cashNotes}"` : ''}
      </span>
    );
  }
  return (
    <span className="payment-pill pill-credit">
      Credit/Online{inv.processedDate ? ` · ${fmtDate(inv.processedDate)}` : ''}{inv.paymentMemo ? ` · "${inv.paymentMemo}"` : ''}
    </span>
  );
}
