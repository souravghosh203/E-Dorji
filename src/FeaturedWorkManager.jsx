import React, { useEffect, useState } from 'react';
import showcase from './data/artisan-showcase.json';
import './featured-work-manager.css';

const request = async (path, options = {}) => {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
};

export default function FeaturedWorkManager() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = async () => {
    setLoading(true);
    try { setItems((await request('/api/admin/featured-work')).items || []); setError(''); }
    catch (issue) { setError(issue.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  async function add(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const photo = formData.get('photo');
    formData.delete('photo');
    const data = Object.fromEntries(formData);
    if (!photo || !photo.size) { setError('Choose a garment photo to publish.'); return; }
    if (photo.size > 3 * 1024 * 1024) { setError('Choose a JPG, PNG, or WebP photo smaller than 3 MB.'); return; }
    try { data.imageData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(photo); }); }
    catch { setError('The selected photo could not be read.'); return; }
    setBusy(true); setError('');
    try {
      const result = await request('/api/admin/featured-work', { method: 'POST', body: JSON.stringify(data) });
      setItems(current => [...current, result.item]);
      form.reset();
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Remove “${item.craft.name.en}” from customer featured work?`)) return;
    setError('');
    try {
      await request(`/api/admin/featured-work/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      setItems(current => current.filter(entry => entry.id !== item.id));
    } catch (issue) { setError(issue.message); }
  }

  return <section className="dash-panel full featured-admin-panel">
    <div className="dash-panel-head"><div><h2>Featured work branding</h2><p>Add pieces to the customer overview carousel or remove them whenever needed.</p></div><span className="featured-admin-count">{items.length} live</span></div>
    {error && <p className="featured-admin-error" role="alert">{error}</p>}
    <form className="featured-admin-form" onSubmit={add}>
      <h3>Add a featured piece</h3>
      <p>These details appear in the customer carousel and the tailor’s public profile. Prices and working times are shown as sample estimates.</p>
      <div className="featured-admin-fields">
        <label>Tailor name<input name="tailorName" required minLength="2" maxLength="100" placeholder="Tailor name"/></label>
        <label>Studio / shop<input name="shopName" required minLength="2" maxLength="100" placeholder="Studio name"/></label>
        <label>City<input name="city" required minLength="2" maxLength="100" placeholder="City or neighbourhood"/></label>
        <label>Experience<input name="experience" maxLength="120" placeholder="e.g. 8 years in occasion wear"/></label>
        <label className="featured-admin-wide">Tailor profile description<textarea name="biography" required minLength="12" maxLength="1200" rows="3" placeholder="Describe the tailor’s approach and specialties"/></label>
        <label>Working hours<input name="hours" required maxLength="120" placeholder="Sat–Thu · 10:00–19:00"/></label>
        <label>Garment style<select name="kind" defaultValue="panjabi"><option value="panjabi">Panjabi / shirt</option><option value="saree">Saree</option><option value="blouse">Blouse</option><option value="kurti">Kurti</option><option value="salwar">Salwar kameez</option><option value="sherwani">Sherwani</option></select></label>
        <label className="featured-admin-wide">Real garment photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/><small>JPG, PNG, or WebP · up to 3 MB. This photo appears in the customer carousel.</small></label>
        <label>Photo credit / source<input name="imageCredit" maxLength="120" placeholder="Photographer or tailor credit"/></label>
        <label>Garment / craft name<input name="craftName" required minLength="2" maxLength="120" placeholder="e.g. Hand-embroidered Panjabi"/></label>
        <label>Sample starting price (৳)<input name="price" type="number" required min="1" max="10000000" step="100" placeholder="4500"/></label>
        <label>Estimated working time<input name="days" required maxLength="80" placeholder="8–12 working days"/></label>
        <label>Fabric colour<input name="color" type="color" defaultValue="#236653"/></label>
        <label>Embroidery / accent colour<input name="accent" type="color" defaultValue="#e6c17e"/></label>
        <label className="featured-admin-wide">Garment description<textarea name="description" required minLength="12" maxLength="1200" rows="3" placeholder="Describe fabric, fit, finish and details"/></label>
      </div>
      <button className="dash-primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish featured piece'}</button>
    </form>
    <div className="featured-admin-list-head"><h3>Published pieces</h3><button className="dash-secondary" type="button" onClick={reload} disabled={loading}>Refresh</button></div>
    {loading ? <p className="featured-admin-empty">Loading featured work…</p> : items.length ? <div className="featured-admin-list">{items.map(item => <article key={item.id}><span className="featured-admin-swatch" style={{ '--swatch': item.craft.color, '--accent-swatch': item.craft.accent }} aria-hidden="true">{item.craft.imageUrl && <img src={item.craft.imageUrl} alt=""/>}</span><div><b>{item.craft.name.en}</b><small>{item.tailor.name.en} · {item.tailor.shop.en} · ৳{Number(item.craft.price).toLocaleString('en-BD')} · {item.craft.days.en}</small></div><button className="featured-admin-remove" type="button" onClick={() => remove(item)}>Remove</button></article>)}</div> : <p className="featured-admin-empty">No pieces are published. Add a featured piece above to show the customer carousel.</p>}
    <p className="featured-admin-footnote">Existing demo artisans: {showcase.map(tailor => tailor.name.en).join(' · ')}. Add a matching tailor name to group new work on their profile.</p>
  </section>;
}
