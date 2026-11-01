import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export function Layout({ children }) {
  const { currentUser, actions, error, refresh, refreshing } = useApp();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const navigate = useNavigate();
  const close = () => setOpen(false);
  const roleLabel = currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role === 'staff' ? 'Staff' : 'Student';

  const signOut = async () => {
    setSignOutError('');
    try {
      await actions.signOut();
      close();
      navigate('/');
    } catch (cause) {
      setSignOutError(cause.message || 'Could not sign out. Please retry.');
    }
  };

  return <>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" to="/" onClick={close}><img src="/assets/recovery-mark.svg" alt="" /><span>University <b>Lost &amp; Found</b></span></Link>
      <button className="mobile-menu" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav className={`main-nav ${open ? 'main-nav--open' : ''}`} aria-label="Main navigation">
        <NavLink to="/browse" onClick={close}>Browse items</NavLink><NavLink to="/how-it-works" onClick={close}>How it works</NavLink>
        {currentUser && <NavLink to={currentUser.role === 'admin' ? '/admin' : '/dashboard'} onClick={close}>{currentUser.role === 'admin' ? 'Admin' : 'My activity'}</NavLink>}
        <div className="nav-actions">{currentUser ? <><span className="nav-user">{currentUser.name.split(' ')[0]} <small>{roleLabel}</small></span><button className="btn btn--quiet btn--small" onClick={signOut}>Sign out</button></> : <Link className="btn btn--quiet btn--small" to="/signin" onClick={close}>Sign in</Link>}
          <Link className="btn btn--primary btn--small" to="/report" onClick={close}>Report an item <ArrowUpRight size={15} /></Link></div>
      </nav>
    </div></header>
    {error && <div className="api-status" role="status"><b>Connection notice.</b> {error} <button className="btn btn--quiet btn--small" type="button" disabled={refreshing} onClick={() => refresh().catch(() => {})}>{refreshing ? 'Checking…' : 'Retry'}</button></div>}
    {signOutError && <div className="api-status" role="alert">{signOutError}</div>}
    <main>{children}</main>
    <footer className="site-footer"><div className="footer-main"><Link className="brand brand--footer" to="/"><img src="/assets/recovery-mark.svg" alt="" /><span>University <b>Lost &amp; Found</b></span></Link><p>A proposed campus platform for getting belongings back to the people who miss them.</p><div className="footer-links"><Link to="/browse">Browse</Link><Link to="/how-it-works">How it works</Link><Link to="/signin">Sign in</Link></div></div><div className="footer-bottom"><span>Academic prototype · Server-backed account and report workflow</span><span>Not an official university service</span></div></footer>
  </>;
}
