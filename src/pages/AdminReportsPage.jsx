import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState, PageIntro, StatusBadge } from '../components/UI.jsx';

export default function AdminReportsPage() {
  const { data, actions } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const results = useMemo(() => data.reports.filter((report) => (!status || report.status === status) && `${report.title} ${report.location} ${report.category}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.reports, query, status]);

  const change = async (report, next) => {
    if (!window.confirm(`${next} report “${report.title}”?`)) return;
    setBusy(true); setNotice(''); setError('');
    try {
      await actions.updateReportStatus(report.id, next);
      setNotice(`“${report.title}” is now ${next.toLowerCase()}.`);
    } catch (cause) {
      setError(cause.message || 'The report could not be updated. Refresh and retry.');
    } finally { setBusy(false); }
  };

  return <section className="section container"><PageIntro eyebrow="Administrator · report review" title="Manage reports" text="Review submitted item reports. Report status remains separate from any ownership-claim decision." />
    {notice && <p className="success-note" role="status">{notice}</p>}{error && <p className="field__error" role="alert">{error}</p>}
    <div className="admin-filters"><label className="search-box"><Search size={17} /><span className="sr-only">Search reports</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, location or category" /></label><label className="filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['Pending review', 'Approved', 'Rejected', 'Recovered'].map((value) => <option key={value}>{value}</option>)}</select></label><span className="muted">{results.length} records</span></div>
    {results.length ? <div className="admin-record-list">{results.map((item) => <article className="admin-record" key={item.id}><div className="admin-record__main"><span className={`type-pill type-pill--${item.type}`}>{item.type === 'lost' ? 'Lost' : 'Found'}</span><h2>{item.title}</h2><p>{item.category} · {item.location} · {new Date(item.date + 'T00:00:00').toLocaleDateString()}</p><small>Reported by {item.reportedBy || 'University user'}</small><Link className="text-link" to={`/items/${item.id}`}>Open report</Link></div><div className="admin-record__actions"><StatusBadge status={item.status} />{item.status === 'Pending review' && <div><button className="btn btn--small btn--primary" disabled={busy} onClick={() => change(item, 'Approved')}>Approve</button><button className="btn btn--small btn--danger" disabled={busy} onClick={() => change(item, 'Rejected')}>Reject</button></div>}{item.status === 'Approved' && <button className="btn btn--small btn--outline" disabled={busy} onClick={() => change(item, 'Recovered')}>Mark recovered</button>}</div></article>)}</div> : <EmptyState title="No reports found" text="Try a different search or status filter." />}
  </section>;
}
