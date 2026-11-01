import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, MessageSquareText, Plus, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState, ItemCard, PageIntro, StatusBadge } from '../components/UI.jsx';

export default function DashboardPage() {
  const { data, currentUser } = useApp();
  const reports = data.reports.filter((item) => item.ownerId === currentUser?.id);
  const claims = data.claims.filter((item) => item.userId === currentUser?.id);
  const recent = [
    ...reports.map((item) => ({ kind: 'Report', label: item.title, status: item.status, date: item.updatedAt || item.createdAt, path: `/items/${item.id}` })),
    ...claims.map((item) => ({ kind: 'Claim', label: item.itemTitle || data.reports.find((report) => report.id === item.reportId)?.title || 'Item report', status: item.status, date: item.createdAt, path: '/my-claims' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return <section className="section container">
    <PageIntro eyebrow={`${currentUser?.role === 'staff' ? 'Staff' : 'Student'} · ${currentUser?.name}`} title="Your activity, in one place" text="Follow your reports and claims from submission through review and recovery." action={<Link className="btn btn--primary" to="/report"><Plus size={16} /> New report</Link>} />
    <div className="stat-grid stat-grid--three">
      <Link className="stat-card" to="/my-reports"><span><ClipboardList size={18} /></span><small>Your reports</small><b>{reports.length}</b><em>Open report list <ArrowRight size={14} /></em></Link>
      <Link className="stat-card" to="/my-claims"><span><MessageSquareText size={18} /></span><small>Your claims</small><b>{claims.length}</b><em>Check claim status <ArrowRight size={14} /></em></Link>
      <div className="stat-card"><span><RotateCcw size={18} /></span><small>Recovered reports</small><b>{reports.filter((report) => report.status === 'Recovered').length}</b><em>Confirmed by an administrator</em></div>
    </div>
    <div className="dashboard-columns"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">Latest updates</span><h2>Recent activity</h2></div><Link className="text-link" to="/my-reports">View reports</Link></div>{recent.length ? recent.map((entry, index) => <Link className="activity-row" key={`${entry.kind}-${entry.label}-${index}`} to={entry.path}><span className="activity-dot" /><div><small>{entry.kind} · {new Date(entry.date).toLocaleDateString()}</small><b>{entry.label}</b></div><StatusBadge status={entry.status} /></Link>) : <EmptyState title="Your activity starts here" text="Create a report or find an eligible item to claim." action={<Link className="btn btn--outline" to="/report">Add a report</Link>} />}</div>
      <div className="panel panel--tint"><span className="eyebrow">A good first step</span><h2>Check the board first</h2><p>Another community member may already have reported what you’re looking for.</p><Link className="btn btn--outline" to="/browse">Browse reports <ArrowRight size={15} /></Link></div>
    </div>
    <div className="section-subhead"><h2>Recently reported items</h2><Link className="text-link" to="/browse">Browse all</Link></div><div className="item-grid item-grid--compact">{data.reports.filter((item) => ['Approved', 'Recovered'].includes(item.status)).slice(0, 3).map((item) => <ItemCard key={item.id} item={item} />)}</div>
  </section>;
}
