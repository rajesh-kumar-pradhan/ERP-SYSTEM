import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ItemEditor from '../components/ItemEditor.jsx';
import Notice from '../components/Notice.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));

export default function QuotationsPage() {
  const { user } = useAuth(); const isSalesUser = user.role === 'SALES_USER';
  const [quotations, setQuotations] = useState([]); const [enquiries, setEnquiries] = useState([]); const [products, setProducts] = useState([]); const [showForm, setShowForm] = useState(false); const [notice, setNotice] = useState(); const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ enquiryId: '', validUntil: '', items: [] });
  async function load() { setLoading(true); try { const [q, e, p] = await Promise.all([api.get('/quotations'), api.get('/enquiries'), api.get('/products')]); setQuotations(q.data.data); setEnquiries(e.data.data.filter((row) => ['NEW', 'QUOTED'].includes(row.status))); setProducts(p.data.data); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const selectedEnquiry = enquiries.find((row) => row.id === form.enquiryId);
  const enquiryProducts = products.filter((product) => selectedEnquiry?.items.some((item) => item.productId === product.id));
  function selectEnquiry(enquiryId) {
    const enquiry = enquiries.find((row) => row.id === enquiryId);
    setForm((current) => ({
      ...current,
      enquiryId,
      items: enquiry ? enquiry.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.product.basePrice,
        discountPercent: 0,
        gstPercent: 18,
      })) : [],
    }));
  }
  async function create(event) { event.preventDefault(); try { await api.post('/quotations', form); setShowForm(false); setForm({ enquiryId: '', validUntil: '', items: [] }); setNotice({ message: 'Draft quotation created. Totals were calculated by the server.' }); load(); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } }
  async function status(id, value) { try { await api.patch(`/quotations/${id}/status`, { status: value }); setNotice({ message: `Quotation marked ${value.toLowerCase()}.` }); load(); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } }
  async function convert(id) { try { const { data } = await api.post(`/quotations/${id}/convert`); setNotice({ message: `Sales order ${data.data.orderNumber} created.` }); load(); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } }
  return <><header className="page-header"><div><p className="eyebrow">Commercial control</p><h1>Quotations</h1><p>Server-calculated line discounts and GST preserve financial history.</p></div>{isSalesUser && <button className="primary-button" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close form' : '+ New quotation'}</button>}</header><Notice notice={notice} />
    {isSalesUser && showForm && <section className="form-card"><h2>Create draft quotation</h2><form onSubmit={create}><div className="form-grid two-columns"><label>Enquiry<select value={form.enquiryId} onChange={(e) => selectEnquiry(e.target.value)} required><option value="">Select enquiry</option>{enquiries.map((row) => <option key={row.id} value={row.id}>{row.enquiryNumber} — {row.customer.companyName}</option>)}</select></label><label>Valid until<input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required /></label></div><h3>Priced products <small>Products and quantities come from the selected enquiry.</small></h3><ItemEditor key={form.enquiryId || 'no-enquiry'} quotation products={enquiryProducts} value={form.items} onChange={(items) => setForm((old) => ({ ...old, items }))} /><button className="primary-button">Create draft</button></form></section>}
    <section className="table-card"><div className="table-title"><h2>All quotations</h2><span>{quotations.length} records</span></div>{loading ? <p className="empty-state">Loading quotations…</p> : <div className="table-scroll"><table><thead><tr><th>Quotation</th><th>Customer</th><th>Valid until</th><th>Total</th><th>Status</th><th>{isSalesUser ? 'Actions' : 'Sales order'}</th></tr></thead><tbody>{quotations.map((q) => <tr key={q.id}><td><strong>{q.quotationNumber}</strong><small>{q.enquiry.enquiryNumber}</small></td><td>{q.customer.companyName}</td><td>{new Date(q.validUntil).toLocaleDateString()}</td><td>{money(q.grandTotal)}</td><td><StatusBadge status={q.status} /></td><td className="action-cell">{isSalesUser && q.status === 'DRAFT' && <button className="secondary-button" onClick={() => status(q.id, 'SENT')}>Mark sent</button>}{isSalesUser && q.status === 'SENT' && <><button className="secondary-button" onClick={() => status(q.id, 'ACCEPTED')}>Accept</button><button className="text-button danger" onClick={() => status(q.id, 'REJECTED')}>Reject</button></>}{isSalesUser && q.status === 'ACCEPTED' && !q.salesOrder && <button className="primary-button small" onClick={() => convert(q.id)}>Convert to order</button>}{q.salesOrder && <span className="linked-record">{q.salesOrder.orderNumber}</span>}</td></tr>)}{!quotations.length && <tr><td colSpan="6" className="empty-state">No quotations yet.</td></tr>}</tbody></table></div>}</section></>;
}

