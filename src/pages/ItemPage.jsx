import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, MapPin, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState, FormField, ItemCard, PageIntro, StatusBadge } from '../components/UI.jsx';
import { findPotentialMatches } from '../utils/matching.js';
import { validateClaim } from '../services/validation.js';

export default function ItemPage() {
  const { id } = useParams();
  const { data, currentUser, actions, loading: appLoading } = useApp();
  const [detail, setDetail] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const listItem = data.reports.find((report) => String(report.id) === String(id));

  useEffect(() => {
    let active = true;
    setFetching(true); setLoadError(''); setDetail(null); setSent(false); setError('');
    actions.getReport(id).then((report) => {
      if (active) setDetail(report);
    }).catch((cause) => {
      if (active) setLoadError(cause.message || 'This report is not available.');
    }).finally(() => { if (active) setFetching(false); });
    return () => { active = false; };
  }, [id, actions.getReport]);

  const item = detail || listItem;
  if (fetching || appLoading) return <section className="section container" aria-live="polite"><p className="muted">Loading item details…</p></section>;
  if (!item || (['Pending review', 'Rejected'].includes(item.status) && !item.isOwner && currentUser?.role !== 'admin')) {
    return <section className="section container"><EmptyState title="Report not available" text={loadError || 'It may be awaiting review or no longer be available.'} action={<Link to="/browse" className="btn btn--primary">Browse reports</Link>} /></section>;
  }

  const duplicate = Boolean(currentUser && data.claims.some((claim) => claim.reportId === item.id && claim.userId === currentUser.id));
  const eligibleRole = currentUser?.role === 'student' || currentUser?.role === 'staff';
  const canClaim = item.type === 'found' && item.status === 'Approved' && eligibleRole && !item.isOwner && !duplicate;
  const canRecover = currentUser?.role === 'admin' && item.status === 'Approved';
  const matches = findPotentialMatches(item, data.reports, data.reviewedMatches);

  const submitClaim = async (event) => {
    event.preventDefault();
    const validationMessage = validateClaim(explanation);
    if (validationMessage) { setError(validationMessage); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await actions.addClaim(item.id, explanation);
      setSent(true);
      setNotice('Claim submitted for review. It has not changed the report status.');
    } catch (cause) { setError(cause.message || 'The claim could not be submitted.'); }
    finally { setBusy(false); }
  };

  const recover = async () => {
    if (!window.confirm('Mark this approved report as recovered? This changes only the report status.')) return;
    setBusy(true); setNotice(''); setError('');
    try {
      await actions.updateReportStatus(item.id, 'Recovered');
      setDetail(await actions.getReport(item.id));
      setNotice('This report is now marked recovered.');
    } catch (cause) { setError(cause.message || 'The report could not be updated.'); }
    finally { setBusy(false); }
  };

  return <section className="section container"><Link to="/browse" className="back-link"><ArrowLeft size={16} /> Back to browse</Link><div className="detail-grid"><div className="detail-photo">{item.image ? <img src={item.image} alt={item.title} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <span className="photo-fallback"><ShieldCheck size={52} /></span>}</div>
    <div className="detail-copy"><div className="detail-kicker"><span className={`type-pill type-pill--${item.type}`}>{item.type === 'lost' ? 'Lost item' : 'Found item'}</span><StatusBadge status={item.status} /></div><h1>{item.title}</h1><p className="detail-category">{item.category}</p><p className="detail-description">{item.description}</p><div className="detail-facts"><span><MapPin size={17} />{item.location}</span><span><Check size={17} />{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>{item.colour && <span>{item.colour}</span>}</div>
      {notice && <p className="success-note" role="status">{notice}</p>}{error && <p className="field__error" role="alert">{error}</p>}
      {canRecover && <button className="btn btn--outline" onClick={recover} disabled={busy}>Mark as recovered</button>}
      {item.type === 'found' && item.status === 'Approved' && !currentUser && <div className="claim-cta"><p>Think this could be yours? A reviewer will ask for details that aren’t shown publicly.</p><Link className="btn btn--primary" to="/signin" state={{ from: `/items/${item.id}` }}>Sign in to claim</Link></div>}
      {canClaim && !sent && <form className="claim-box" onSubmit={submitClaim}><h2>Claim this item</h2><p>Share a detail that can help verify ownership. Keep sensitive numbers private.</p><FormField id="claim-reason" label="Why do you believe it belongs to you?" error={error}><textarea id="claim-reason" rows="4" maxLength={500} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Describe a distinguishing detail (12–500 characters)" /></FormField><button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit claim'}</button></form>}
      {sent && <div className="success-note" role="status">Claim submitted for review. Track its status in <Link to="/my-claims">My claims</Link>.</div>}
      {duplicate && !sent && item.status === 'Approved' && <p className="muted">You have already submitted a claim for this report. Track its status in <Link to="/my-claims">My claims</Link>.</p>}
      {item.status === 'Pending review' && <p className="notice-box">This report is visible only to its reporter and administrators while pending review.</p>}
    </div></div>
    {matches.length > 0 && <div className="match-section"><PageIntro eyebrow="A helpful clue, not a verdict" title="Potential matches" text="Rule-based suggestions compare opposite report types, category, location wording and dates within 14 days. They do not prove ownership." /><div className="match-list">{matches.map((match) => <article className="match-card" key={match.report.id}><div className="match-card__item"><ItemCard item={match.report} /></div><div className="match-reasons"><StatusBadge status={match.status} /><p>{match.reasons.join(' · ')}</p>{match.status === 'Suggested' && currentUser && <button className="text-button" onClick={() => actions.markMatchReviewed(item.id, match.report.id)}>Mark suggestion reviewed</button>}</div></article>)}</div></div>}
  </section>;
}
