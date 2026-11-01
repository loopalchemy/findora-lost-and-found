import { useApp } from '../context/AppContext.jsx';
import { PageIntro } from '../components/UI.jsx';

function Bars({ title, rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">Calculated by MySQL</span><h2>{title}</h2></div></div>{rows.map((row) => <div className="bar-row" key={row.label}><div><span>{row.label}</span><b>{row.value}</b></div><div className="bar-track"><span style={{ width: `${Math.round(row.value / max * 100)}%` }} /></div></div>)}</section>;
}

export default function StatisticsPage() {
  const { data } = useApp();
  const reports = data.statistics.reports;
  const claims = data.statistics.claims;
  const categoryRows = (reports.byCategory || []).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  return <section className="section container"><PageIntro eyebrow="Administrator · database summaries" title="Activity statistics" text="These aggregates are queried from the university_lost_found MySQL database; they are not demonstration figures." />
    <div className="stats-overview"><div><span>Total reports</span><b>{reports.total}</b></div><div><span>Total claims</span><b>{claims.total}</b></div><div><span>Recovered reports</span><b>{reports.recovered}</b></div><div><span>Pending work</span><b>{reports.pending + claims.pending}</b></div></div>
    <div className="charts-grid"><Bars title="Reports by type" rows={[{ label: 'Lost', value: reports.lost }, { label: 'Found', value: reports.found }]} /><Bars title="Reports by status" rows={[{ label: 'Pending review', value: reports.pending }, { label: 'Approved', value: reports.approved }, { label: 'Rejected', value: reports.rejected }, { label: 'Recovered', value: reports.recovered }]} /><Bars title="Claims by status" rows={[{ label: 'Pending review', value: claims.pending }, { label: 'Approved', value: claims.approved }, { label: 'Rejected', value: claims.rejected }]} /><Bars title="Reports by category" rows={categoryRows.length ? categoryRows : [{ label: 'No reports yet', value: 0 }]} /></div>
  </section>;
}
