import React, { useEffect, useMemo, useState } from 'react';
import references from './data/ready-made-reference.json';
import './ready-made.css';

const taka = amount => `৳${Number(amount || 0).toLocaleString('en-BD')}`;
const categories = ['All', 'Borka', 'Saree', 'Lungi', 'Panjabi', 'Girls’ dress', 'Other'];

export function ReadyMadeCard({ item, onHire, language = 'en' }) {
  const sample = item.reference === true;
  const bn = language === 'bn';
  const tailorName = item.tailor?.name || item.tailorName || item.tailor;
  const tailorSlug = item.tailor?.slug || item.tailorSlug || item.slug;
  const categoryBn = { Borka: 'বোরকা', Saree: 'শাড়ি', Lungi: 'লুঙ্গি', Panjabi: 'পাঞ্জাবি', 'Girls’ dress': 'মেয়েদের পোশাক', Other: 'অন্যান্য' }[item.category] || item.category;
  return <article className="ready-card">
    <a className="ready-photo" href={sample ? item.source && item.source !== '#' ? item.source : `tailor-profile.html?tailor=${encodeURIComponent(tailorSlug)}` : `tailor-profile.html?tailor=${encodeURIComponent(tailorSlug || '')}`} aria-label={`View ${item.title}`}>
      <img src={item.imageUrl || item.image} alt={item.title} loading="lazy" onError={event => { event.currentTarget.dataset.failed = 'true'; }}/>
      <span className="ready-category">{bn ? categoryBn : item.category}</span>
    </a>
    <div className="ready-copy">
      <div className="ready-title-row"><h3>{item.title}</h3><strong>{taka(item.price)}</strong></div>
      <p>{item.description}</p>
      <div className="ready-meta"><span>◷ {item.time || item.days || (bn ? 'দর্জির সঙ্গে সময় ঠিক করুন' : 'Made to order')}</span>{sample && <span className="ready-reference">{bn ? 'ধাঁচের নমুনা' : 'Style reference'}</span>}</div>
      <div className="ready-maker"><span className="ready-avatar">{String(tailorName || 'T').slice(0, 1)}</span><a href={`tailor-profile.html?tailor=${encodeURIComponent(tailorSlug || '')}`}>{tailorName || (bn ? 'ই-দর্জি কারিগর' : 'E-Dorji tailor')} <small>{bn ? 'প্রোফাইল দেখুন' : 'View profile'} ↗</small></a><button type="button" onClick={() => onHire(item, tailorName)}>{bn ? 'দর্জি নিয়োগ' : 'Hire tailor'}</button></div>
      {sample && item.source && item.source !== '#' && <a className="ready-source" href={item.source} target="_blank" rel="noreferrer">{bn ? 'ছবির সূত্র' : 'Photo reference'}: {item.sourceName} ↗</a>}
    </div>
  </article>;
}

export default function ReadyMade({ onHire }) {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/ready-made').then(response => response.ok ? response.json() : { items: [] }).then(result => { if (alive) { setItems(result.items || []); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    load(); const timer = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => { const sync = event => setLanguage(event.detail === 'bn' ? 'bn' : 'en'); window.addEventListener('e-dorji-language', sync); return () => window.removeEventListener('e-dorji-language', sync); }, []);
  const all = useMemo(() => [...items.map(item => ({ ...item, reference: false })), ...references.map(item => ({ ...item, reference: true }))], [items]);
  const filtered = category === 'All' ? all : all.filter(item => item.category === category);
  const bn = language === 'bn';
  return <section className="ready-market dash-panel full" aria-labelledby="ready-market-title">
    <header className="ready-heading"><div><span className="ready-kicker">{bn ? 'দর্জির তৈরি পোশাক' : 'READY TO WEAR · MADE IN BANGLADESH'}</span><h2 id="ready-market-title">{bn ? 'রেডিমেড পোশাক' : 'Ready-made dress'}</h2><p>{bn ? 'দর্জিদের পোশাক দেখুন, দাম জানুন এবং সরাসরি দর্জিকে কাজের অনুরোধ পাঠান।' : 'Browse pieces from local artisans, compare sample prices, and hire a tailor for the style you love.'}</p></div><span className="ready-total">{all.length} {bn ? 'টি পোশাক' : 'pieces'}</span></header>
    <div className="ready-filter" role="group" aria-label={bn ? 'পোশাকের ধরন বাছুন' : 'Filter clothing category'}>{categories.map((item, index) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{bn ? ['সব', 'বোরকা', 'শাড়ি', 'লুঙ্গি', 'পাঞ্জাবি', 'মেয়েদের পোশাক', 'অন্যান্য'][index] : item}</button>)}</div>
    <p className="ready-notice">{bn ? 'অনলাইন ছবি পোশাকের রেফারেন্স—এগুলো ছবির আসল বিক্রেতা বা কারিগরের কাজ নয়। লাইভ লিস্টিং দর্জিরা তাঁদের প্রোফাইল থেকে যোগ ও মুছতে পারেন।' : 'Online photos are style references; the suggested E-Dorji tailor is not the original seller or maker. Live listings are added and removed by tailors from their profile dashboard.'}</p>
    {loading && <p className="ready-state">{bn ? 'পোশাক লোড হচ্ছে…' : 'Loading ready-to-wear…'}</p>}
    {!loading && <div className="ready-grid">{filtered.map(item => <ReadyMadeCard key={item.id} item={item} onHire={onHire} language={language}/>)}</div>}
  </section>;
}

