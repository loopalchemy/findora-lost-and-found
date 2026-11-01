import { Link } from 'react-router-dom';
import { ArrowRight, PackageOpen } from 'lucide-react';

export function StatusBadge({ status }) {
  const tone = status === 'Approved' ? 'success' : status === 'Recovered' ? 'teal' : status === 'Rejected' ? 'danger' : status === 'Reviewed' ? 'violet' : 'pending';
  return <span className={`badge badge--${tone}`}>{status}</span>;
}

export function ItemCard({ item }) {
  return <Link className="item-card" to={`/items/${item.id}`}>
    <div className="item-card__image">{item.image ? <img src={item.image} alt={item.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <span className="photo-fallback" aria-label="No item photo"><PackageOpen size={32} /></span>}
      <span className={`type-pill type-pill--${item.type}`}>{item.type === 'lost' ? 'Lost item' : 'Found item'}</span>
    </div>
    <div className="item-card__body"><div className="item-card__meta">{item.category} <span>·</span> {new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
      <h3>{item.title}</h3><p className="item-card__location">{item.location}</p><span className="card-link">View details <ArrowRight size={15} /></span>
    </div>
  </Link>;
}

export function FormField({ label, error, hint, id, children }) {
  return <div className={`field ${error ? 'field--error' : ''}`}><label htmlFor={id}>{label}</label>{children}{hint && <small className="field__hint">{hint}</small>}{error && <small className="field__error" role="alert">{error}</small>}</div>;
}

export function EmptyState({ title = 'Nothing here yet', text, action, icon: Icon = PackageOpen }) {
  return <div className="empty-state"><span className="empty-state__icon"><Icon size={23} /></span><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}

export function PageIntro({ eyebrow, title, text, action }) {
  return <div className="page-intro"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{text && <p>{text}</p>}</div>{action}</div>;
}
