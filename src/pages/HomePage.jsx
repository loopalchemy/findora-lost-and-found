import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, BriefcaseBusiness, KeyRound, Laptop, Search, ShieldCheck, Sparkles, Sun, TicketCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { ItemCard, PageIntro } from '../components/UI.jsx';

const categories = [
  ['Bags & backpacks', BriefcaseBusiness], ['Electronics', Laptop], ['Books & stationery', BookOpen], ['Keys & cards', KeyRound], ['Drinkware', Sun], ['Other', Sparkles],
];
export default function HomePage() {
  const { data } = useApp(); const [query, setQuery] = useState(''); const navigate = useNavigate();
  const recent = data.reports.filter((report) => ['Approved', 'Recovered'].includes(report.status)).slice(0, 4);
  const search = (event) => { event.preventDefault(); navigate(`/browse?q=${encodeURIComponent(query)}`); };
  return <>
    <section className="hero container"><div className="hero-copy"><span className="eyebrow"><span className="live-dot" /> A calmer way to reconnect</span><h1>Lost something?<br /><em>Let’s bring it back.</em></h1><p className="hero-text">One campus place to report missing belongings, browse found items and help good things find their way home.</p>
      <form className="hero-search" onSubmit={search}><Search size={19} /><label className="sr-only" htmlFor="home-search">Search item reports</label><input id="home-search" placeholder="Try “blue notebook” or “library”…" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="submit" aria-label="Search reports"><ArrowRight size={19} /></button></form>
      <div className="hero-ctas"><Link className="btn btn--primary" to="/report?type=lost">I lost something <ArrowRight size={16} /></Link><Link className="btn btn--outline" to="/report?type=found">I found something</Link></div>
      <p className="hero-note"><ShieldCheck size={15} /> Don’t post serial numbers or sensitive identifiers.</p>
    </div><div className="hero-art" aria-label="A collection of everyday study belongings"><img src="/assets/laptop-found.webp" alt="Study essentials including a laptop bag arranged on a desk" /><div className="hero-stamp"><span className="stamp-icon"><TicketCheck size={18} /></span><div><b>Every item has a story.</b><small>Help yours find its way back.</small></div></div><span className="hero-art-caption">A shared campus space, made a little easier.</span></div></section>
    <section className="category-section container"><div className="section-heading"><div><span className="eyebrow">Start with a category</span><h2>What are you looking for?</h2></div><Link className="text-link" to="/browse">Browse all items <ArrowRight size={16} /></Link></div><div className="category-list">{categories.map(([name, Icon]) => <Link className="category-link" key={name} to={`/browse?category=${encodeURIComponent(name)}`}><span><Icon size={20} /></span>{name}<ArrowRight size={14} /></Link>)}</div></section>
    <section className="section recent-section"><div className="container"><div className="section-heading"><div><span className="eyebrow">Recently reported</span><h2>A few things looking for their people</h2></div><Link className="text-link" to="/browse">See every report <ArrowRight size={16} /></Link></div>{recent.length ? <div className="item-grid">{recent.map((item) => <ItemCard key={item.id} item={item} />)}</div> : <p className="muted">New reports will appear here after review.</p>}</div></section>
    <section className="section steps-section"><div className="container"><PageIntro eyebrow="A simple path back" title="Three steps. One less thing to worry about." text="Keep the details in one place, then let the right people take it from there." /><div className="steps-grid">{[['01','Browse or report','Search current reports, or add a clear Lost or Found notice.'],['02','Compare carefully','Review possible matches and share only details that help verify ownership.'],['03','Confirm and recover','A claim can be reviewed before the item is returned or marked recovered.']].map(([number,title,text]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div><Link to="/how-it-works" className="text-link">See how the process works <ArrowRight size={16} /></Link></div></section>
    <section className="privacy-band container"><ShieldCheck size={22} /><div><b>Keep private details private.</b><p>Potential matches are suggestions, never proof. Share a unique identifying detail only with the person reviewing your claim.</p></div></section>
  </>;
}
