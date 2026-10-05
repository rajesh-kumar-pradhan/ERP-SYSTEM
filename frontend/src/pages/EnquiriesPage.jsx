import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import ItemEditor from '../components/ItemEditor.jsx';
import Notice from '../components/Notice.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const blankCustomer = { companyName: '', contactPerson: '', mobile: '', email: '', city: '' };

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [notice, setNotice] = useState();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ customerId: '', requiredDate: '', notes: '', items: [] });
  const [customer, setCustomer] = useState(blankCustomer);

  async function load() {
    setLoading(true);

    try {
      const [enquiriesRes, customersRes, productsRes] = await Promise.all([
        api.get('/enquiries'),
        api.get('/customers'),
        api.get('/products'),
      ]);

      setEnquiries(enquiriesRes.data.data);
      setCustomers(customersRes.data.data);
      setProducts(productsRes.data.data);
    } catch (err) {
      setNotice({ type: 'error', message: apiError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCustomer(event) {
    event.preventDefault();

    try {
      const { data } = await api.post('/customers', customer);
      const updatedCustomers = [...customers, data.data].sort((a, b) => a.companyName.localeCompare(b.companyName));

      setCustomers(updatedCustomers);
      setForm({ ...form, customerId: data.data.id });
      setCustomer(blankCustomer);
      setShowCustomer(false);
      setNotice({ message: 'Customer created and selected.' });
    } catch (err) {
      setNotice({ type: 'error', message: apiError(err) });
    }
  }

  async function createEnquiry(event) {
    event.preventDefault();

    try {
      await api.post('/enquiries', form);
      setShowForm(false);
      setForm({ customerId: '', requiredDate: '', notes: '', items: [] });
      setNotice({ message: 'Enquiry created.' });
      load();
    } catch (err) {
      setNotice({ type: 'error', message: apiError(err) });
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1>Enquiries</h1>
        </div>
        <button className="primary-button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Close form' : '+ New enquiry'}
        </button>
      </header>

      <Notice notice={notice} />

      {showCustomer && (
        <section className="form-card">
          <h2>New customer</h2>
          <form className="form-grid two-columns" onSubmit={createCustomer}>
            {Object.entries(blankCustomer).map(([key]) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, ' $1')}
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={customer[key]}
                  onChange={(e) => setCustomer({ ...customer, [key]: e.target.value })}
                  required
                />
              </label>
            ))}

            <div className="form-actions">
              <button className="primary-button">Save customer</button>
              <button type="button" className="secondary-button" onClick={() => setShowCustomer(false)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {showForm && (
        <section className="form-card">
          <div className="form-heading">
            <h2>New enquiry</h2>
            <button className="text-button" type="button" onClick={() => setShowCustomer(true)}>
              + Add customer
            </button>
          </div>

          <form onSubmit={createEnquiry}>
            <div className="form-grid two-columns">
              <label>
                Customer
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select customer</option>
                  {customers.map((customerItem) => (
                    <option key={customerItem.id} value={customerItem.id}>
                      {customerItem.companyName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Required date
                <input type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} required />
              </label>

              <label className="full-span">
                Notes
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength="2000" />
              </label>
            </div>

            <h3>Requested products</h3>
            <ItemEditor
              products={products}
              value={form.items}
              onChange={(items) => setForm((current) => ({ ...current, items }))}
            />

            <button className="primary-button">Create enquiry</button>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-title">
          <h2>All enquiries</h2>
          <span>{enquiries.length} records</span>
        </div>

        {loading ? (
          <p className="empty-state">Loading enquiries…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Enquiry</th>
                  <th>Customer</th>
                  <th>Required</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.enquiryNumber}</strong>
                      <small>{new Date(item.enquiryDate).toLocaleDateString()}</small>
                    </td>
                    <td>{item.customer.companyName}</td>
                    <td>{new Date(item.requiredDate).toLocaleDateString()}</td>
                    <td>{item.items.map((line) => `${line.product.productCode} × ${line.quantity}`).join(', ')}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}

                {!enquiries.length && (
                  <tr>
                    <td colSpan="5" className="empty-state">No enquiries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

