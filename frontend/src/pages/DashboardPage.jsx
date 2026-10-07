import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Notice from '../components/Notice.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const isSalesUser = user.role === 'SALES_USER';
  const [summary, setSummary] = useState({
    enquiries: 0,
    activeQuotes: 0,
    sentQuotes: 0,
    acceptedQuotes: 0,
    totalOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    inventoryLines: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState();

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const [enquiriesRes, quotationsRes, ordersRes, inventoryRes] = await Promise.all([
          api.get('/enquiries'),
          api.get('/quotations'),
          api.get('/sales-orders'),
          api.get('/inventory'),
        ]);

        const enquiries = enquiriesRes.data.data || [];
        const quotations = quotationsRes.data.data || [];
        const orders = ordersRes.data.data || [];
        const inventory = inventoryRes.data.data || [];

        setSummary({
          enquiries: enquiries.filter((enquiry) => ['NEW', 'QUOTED'].includes(enquiry.status)).length,
          activeQuotes: quotations.filter((quote) => ['DRAFT', 'SENT'].includes(quote.status)).length,
          sentQuotes: quotations.filter((quote) => quote.status === 'SENT').length,
          acceptedQuotes: quotations.filter((quote) => quote.status === 'ACCEPTED' && !quote.salesOrder).length,
          totalOrders: orders.length,
          pendingOrders: orders.filter((order) => order.status === 'PENDING').length,
          confirmedOrders: orders.filter((order) => order.status === 'CONFIRMED').length,
          inventoryLines: inventory.length,
          lowStock: inventory.filter((row) => row.availableQuantity <= 10).length,
        });
      } catch (err) {
        setNotice({ type: 'error', message: apiError(err) });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const cards = isSalesUser
    ? [
      { label: 'Active enquiries', value: summary.enquiries, detail: 'New customer demand', to: '/enquiries' },
      { label: 'Quotes in progress', value: summary.activeQuotes, detail: 'Draft or waiting for admin approval', to: '/quotations' },
      { label: 'Accepted quotes', value: summary.acceptedQuotes, detail: 'Ready to become orders', to: '/quotations' },
      { label: 'Orders created', value: summary.totalOrders, detail: 'Track fulfilment progress', to: '/orders' },
    ]
    : [
      { label: 'Quotes awaiting approval', value: summary.sentQuotes, detail: 'Accept or reject sent quotations', to: '/quotations' },
      { label: 'Awaiting confirmation', value: summary.pendingOrders, detail: 'Orders needing stock reservation', to: '/orders' },
      { label: 'Ready to dispatch', value: summary.confirmedOrders, detail: 'Confirmed and reserved orders', to: '/orders' },
      { label: 'Low stock alerts', value: summary.lowStock, detail: 'Available quantity at or below 10', to: '/inventory' },
    ];

  const workflow = isSalesUser
    ? [
      { label: 'Start a customer enquiry', detail: 'Capture products and required dates', to: '/enquiries?new=1' },
      { label: 'Prepare and send a quotation', detail: 'Set pricing, then mark sent for admin approval', to: '/quotations' },
      { label: 'Convert accepted quotes', detail: 'After admin approval, create a sales order', to: '/quotations' },
      { label: 'Check stock availability', detail: 'See live physical and reserved stock', to: '/inventory' },
    ]
    : [
      { label: 'Approve sent quotations', detail: 'Accept or reject quotes from sales', to: '/quotations' },
      { label: 'Confirm pending orders', detail: 'Check availability and reserve stock', to: '/orders' },
      { label: 'Receive incoming stock', detail: 'Add units to an existing product', to: '/inventory?receive=1' },
      { label: 'Dispatch confirmed orders', detail: 'Ship quantities already reserved', to: '/orders' },
      { label: 'Review inventory position', detail: 'Compare physical, reserved, and available', to: '/inventory' },
    ];

  return (
    <>
      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">{isSalesUser ? 'SALES OVERVIEW' : 'ADMIN OVERVIEW'}</p>
          <h1>{isSalesUser ? 'Commercial pipeline' : 'Operations control'}</h1>
        </div>
        {isSalesUser ? (
          <Link className="primary-button" to="/enquiries?new=1">+ New enquiry</Link>
        ) : (
          <Link className="primary-button" to="/orders">Review order queue</Link>
        )}
      </header>

      <Notice notice={notice} />

      <section className="dashboard-welcome">
        <div>
          <p className="welcome-kicker">{isSalesUser ? 'CUSTOMER TO ORDER' : 'STOCK TO SHIPMENT'}</p>
          <h2>{isSalesUser ? 'Keep every customer request moving.' : 'Keep fulfilment accurate and on time.'}</h2>
          <p>{isSalesUser
            ? 'Manage enquiries, send quotations for admin approval, and convert accepted quotes into orders.'
            : 'Approve sent quotations, then confirm orders, protect reserved stock, and complete dispatch with a clear inventory trail.'}</p>
        </div>
        <div className="welcome-aside">
          <span>{isSalesUser ? 'YOUR DESK' : 'CONTROL ROOM'}</span>
          <strong>{isSalesUser ? 'Sales' : 'Admin'}</strong>
          <small>{isSalesUser ? 'Customer relationships & commercial flow' : 'Inventory integrity & order fulfilment'}</small>
        </div>
      </section>

      {loading ? (
        <div className="loading-panel">Loading operations…</div>
      ) : (
        <>
          <section className="stats-grid">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="stat-card dashboard-stat-link">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
                <span className="dashboard-link-hint">View section <span aria-hidden="true">→</span></span>
              </Link>
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel-card">
              <div className="panel-header-row">
                <div>
                  <p className="panel-kicker">{isSalesUser ? 'COMMERCIAL FLOW' : 'FULFILMENT FLOW'}</p>
                  <h3>{isSalesUser ? 'Move demand forward' : 'Keep operations moving'}</h3>
                </div>
              </div>

              <div className="workflow-list">
                {workflow.map((step, index) => (
                  <Link key={step.label} to={step.to} className="workflow-step">
                    <span className="workflow-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="workflow-copy">
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </span>
                    <span className="workflow-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-header-row">
                <h3>Commercial snapshot</h3>
                <Link to={isSalesUser ? '/enquiries' : '/orders'} className="text-button">
                  {isSalesUser ? 'All enquiries →' : 'All orders →'}
                </Link>
              </div>

              <div className="metric-list">
                {isSalesUser ? <>
                  <div className="metric-row"><span>Open enquiries</span><strong>{summary.enquiries}</strong></div>
                  <div className="metric-row"><span>Quotes in progress</span><strong>{summary.activeQuotes}</strong></div>
                  <div className="metric-row"><span>Accepted, not converted</span><strong>{summary.acceptedQuotes}</strong></div>
                  <div className="metric-row"><span>Orders to track</span><strong>{summary.totalOrders}</strong></div>
                </> : <>
                  <div className="metric-row"><span>Quotes awaiting approval</span><strong>{summary.sentQuotes}</strong></div>
                  <div className="metric-row"><span>Orders to confirm</span><strong>{summary.pendingOrders}</strong></div>
                  <div className="metric-row"><span>Orders to dispatch</span><strong>{summary.confirmedOrders}</strong></div>
                  <div className="metric-row"><span>Products tracked</span><strong>{summary.inventoryLines}</strong></div>
                  <div className="metric-row"><span>Low-stock alerts</span><strong>{summary.lowStock}</strong></div>
                </>}
              </div>
            </article>
          </section>

          <section className="panel-card summary-card">
            <div className="panel-header-row">
              <h3>Business priorities</h3>
            </div>

            <ul className="priority-list">
              <li>
                <span className="priority-dot success"></span>
                {isSalesUser ? 'Respond to active enquiries and keep customer requirements clear.' : 'Accept or reject sent quotations before fulfilment starts.'}
              </li>
              <li>
                <span className="priority-dot warning"></span>
                {isSalesUser ? 'Mark quotations sent so admin can accept or reject them.' : 'Confirm only orders with sufficient available stock.'}
              </li>
              <li>
                <span className="priority-dot neutral"></span>
                {isSalesUser ? 'Convert admin-accepted quotations so fulfilment can begin.' : 'Dispatch confirmed orders so physical and reserved quantities stay aligned.'}
              </li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}
