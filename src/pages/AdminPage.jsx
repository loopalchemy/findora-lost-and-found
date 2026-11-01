import { Link } from 'react-router-dom';
import { ArrowRight, Archive, ClipboardList, MessageSquareText, Users } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { PageIntro, StatusBadge } from '../components/UI.jsx';

export default function AdminPage() {
  const { data } = useApp();
  const stats = data.statistics;
  const recent = [
    ...data.reports.map((report) => ({ label: `${report.type === 'lost' ? 'Lost' : 'Found'} report · ${report.title}`, status: report.status, date: report.updatedAt || report.createdAt, path: '/admin/reports' })),
    ...data.claims.map((claim) => ({ label: `Claim · ${claim.itemTitle || data.reports.find((report) => report.id === claim.reportId)?.title || 'Item'}`, status: claim.status, date: claim.reviewedAt || claim.createdAt, path: '/admin/claims' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return <section className="section container">
    <PageIntro eyebrow={`Administrator · ${data.users.length} registered accounts`} title="Campus overview" text="A current view of report and claim records retrieved from MySQL." />
    <div className="stat-grid">
      <Link className="stat-card" to="/admin/reports"><span><ClipboardList size={18} /></span><small>Total reports</small><b>{stats.reports.total}</b><em>Review all reports <ArrowRight size={14} /></em></Link>
      <Link className="stat-card" to="/admin/reports"><span><Archive size={18} /></span><small>Pending reports</small><b>{stats.reports.pending}</b><em>Waiting for a decision <ArrowRight size={14} /></em></Link>
      <Link className="stat-card" to="/admin/claims"><span><MessageSquareText size={18} /></span><small>Pending claims</small><b>{stats.claims.pending}</b><em>Waiting for review <ArrowRight size={14} /></em></Link>
      <Link className="stat-card" to="/admin/statistics"><span><Archive size={18} /></span><small>Recovered reports</small><b>{stats.reports.recovered}</b><em>View statistics <ArrowRight size={14} /></em></Link>
    </div>
    <div className="dashboard-columns"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">Database records</span><h2>Recent activity</h2></div><Link className="text-link" to="/admin/reports">Manage <ArrowRight size={14} /></Link></div>{recent.length ? recent.map((entry, index) => <Link className="activity-row" to={entry.path} key={`${entry.label}-${index}`}><span className="activity-dot" /><div><small>{new Date(entry.date).toLocaleDateString()}</small><b>{entry.label}</b></div><StatusBadge status={entry.status} /></Link>) : <p className="muted">No report or claim activity is recorded yet.</p>}</div>
      <div className="admin-link-panel"><span className="eyebrow">Manage the platform</span><Link to="/admin/reports"><ClipboardList size={19} /><span><b>Reports</b><small>Approve, reject or recover</small></span><ArrowRight size={15} /></Link><Link to="/admin/claims"><MessageSquareText size={19} /><span><b>Claims</b><small>Review ownership explanations</small></span><ArrowRight size={15} /></Link><Link to="/admin/management"><Users size={19} /><span><b>Users &amp; categories</b><small>Registered accounts and choices</small></span><ArrowRight size={15} /></Link><Link to="/admin/statistics"><Archive size={19} /><span><b>Statistics</b><small>Counts from database records</small></span><ArrowRight size={15} /></Link></div>
    </div>
  </section>;
}
