import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { FormField, PageIntro } from '../components/UI.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { actions, loading } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const destination = (user) => {
    const requested = location.state?.from;
    if (user.role === 'admin') return typeof requested === 'string' && requested.startsWith('/admin') ? requested : '/admin';
    return typeof requested === 'string' && !requested.startsWith('/admin') ? requested : '/dashboard';
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (isRegister && name.trim().length < 2) nextErrors.fullName = 'Enter your full name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (isRegister && !(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/.test(password))) nextErrors.password = 'Use 12–128 characters with uppercase, lowercase and a number.';
    if (!isRegister && !password) nextErrors.password = 'Enter your password.';
    if (isRegister && password !== confirmPassword) nextErrors.confirmPassword = 'The passwords do not match.';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }

    setErrors({});
    setBusy(true);
    try {
      const user = isRegister
        ? await actions.register(name.trim(), email.trim(), password, confirmPassword)
        : await actions.signIn(email.trim(), password);
      navigate(destination(user), { replace: true });
    } catch (cause) {
      setErrors({ ...(cause.fieldErrors || {}), form: cause.message || 'Could not complete the request. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return <section className="section container auth-layout">
    <div className="auth-story"><span className="eyebrow">A shared university service</span><h1>{isRegister ? 'Join the campus community.' : 'Pick up where you left off.'}</h1><p>Use a secure account to report, find and track belongings through the campus process.</p><ul><li><ShieldCheck size={17} /> Your role is checked by the backend</li><li><BookOpen size={17} /> Passwords are stored as one-way hashes</li><li><UserRound size={17} /> Private reports and claims stay scoped to your account</li></ul></div>
    <div className="auth-card">{isRegister ? <>
      <PageIntro eyebrow="Student registration" title="Create your account" text="New public registrations are student accounts. Staff and administrator access is provisioned through a controlled process." />
      <form onSubmit={submit} noValidate>
        <FormField id="auth-name" label="Full name" error={errors.fullName}><input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Your full name" /></FormField>
        <FormField id="auth-email" label="Email address" error={errors.email}><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="name@example.com" /></FormField>
        <FormField id="auth-password" label="Password" error={errors.password} hint="12–128 characters, including uppercase, lowercase and a number."><input id="auth-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} /></FormField>
        <FormField id="auth-confirm" label="Confirm password" error={errors.confirmPassword}><input id="auth-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} maxLength={128} /></FormField>
        {errors.form && <p className="field__error" role="alert">{errors.form}</p>}
        <button className="btn btn--primary btn--full" type="submit" disabled={busy || loading}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">Already registered? <Link to="/signin">Sign in</Link></p>
    </> : <>
      <PageIntro eyebrow="University account" title="Sign in to continue" text="Use the email address and password registered with this platform." />
      <form onSubmit={submit} noValidate>
        <FormField id="auth-email" label="Email address" error={errors.email}><input id="auth-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="name@example.com" /></FormField>
        <FormField id="auth-password" label="Password" error={errors.password}><input id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} /></FormField>
        {errors.form && <p className="field__error" role="alert">{errors.form}</p>}
        <button className="btn btn--primary btn--full" type="submit" disabled={busy || loading}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">New to the platform? <Link to="/register">Create a student account</Link></p>
    </>}</div>
  </section>;
}
