import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Notice from '../components/Notice.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));

export default function SalesOrdersPage() {
  const { user } = useAuth(); const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(); const [dispatching, setDispatching] = useState(null); const [dispatch, setDispatch] = useState({ vehicleNumber: '', driverName: '' });
  async function load() { setLoading(true); try { const { data } = await api.get('/sales-orders'); setOrders(data.data); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function confirm(id) { try { await api.post(`/sales-orders/${id}/confirm`); setNotice({ message: 'Order confirmed and inventory reserved atomically.' }); load(); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } }
  async function cancel(id) {
    const wasConfirmed = orders.find((order) => order.id === id)?.status === 'CONFIRMED';
    if (!window.confirm(wasConfirmed ? 'Cancel this confirmed order and release its reserved stock?' : 'Cancel this pending order?')) return;
    try {
      await api.post(`/sales-orders/${id}/cancel`);
      setNotice({ message: wasConfirmed ? 'Order cancelled and reserved stock released.' : 'Pending order cancelled.' });
      load();
    } catch (err) {
      setNotice({ type: 'error', message: apiError(err) });
    }
  }
  async function submitDispatch(event) { event.preventDefault(); try { const { data } = await api.post(`/sales-orders/${dispatching}/dispatch`, dispatch); setNotice({ message: `Dispatch ${data.data.dispatch.dispatchNumber} posted. Physical and reserved stock were updated.` }); setDispatching(null); setDispatch({ vehicleNumber: '', driverName: '' }); load(); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } }
  const isAdmin = user.role === 'ADMIN';
  return <><header className="page-header"><div><p className="eyebrow">Fulfilment control</p><h1>Sales orders</h1><p>Confirmation reserves stock. Dispatch consumes only the reserved quantities.</p></div></header><Notice notice={notice} />
    {dispatching && <section className="form-card compact"><h2>Dispatch confirmed order</h2><form className="form-grid two-columns" onSubmit={submitDispatch}><label>Vehicle number<input value={dispatch.vehicleNumber} onChange={(e) => setDispatch({ ...dispatch, vehicleNumber: e.target.value })} required /></label><label>Driver name<input value={dispatch.driverName} onChange={(e) => setDispatch({ ...dispatch, driverName: e.target.value })} required /></label><div className="form-actions"><button className="primary-button">Post dispatch</button><button type="button" className="secondary-button" onClick={() => setDispatching(null)}>Cancel</button></div></form></section>}
    <section className="table-card"><div className="table-title"><h2>Orders from accepted quotations</h2><span>{orders.length} records</span></div>{loading ? <p className="empty-state">Loading orders…</p> : <div className="table-scroll"><table><thead><tr><th>Sales order</th><th>Customer</th><th>Products</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong><small>{order.quotation.quotationNumber}</small></td><td>{order.customer.companyName}</td><td>{order.items.map((item) => `${item.product.productCode} × ${item.quantity}`).join(', ')}</td><td>{money(order.totalAmount)}</td><td><StatusBadge status={order.status} /></td><td className="action-cell">{isAdmin && order.status === 'PENDING' && <><button className="primary-button small" onClick={() => confirm(order.id)}>Confirm & reserve</button><button className="text-button danger" onClick={() => cancel(order.id)}>Cancel order</button></>}{isAdmin && order.status === 'CONFIRMED' && <><button className="primary-button small" onClick={() => setDispatching(order.id)}>Dispatch</button><button className="text-button danger" onClick={() => cancel(order.id)}>Cancel & release stock</button></>}{order.dispatch && <span className="linked-record">{order.dispatch.dispatchNumber}</span>}{!isAdmin && order.status === 'PENDING' && <span className="muted">Admin confirmation required</span>}{order.status === 'CANCELLED' && <span className="muted">Cancelled</span>}</td></tr>)}{!orders.length && <tr><td colSpan="6" className="empty-state">Convert an accepted quotation to create an order.</td></tr>}</tbody></table></div>}</section></>;
}

