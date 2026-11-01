import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState, PageIntro, StatusBadge } from '../components/UI.jsx';

export default function AdminClaimsPage() {
  const { data, actions } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Pending review');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => data.claims.filter((claim) => !filter || claim.status === filter).map((claim) => ({
    claim,
    item: data.reports.find((report) => report.id === claim.reportId),
    user: data.users.find((user) => user.id === claim.userId),
  })).filter(({ claim, item, user }) => `${item?.title || claim.itemTitle || ''} ${user?.name || claim.claimantName || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.claim.createdAt.localeCompare(a.claim.createdAt)), [data, filter, query]);

  const decide = async (claim, status, title) => {
    if (!window.confirm(`${status} this claim for “${title}”? This will not mark the item recovered.`)) return;
    setBusy(true); setNotice(''); setError('');
    try {
      await actions.updateClaimStatus(claim.id, status);
      setNotice(`Claim ${status.toLowerCase()}. The report status was not changed.`);
    } catch (cause) {
      setError(cause.message || 'The claim could not be updated. Refresh and retry.');
    } finally { setBusy(false); }
  };

  return <section className="section container"><PageIntro eyebrow="Administrator · ownership review" title="Manage claims" text="Review the explanation with the relevant found-item report. Claim decisions do not change report recovery status." />
    {notice && <p className="success-note" role="status">{notice}</p>}{error && <p className="field__error" role="alert">{error}</p>}
    <div className="admin-filters"><label className="search-box"><Search size={17} /><span className="sr-only">Search claims</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item or claimant" /></label><label className="filter-field"><span>Status</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{['Pending review', 'Approved', 'Rejected'].map((value) => <option key={value}>{value}</option>)}</select></label><span className="muted">{rows.length} claims</span></div>
    {rows.length ? <div className="claims-list">{rows.map(({ claim, item, user }) => <article className="claim-record claim-record--admin" key={claim.id}><div><div className="claim-record__head"><span className="eyebrow">{user?.name || claim.claimantName || 'University user'} · submitted {new Date(claim.createdAt).toLocaleDateString()}</span><StatusBadge status={claim.status} /></div><h2>{item?.title || claim.itemTitle || 'Missing report'}</h2><p className="claim-context">{item ? `${item.category} · ${item.location} · report ${item.status}` : `${claim.category} · ${claim.location} · report ${claim.itemStatus}`}</p><blockquote>{claim.explanation}</blockquote><Link className="text-link" to={item ? `/items/${item.id}` : `/items/${claim.reportId}`}>Open found-item report</Link></div>{claim.status === 'Pending review' && <div className="claim-actions"><button className="btn btn--small btn--primary" disabled={busy} onClick={() => decide(claim, 'Approved', item?.title || claim.itemTitle || 'item')}>Approve claim</button><button className="btn btn--small btn--danger" disabled={busy} onClick={() => decide(claim, 'Rejected', item?.title || claim.itemTitle || 'item')}>Reject claim</button></div>}</article>)}</div> : <EmptyState title="No claims in this view" text="Try another status, or check again when a student or staff member submits a claim." />}
  </section>;
}
