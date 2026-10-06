import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Notice from '../components/Notice.jsx';

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState({ productId: '', quantity: '', note: '' });
  const [showReceipt, setShowReceipt] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ productCode: '', name: '', category: '', unit: '', basePrice: '', initialQuantity: '0' });
  async function load() { setLoading(true); try { const { data } = await api.get('/inventory'); setRows(data.data); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (searchParams.get('receive') === '1' && user.role === 'ADMIN') {
      setShowReceipt(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, user.role]);
  useEffect(() => {
    if (searchParams.get('newProduct') === '1' && isAdmin) {
      setShowProductForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [isAdmin, searchParams, setSearchParams]);
  async function receive(event) { event.preventDefault(); try { await api.post('/inventory/receipts', receipt); setReceipt({ productId: '', quantity: '', note: '' }); setShowReceipt(false); setNotice({ message: 'Stock receipt posted to the movement ledger.' }); load(); } catch (err) { setNotice({ type: 'error', message: apiError(err) }); } }
  async function addProduct(event) {
    event.preventDefault();
    try {
      await api.post('/products', newProduct);
      setNewProduct({ productCode: '', name: '', category: '', unit: '', basePrice: '', initialQuantity: '0' });
      setShowProductForm(false);
      setNotice({ message: 'Product created and opening stock recorded.' });
      load();
    } catch (err) {
      setNotice({ type: 'error', message: apiError(err) });
    }
  }

  return <><header className="page-header"><div><p className="eyebrow">Stock visibility</p><h1>Inventory availability</h1><p>Available is always physical stock minus stock reserved by confirmed orders.</p></div>{isAdmin && <div className="page-header-actions"><button className="secondary-button" onClick={() => { setShowReceipt((value) => !value); setShowProductForm(false); }}>{showReceipt ? 'Close stock form' : 'Manage stock'}</button><button className="primary-button" onClick={() => { setShowProductForm((value) => !value); setShowReceipt(false); }}>{showProductForm ? 'Close product form' : '+ Add new product'}</button></div>}</header><Notice notice={notice} />
    {showReceipt && <section className="form-card compact"><h2>Receive stock</h2><p className="muted">Add received units to an existing product. Available stock updates automatically.</p><form className="form-grid two-columns" onSubmit={receive}><label>Product<select value={receipt.productId} onChange={(e) => setReceipt({ ...receipt, productId: e.target.value })} required><option value="">Select product</option>{rows.map((row) => <option value={row.productId} key={row.id}>{row.product.productCode} — {row.product.name}</option>)}</select></label><label>Quantity received<input type="number" min="1" value={receipt.quantity} onChange={(e) => setReceipt({ ...receipt, quantity: e.target.value })} required /></label><label className="full-span">Internal note (optional)<input value={receipt.note} onChange={(e) => setReceipt({ ...receipt, note: e.target.value })} /></label><div className="form-actions"><button className="primary-button">Post receipt</button><button type="button" className="secondary-button" onClick={() => setShowReceipt(false)}>Cancel</button></div></form></section>}
    {isAdmin && showProductForm && <section className="form-card compact"><h2>Add product to inventory</h2><p className="muted">Creates a catalog product and its opening stock together.</p><form className="form-grid two-columns" onSubmit={addProduct}><label>Product code<input value={newProduct.productCode} onChange={(e) => setNewProduct({ ...newProduct, productCode: e.target.value })} maxLength="40" required /></label><label>Product name<input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} maxLength="160" required /></label><label>Category<input value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} maxLength="100" required /></label><label>Unit<input value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} maxLength="30" placeholder="Nos, kg, meter…" required /></label><label>Base price<input type="number" min="0" step="0.01" value={newProduct.basePrice} onChange={(e) => setNewProduct({ ...newProduct, basePrice: e.target.value })} required /></label><label>Opening stock<input type="number" min="0" step="1" value={newProduct.initialQuantity} onChange={(e) => setNewProduct({ ...newProduct, initialQuantity: e.target.value })} required /></label><div className="form-actions full-span"><button className="primary-button">Create product & stock</button><button type="button" className="secondary-button" onClick={() => setShowProductForm(false)}>Cancel</button></div></form></section>}
    <section className="table-card"><div className="table-title"><h2>Live stock positions</h2><span>Read-only availability for sales</span></div>{loading ? <p className="empty-state">Loading inventory…</p> : <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Physical</th><th>Reserved</th><th>Available</th><th>Unit</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.product.productCode}</strong><small>{row.product.name}</small></td><td>{row.product.category}</td><td>{row.physicalQuantity}</td><td>{row.reservedQuantity}</td><td><strong className={row.availableQuantity === 0 ? 'stock-low' : 'stock-ok'}>{row.availableQuantity}</strong></td><td>{row.product.unit}</td></tr>)}</tbody></table></div>}</section></>;
}

