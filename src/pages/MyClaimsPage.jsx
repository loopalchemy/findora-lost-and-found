import { Link } from 'react-router-dom';
import { EmptyState, PageIntro, StatusBadge } from '../components/UI.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function MyClaimsPage() {
  const { data, currentUser } = useApp();
  const claims = data.claims.filter((claim) => claim.userId === currentUser?.id);
  return <section className="section container"><PageIntro eyebrow="Student / Staff account" title="My claims" text="Only your own claims appear here. Review decisions do not automatically mark a report recovered." />
    {claims.length ? <div className="claims-list">{claims.map((claim) => <article className="claim-record" key={claim.id}><div><span className="eyebrow">Submitted {new Date(claim.createdAt).toLocaleDateString()}</span><h2>{data.reports.find((item) => item.id === claim.reportId)?.title || claim.itemTitle || 'Item report'}</h2><p>{claim.explanation}</p><Link className="text-link" to={`/items/${claim.reportId}`}>View item report</Link></div><StatusBadge status={claim.status} /></article>)}</div> : <EmptyState title="No claims to track" text="Open an approved found-item report and submit a claim if you can verify ownership." action={<Link to="/browse?type=found" className="btn btn--primary">Browse found items</Link>} />}
  </section>;
}