export function TailorReadyMadeManager({ products, onRefresh, onNotice }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function addProduct(event) {
    event.preventDefault(); setError(''); setSaving(true);
    const form = event.currentTarget, data = new FormData(form), file = data.get('photo');
    if (!(file instanceof File) || !file.size) { setSaving(false); return setError('Choose a product photo.'); }
    if (file.size > 3 * 1024 * 1024) { setSaving(false); return setError('Use an image smaller than 3 MB.'); }
    const imageData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    try {
      const response = await fetch('/api/tailor/ready-made', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: data.get('title'), category: data.get('category'), description: data.get('description'), price: data.get('price'), time: data.get('time'), imageData }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not add this listing.');
      form.reset(); await onRefresh(); onNotice('Your ready-made item is now in the customer catalog.');
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  }
  async function removeProduct(id) {
    if (!window.confirm('Remove this item from the ready-made catalog?')) return;
    try { const response = await fetch(`/api/tailor/ready-made/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not remove this listing.'); await onRefresh(); onNotice('The item was removed from the customer catalog.'); }
    catch (reason) { setError(reason.message); }
  }
  return <section className="dash-panel full tailor-ready-manager"><div className="dash-panel-head"><div><h2>Ready-made catalog</h2><p>Add pieces customers can browse. Published items appear in the customer grid and disappear when you remove them. Your tailor profile must be public for customers to see your listings.</p></div><span className="ready-manager-count">{products.length} listed</span></div>
    {error && <p className="featured-admin-error" role="alert">{error}</p>}
    <form className="ready-product-form" onSubmit={addProduct}><h3>Add a ready-made item</h3><div className="ready-form-grid"><label>Item name<input name="title" required maxLength="120" placeholder="e.g. Teal Jamdani saree"/></label><label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose a category</option>{categories.slice(1).map(category => <option key={category}>{category}</option>)}</select></label><label>Price in BDT<input name="price" type="number" min="1" max="10000000" required placeholder="8500"/></label><label>Ready or making time<input name="time" required maxLength="80" placeholder="Ready now · delivery in 2–3 days"/></label><label className="ready-form-wide">Description<textarea name="description" rows="3" required minLength="12" maxLength="1000" placeholder="Fabric, design details, sizes, and care"/></label><label className="ready-form-wide">Product photo (JPG, PNG or WebP, max 3 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/></label></div><button className="dash-primary" disabled={saving}>{saving ? 'Adding item…' : 'Add to customer catalog →'}</button></form>
    <div className="ready-manager-list"><h3>Your listed items</h3>{products.length ? products.map(item => <article key={item.id}><img src={item.imageUrl} alt=""/><div><b>{item.title}</b><small>{item.category} · {taka(item.price)} · {item.time}</small><p>{item.description}</p></div><button type="button" className="featured-admin-remove" onClick={() => removeProduct(item.id)}>Remove</button></article>) : <p className="featured-admin-empty">You have not listed any ready-made pieces yet.</p>}</div>
  </section>;
}
