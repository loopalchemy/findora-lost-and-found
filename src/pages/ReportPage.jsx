import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { FormField, PageIntro } from '../components/UI.jsx';
import { validateReport } from '../services/validation.js';

const today = new Date().toISOString().slice(0, 10);
export default function ReportPage() {
  const { data, actions } = useApp();
  const [params] = useSearchParams();
  const preset = params.get('type');
  const [values, setValues] = useState({ title: '', type: ['lost', 'found'].includes(preset) ? preset : 'lost', category: '', description: '', location: '', date: today, colour: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const change = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const chooseImage = (selected) => {
    if (!selected) { setFile(null); return; }
    const nextErrors = validateReport(values, selected);
    if (nextErrors.image) { setErrors((current) => ({ ...current, image: nextErrors.image })); return; }
    setErrors((current) => ({ ...current, image: '' }));
    setFile(selected);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateReport(values, file);
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const report = await actions.addReport({ ...values, file });
      setSaved(report);
    } catch (cause) {
      setErrors((current) => ({ ...current, ...(cause.fieldErrors || {}) }));
      setSubmitError(cause.message || 'The report could not be saved. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) return <section className="section container success-page"><span className="success-icon"><CheckCircle2 size={34} /></span><span className="eyebrow">Report received</span><h1>Your {saved.type} report is in the review queue.</h1><p>It has been saved to the university lost-and-found database as <b>Pending review</b>. You can track it from My Reports.</p><div className="hero-ctas"><Link className="btn btn--primary" to={`/items/${saved.id}`}>View your report</Link><Link className="btn btn--outline" to="/my-reports">Open My Reports</Link></div></section>;

  return <section className="section container form-page"><PageIntro eyebrow="Add to the campus board" title="Report an item" text="Share enough detail to help someone recognize it. New reports remain private until an administrator reviews them." />
    <form className="form-card" onSubmit={submit} noValidate><div className="form-section-label"><span>01</span><div><b>What happened?</b><small>Choose the report type first.</small></div></div>
      <div className="type-choice" role="radiogroup" aria-label="Report type">{[['lost', 'I lost an item'], ['found', 'I found an item']].map(([type, label]) => <button key={type} type="button" role="radio" aria-checked={values.type === type} className={`type-choice__option ${values.type === type ? 'is-selected' : ''}`} onClick={() => change('type', type)}><span className={`type-choice__dot type-pill--${type}`} />{label}</button>)}</div>
      <p className="form-helper">{values.type === 'lost' ? 'Include a few identifying details, but keep unique proof private for verification.' : 'Describe the item without exposing details that only its owner should know.'}</p>
      <div className="form-section-label"><span>02</span><div><b>Item details</b><small>Specific, useful and respectful of privacy.</small></div></div>
      <div className="form-grid">
        <FormField id="title" label="Item name" error={errors.title}><input id="title" maxLength={80} value={values.title} onChange={(event) => change('title', event.target.value)} placeholder="e.g. Navy canvas backpack" /></FormField>
        <FormField id="category" label="Category" error={errors.category}><select id="category" value={values.category} onChange={(event) => change('category', event.target.value)}><option value="">Choose a category</option>{data.categories.map((category) => <option key={category}>{category}</option>)}</select></FormField>
        <FormField id="description" label="Description" error={errors.description} hint="Avoid student numbers, serial numbers or other sensitive identifiers."><textarea id="description" rows="4" maxLength={500} value={values.description} onChange={(event) => change('description', event.target.value)} placeholder="What would help someone recognize this item?" /></FormField>
        <FormField id="location" label={values.type === 'lost' ? 'Where did you last see it?' : 'Where did you find it?'} error={errors.location}><input id="location" maxLength={120} value={values.location} onChange={(event) => change('location', event.target.value)} placeholder="Building, area or nearby landmark" /></FormField>
        <FormField id="date" label={values.type === 'lost' ? 'Date last seen' : 'Date found'} error={errors.date}><input id="date" type="date" max={today} value={values.date} onChange={(event) => change('date', event.target.value)} /></FormField>
        <FormField id="colour" label="Colour (optional)" hint="A broad colour description can help compare reports."><input id="colour" maxLength={80} value={values.colour} onChange={(event) => change('colour', event.target.value)} placeholder="e.g. navy blue" /></FormField>
        <FormField id="image" label="Photo (optional)" error={errors.image} hint="JPG, PNG or WebP · maximum 350 KB. Uploaded to the local backend folder."><label className="upload-control" htmlFor="image"><Upload size={18} />{file ? file.name : 'Choose an item photo'}<input id="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} /></label>{preview && <img className="upload-preview" src={preview} alt="Preview of selected item photo" />}</FormField>
      </div>
      {submitError && <p className="field__error" role="alert">{submitError}</p>}
      <div className="form-actions"><p>Submitting saves your report to the database for administrator review.</p><button className="btn btn--primary" type="submit" disabled={submitting || !data.categories.length}>{submitting ? 'Submitting…' : 'Review and submit'}</button></div>
      {!data.categories.length && <p className="muted">Categories could not be loaded. Check the server connection and retry.</p>}
    </form></section>;
}
