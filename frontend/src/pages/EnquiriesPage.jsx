import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ItemEditor from '../components/ItemEditor.jsx';
import Notice from '../components/Notice.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const blankCustomer = { companyName: '', contactPerson: '', mobile: '', email: '', city: '' };

export default function EnquiriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isSalesUser = user.role === 'SALES_USER';
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showCustomerDirectory, setShowCustomerDirectory] = useState(false);
  const [notice, setNotice] = useState();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ customerId: '', requiredDate: '', notes: '', items: [] });
  const [customer, setCustomer] = useState(blankCustomer);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isSalesUser) {
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [isSalesUser, searchParams, setSearchParams]);

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

  async function deleteCustomer(customerItem) {
    if (!window.confirm(`Delete ${customerItem.companyName}? Customers with enquiry history cannot be deleted.`)) return;

    try {
      await api.delete(`/customers/${customerItem.id}`);
      setCustomers((current) => current.filter((item) => item.id !== customerItem.id));
      setForm((current) => current.customerId === customerItem.id ? { ...current, customerId: '' } : current);
      setNotice({ message: `${customerItem.companyName} was deleted.` });
    } catch (err) {
      setNotice({ type: 'error', message: apiError(err) });
    }
  }

  function customerHasHistory(customerId) {
    return enquiries.some((enquiry) => (enquiry.customerId || enquiry.customer?.id) === customerId);
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

  async function markLost(enquiry) {
    if (!window.confirm(`Mark enquiry ${enquiry.enquiryNumber} as lost?`)) return;

    try {
      await api.patch(`/enquiries/${enquiry.id}/status`, { status: 'LOST' });
      setNotice({ message: `${enquiry.enquiryNumber} was marked lost.` });
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
        {isSalesUser && <div className="page-header-actions">
          <button className="secondary-button" onClick={() => setShowCustomerDirectory((value) => !value)}>
            {showCustomerDirectory ? 'Hide customers' : 'Manage customers'}
          </button>
          <button className="primary-button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? 'Close form' : '+ New enquiry'}
          </button>
        </div>}
      </header>

      <Notice notice={notice} />

      {isSalesUser && showCustomer && (
        <section className="form-card">
          <h2>New customer</h2>
          <form className="form-grid two-columns" onSubmit={createCustomer}>
            {Object.entries(blankCustomer).map(([key]) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, ' $1')}
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  minLength={{ companyName: 2, contactPerson: 2, mobile: 7, city: 2 }[key]}
                  maxLength={{ companyName: 160, contactPerson: 120, mobile: 25, email: 254, city: 100 }[key]}
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

      {isSalesUser && showCustomerDirectory && (
        <section className="table-card customer-directory">
          <div className="table-title">
            <div>
              <h2>Customer directory</h2>
              <small>Customers with enquiry history are protected from deletion.</small>
            </div>
            <span>{customers.length} customers</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Company</th><th>Contact</th><th>Location</th><th>Action</th></tr></thead>
              <tbody>
                {customers.map((customerItem) => {
                  const hasHistory = customerHasHistory(customerItem.id);
                  return <tr key={customerItem.id}>
                    <td><strong>{customerItem.companyName}</strong><small>{customerItem.email}</small></td>
                    <td>{customerItem.contactPerson}<small>{customerItem.mobile}</small></td>
                    <td>{customerItem.city}</td>
                    <td>
                      <button
                        type="button"
                        className="text-button danger"
                        disabled={hasHistory}
                        title={hasHistory ? 'Customers with enquiry history cannot be deleted.' : 'Delete unused customer'}
                        onClick={() => deleteCustomer(customerItem)}
                      >
                        {hasHistory ? 'In use' : 'Delete'}
                      </button>
                    </td>
                  </tr>;
                })}
                {!customers.length && <tr><td colSpan="4" className="empty-state">No customers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isSalesUser && showForm && (
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
                  <th>Actions</th>
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
                    <td className="action-cell">
                      {isSalesUser && ['NEW', 'QUOTED'].includes(item.status)
                        ? <button className="text-button danger" onClick={() => markLost(item)}>Mark lost</button>
                        : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}

                {!enquiries.length && (
                  <tr>
                    <td colSpan="6" className="empty-state">No enquiries yet.</td>
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

