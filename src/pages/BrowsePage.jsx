import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState, ItemCard, PageIntro } from '../components/UI.jsx';
import { api } from '../services/apiClient.js';
import '../styles/integration.css';

const FILTER_KEYS = ['q', 'type', 'category', 'location', 'from', 'to', 'status'];

export default function BrowsePage() {
  const { data } = useApp();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || ''])));
  const [sort, setSort] = useState('newest');
  const [remoteReports, setRemoteReports] = useState([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const result = await api.getReports({ ...filters, scope: 'public', sort, limit: 500 }, { signal: controller.signal });
        if (active) setRemoteReports((result.reports || []).filter((report) => ['Approved', 'Recovered'].includes(report.status)));
      } catch (error) {
        if (!active || error.name === 'AbortError') return;
        setRemoteReports([]);
        setSearchError(error.message || 'Search could not be completed.');
      } finally {
        if (active) setSearching(false);
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, sort]);

  const shown = useMemo(() => [...remoteReports].sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)), [remoteReports, sort]);

  const change = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setParams(Object.fromEntries(FILTER_KEYS.filter((field) => next[field]).map((field) => [field, next[field]])), { replace: true });
  };

  const clear = () => {
    setFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])));
    setParams({}, { replace: true });
  };

  return <section className="section container">
    <PageIntro eyebrow="The campus board" title="Browse reports" text="Search approved lost and found reports. Pending reports stay private until review." action={<Link className="btn btn--primary" to="/report">Report an item</Link>} />
    <div className="filter-panel">
      <div className="filter-panel__top"><div><Filter size={17} /><b>Find a report</b></div><button className="text-button" type="button" onClick={clear}><RotateCcw size={14} /> Clear filters</button></div>
      <div className="filter-grid">
        <label className="filter-field filter-field--search"><span>Keyword</span><div><Search size={16} aria-hidden="true" /><input value={filters.q} onChange={(event) => change('q', event.target.value)} placeholder="Item, detail or place" /></div></label>
        <label className="filter-field"><span>Report type</span><select value={filters.type} onChange={(event) => change('type', event.target.value)}><option value="">Lost + found</option><option value="lost">Lost</option><option value="found">Found</option></select></label>
        <label className="filter-field"><span>Category</span><select value={filters.category} onChange={(event) => change('category', event.target.value)}><option value="">All categories</option>{data.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="filter-field"><span>Location contains</span><input value={filters.location} onChange={(event) => change('location', event.target.value)} placeholder="e.g. Library" /></label>
        <label className="filter-field"><span>From date</span><input type="date" value={filters.from} onChange={(event) => change('from', event.target.value)} /></label>
        <label className="filter-field"><span>To date</span><input type="date" value={filters.to} onChange={(event) => change('to', event.target.value)} /></label>
        <label className="filter-field"><span>Status</span><select value={filters.status} onChange={(event) => change('status', event.target.value)}><option value="">Any visible status</option><option value="Approved">Approved</option><option value="Recovered">Recovered</option></select></label>
      </div>
    </div>
    {searchError && <p className="browse-result-message browse-result-message--error" role="alert">{searchError}</p>}
    <div className="results-bar"><p aria-live="polite"><b>{shown.length}</b> {shown.length === 1 ? 'report' : 'reports'} found{searching ? ' · searching' : ''}</p><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
    {searching && !shown.length ? <p className="browse-result-message" role="status">Searching current reports…</p> : shown.length ? <div className="item-grid">{shown.map((item) => <ItemCard key={item.id} item={item} />)}</div> : <EmptyState title="No reports match those filters" text="Try a broader keyword or clear some filters." action={<button className="btn btn--outline" type="button" onClick={clear}>Clear filters</button>} />}
  </section>;
}
