import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ClientSearch from '../components/ClientSearch';
import api from '../utils/api';
import { clientName, clientInitials } from '../utils/client';
import './Payments.css';

const BLANK_INVOICE = {
  clientId: '',
  invoiceNumber: '',
  amountDue: '',
  amountPaid: '',
  dateSent: '',
  dateReceived: '',
  paymentType: '',
  zelleDateTime: '',
  zelleNotes: '',
  checkDate: '',
  checkNumber: '',
  checkMemo: '',
  processedDate: '',
  paymentMemo: '',
  notes: '',
};

export default function Payments() {
  const { clientId: routeClientId } = useParams();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(routeClientId || '');
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_INVOICE);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditTargetId, setCreditTargetId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditError, setCreditError] = useState('');
  const [applyingCredit, setApplyingCredit] = useState(false);

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data));
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      setLoading(true);
      api
        .get(`/invoices/client/${selectedClientId}`)
        .then(({ data }) => setInvoices(data))
        .finally(() => setLoading(false));
    } else {
      setInvoices([]);
    }
  }, [selectedClientId]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openNew = () => {
    setForm({ ...BLANK_INVOICE, clientId: selectedClientId });
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (inv) => {
    const toDateStr = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
    const toDateTimeStr = (v) => (v ? new Date(v).toISOString().slice(0, 16) : '');
    setForm({
      clientId: inv.clientId,
      invoiceNumber: inv.invoiceNumber || '',
      amountDue: inv.amountDue ?? '',
      amountPaid: inv.amountPaid ?? '',
      dateSent: toDateStr(inv.dateSent),
      dateReceived: toDateStr(inv.dateReceived),
      paymentType: inv.paymentType || '',
      zelleDateTime: toDateTimeStr(inv.zelleDateTime),
      zelleNotes: inv.zelleNotes || '',
      checkDate: toDateStr(inv.checkDate),
      checkNumber: inv.checkNumber || '',
      checkMemo: inv.checkMemo || '',
      processedDate: toDateStr(inv.processedDate),
      paymentMemo: inv.paymentMemo || '',
      notes: inv.notes || '',
    });
    setEditId(inv._id);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.clientId) { setError('Client is required.'); return; }
    if (!form.invoiceNumber) { setError('Invoice number is required.'); return; }
    if (form.amountDue === '') { setError('Amount due is required.'); return; }
    setSaving(true);
    setError('');
    const payload = { ...form, amountDue: Number(form.amountDue), amountPaid: Number(form.amountPaid || 0), paymentType: form.paymentType || null };
    try {
      if (editId) {
        const { data } = await api.put(`/invoices/${editId}`, payload);
        setInvoices((prev) => prev.map((i) => (i._id === editId ? data : i)));
      } else {
        const { data } = await api.post('/invoices', payload);
        setInvoices((prev) => [data, ...prev]);
      }
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
      // Drain the credit amount from overpaid source invoices (largest excess first)
      const sources = invoices
        .filter((i) => (i.amountPaid || 0) > (i.amountDue || 0))
        .sort((a, b) => (b.amountPaid - b.amountDue) - (a.amountPaid - a.amountDue));

      let toDrain = amount;
      const sourcePuts = [];
      for (const src of sources) {
        if (toDrain <= 0) break;
        const excess = (src.amountPaid || 0) - (src.amountDue || 0);
        const drain = Math.min(excess, toDrain);
        sourcePuts.push(
          api.put(`/invoices/${src._id}`, { ...src, amountPaid: (src.amountPaid || 0) - drain, paymentType: src.paymentType || null })
            .then((r) => r.data)
        );
        toDrain -= drain;
      }

      // Apply credit to the target invoice
      const targetPut = api.put(`/invoices/${target._id}`, {
        ...target,
        amountPaid: (target.amountPaid || 0) + amount,
        paymentType: target.paymentType || null,
      }).then((r) => r.data);

      const results = await Promise.all([...sourcePuts, targetPut]);

      setInvoices((prev) =>
        prev.map((i) => results.find((r) => r._id === i._id) || i)
      );
      setShowCreditForm(false);
    } catch (err) {
      setCreditError(err.response?.data?.message || 'Failed to apply credit.');
    } finally {
      setApplyingCredit(false);
    }
  };

  const selectedClient = clients.find((c) => c._id === selectedClientId);
  const totalDue = invoices.reduce((s, i) => s + (i.amountDue || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const totalCredit = invoices.reduce((s, i) => {
    const over = (i.amountPaid || 0) - (i.amountDue || 0);
    return s + (over > 0 ? over : 0);
  }, 0);

  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—');

  const invStatus = (inv) => {
    const due = inv.amountDue || 0;
    const paid = inv.amountPaid || 0;
    if (paid > due) return 'overpaid';
    if (paid >= due) return 'paid';
    return 'pending';
  };

  return (
    <div className="page">
      <Navbar />

      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Payments &amp; Invoices</h1>
            <p className="page-subtitle">Track invoice history per client</p>
          </div>
        </div>

        {/* Client selector */}
        <div className="client-selector-row">
          <ClientSearch
            clients={clients}
            value={selectedClientId}
            onChange={(id) => {
              setSelectedClientId(id);
              navigate(id ? `/payments/${id}` : '/payments');
            }}
          />
          {selectedClientId && (
            <button className="btn-action btn-add" onClick={openNew}>
              + New Invoice
            </button>
          )}
        </div>

        {/* Summary */}
        {selectedClient && (
          <div className="payment-summary">
            <div className="summary-client">
              <div className="client-avatar-sm">
                {clientInitials(selectedClient)}
              </div>
              <div>
                <div className="summary-name">{clientName(selectedClient)}</div>
                {selectedClient.phone && <div className="summary-sub">{selectedClient.phone}</div>}
              </div>
            </div>
            <div className="summary-stats">
              <Stat label="Invoices" value={invoices.length} />
              <Stat label="Total Due" value={fmt(totalDue)} />
              <Stat label="Total Paid" value={fmt(totalPaid)} />
              <Stat label="Balance Owed" value={fmt(Math.max(0, totalDue - totalPaid))} highlight={totalDue > totalPaid} />
              {totalCredit > 0 && <Stat label="Client Credit" value={fmt(totalCredit)} credit />}
              {totalCredit > 0 && (
                <button className="btn-apply-credit" onClick={openCreditForm}>
                  Apply Credit
                </button>
              )}
            </div>
          </div>
        )}

        {/* Invoice list */}
        {!selectedClientId ? (
          <div className="state-msg">Select a client above to view their invoices.</div>
        ) : loading ? (
          <div className="state-msg">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="state-msg empty">No invoices yet for this client.</div>
        ) : (
          <div className="invoice-list">
            {invoices.map((inv) => {
              const status = invStatus(inv);
              const credit = (inv.amountPaid || 0) - (inv.amountDue || 0);
              return (
              <div key={inv._id} className={`invoice-card status-${status}`}>
                <div className="inv-top">
                  <div className="inv-num">#{inv.invoiceNumber}</div>
                  <span className={`inv-status-badge badge-${status}`}>
                    {status === 'paid' ? 'Paid' : status === 'overpaid' ? 'Overpaid' : 'Pending'}
                  </span>
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

                <div className="inv-dates">
                  <span>Sent: {fmtDate(inv.dateSent)}</span>
                  {inv.dateReceived && <span>Received: {fmtDate(inv.dateReceived)}</span>}
                </div>

                {inv.paymentType && (
                  <div className="inv-payment-detail">
                    <PaymentDetail inv={inv} />
                  </div>
                )}

                {inv.notes && (
                  <div className="inv-notes">{inv.notes}</div>
                )}

                <div className="inv-actions">
                  <button className="cal-btn" onClick={() => openEdit(inv)}>✏️ Edit</button>
                  <button className="cal-btn danger" onClick={() => remove(inv._id)}>🗑 Delete</button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

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
                  <select value={form.clientId} onChange={set('clientId')}>
                    <option value="">— Select —</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>{clientName(c)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Invoice Number *</label>
                  <input value={form.invoiceNumber} onChange={set('invoiceNumber')} placeholder="0001" />
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
                <div className="form-group">
                  <label>Date Received</label>
                  <input type="date" value={form.dateReceived} onChange={set('dateReceived')} />
                </div>
                <div className="form-group form-span">
                  <label>Payment Type</label>
                  <select value={form.paymentType} onChange={set('paymentType')}>
                    <option value="">None / Unpaid</option>
                    <option value="zelle">Zelle</option>
                    <option value="check">Check</option>
                    <option value="credit">Credit / Online</option>
                  </select>
                </div>

                {/* Zelle fields */}
                {form.paymentType === 'zelle' && (
                  <>
                    <div className="form-group">
                      <label>Zelle Date &amp; Time</label>
                      <input type="datetime-local" value={form.zelleDateTime} onChange={set('zelleDateTime')} />
                    </div>
                    <div className="form-group">
                      <label>Zelle Notes / Memo</label>
                      <input value={form.zelleNotes} onChange={set('zelleNotes')} placeholder="Memo from sender…" />
                    </div>
                  </>
                )}

                {/* Check fields */}
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

                {/* Credit / Online fields */}
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

                {/* General notes */}
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
                        <button
                          className="btn-max"
                          onClick={() => setCreditAmount(maxApplicable.toFixed(2))}
                        >
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
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
  const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—');

  if (inv.paymentType === 'zelle') {
    return (
      <span className="payment-pill pill-zelle">
        Zelle · {fmtDT(inv.zelleDateTime)}{inv.zelleNotes ? ` · "${inv.zelleNotes}"` : ''}
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
  return (
    <span className="payment-pill pill-credit">
      Credit/Online{inv.processedDate ? ` · ${fmtDate(inv.processedDate)}` : ''}{inv.paymentMemo ? ` · "${inv.paymentMemo}"` : ''}
    </span>
  );
}
