import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState, PageIntro } from '../components/UI.jsx';

export default function AdminManagementPage() {
  const { data, actions } = useApp();
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (event) => {
    event.preventDefault();
    const value = category.trim();
    if (value.length < 2 || value.length > 80) { setError('Category name must be 2–80 characters.'); return; }
    setError(''); setNotice(''); setBusy(true);
    try {
      await actions.addCategory(value);
      setCategory(''); setNotice(`Added “${value}” to the database categories.`);
    } catch (cause) { setError(cause.message || 'Category could not be added.'); }
    finally { setBusy(false); }
  };

  const remove = async (value) => {
    if (!window.confirm(`Remove “${value}”? Categories used by reports cannot be removed.`)) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      await actions.removeCategory(value);
      setNotice(`Removed “${value}”.`);
    } catch (cause) { setError(cause.message || 'Category could not be removed.'); }
    finally { setBusy(false); }
  };

  return <section className="section container"><PageIntro eyebrow="Administrator · platform management" title="Users & categories" text="Manage stored report categories and view registered accounts. User records are read-only here; roles are not changed from public registration." />
    {notice && <p className="success-note" role="status">{notice}</p>}{error && <p className="field__error" role="alert">{error}</p>}
    <div className="management-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">Database categories</span><h2>Item categories</h2></div></div><form className="inline-add" onSubmit={add}><label className="sr-only" htmlFor="new-category">New category name</label><input id="new-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Sports equipment" maxLength={80} /><button className="btn btn--primary btn--small" type="submit" disabled={busy}><Plus size={15} /> Add</button></form><ul className="category-admin-list">{data.categoryRecords.map((entry) => <li key={entry.id}><span>{entry.name}</span><button className="icon-button" aria-label={`Remove ${entry.name}`} disabled={busy} onClick={() => remove(entry.name)}><Trash2 size={16} /></button></li>)}</ul>{!data.categoryRecords.length && <EmptyState title="No categories loaded" text="Check the server connection and try again." />}</div>
      <div className="panel"><div className="panel-heading"><div><span className="eyebrow">Registered accounts · {data.users.length}</span><h2>Users</h2></div></div>{data.users.length ? <div className="user-list">{data.users.map((user) => <article key={user.id}><span className="user-avatar">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><b>{user.name}</b><small>{user.email}</small></div><span className="role-label">{user.role === 'admin' ? 'Administrator' : user.role === 'staff' ? 'Staff' : 'Student'}</span></article>)}</div> : <EmptyState title="No user records" text="Registered accounts will appear here." />}</div></div>
  </section>;
}
