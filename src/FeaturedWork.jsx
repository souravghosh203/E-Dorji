import React, { useEffect, useState } from 'react';
import './featured-work.css';

const text = (value, language) => value?.[language] || value?.en || '';
const money = amount => `৳${Number(amount).toLocaleString('en-BD')}`;

export function GarmentArt({ craft, language }) {
  const id = craft.id.replace(/[^a-z0-9]/gi, '');
  const name = text(craft.name, language);
  if (craft.imageUrl) return <div className="featured-photo-wrap"><img className="featured-photo" src={craft.imageUrl} alt={name} loading="lazy"/><span className="featured-photo-credit">{craft.imageCredit || (language === 'bn' ? 'রেফারেন্স ছবি' : 'Reference photo')}</span></div>;
  return <svg className="featured-garment" viewBox="0 0 400 460" role="img" aria-label={name}>
    <defs>
      <linearGradient id={`cloth-${id}`} x1="0" y1="0" x2="1" y2=".35"><stop stopColor={craft.color} stopOpacity=".78"/><stop offset=".48" stopColor={craft.color}/><stop offset=".74" stopColor={craft.accent} stopOpacity=".32"/><stop offset="1" stopColor={craft.color} stopOpacity=".9"/></linearGradient>
      <pattern id={`stitch-${id}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M10 3c2 3 4 5 7 7-3 2-5 4-7 7-2-3-4-5-7-7 3-2 5-4 7-7Z" fill="none" stroke={craft.accent} strokeWidth="1" opacity=".8"/><circle cx="10" cy="10" r="1.5" fill={craft.accent}/></pattern>
      <filter id={`shadow-${id}`} x="-40%" y="-20%" width="180%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="#1e1513" floodOpacity=".18"/></filter>
    </defs>
    <ellipse cx="203" cy="422" rx="105" ry="12" fill="#261c19" opacity=".1"/>
    <path d="M199 74V32c0-15-20-16-23-2" fill="none" stroke="#78604c" strokeWidth="7" strokeLinecap="round"/>
    <path d="M75 106 197 65l128 41-24 15-104-33-100 33Z" fill="#d2b588" stroke="#987750" strokeWidth="4" strokeLinejoin="round"/>
    <g filter={`url(#shadow-${id})`}>
      {craft.kind === 'saree' ? <>
        <path d="M135 119h131l40 249q-28 23-55 0t-56 0q-28 23-56 0t-55 0Z" fill={`url(#cloth-${id})`} stroke={craft.color} strokeWidth="3"/>
        <path d="M135 119h131l40 249q-28 23-55 0t-56 0q-28 23-56 0t-55 0Z" fill={`url(#stitch-${id})`} opacity=".75"/>
        <path d="M136 141h130M149 157l38 213m-12-222 38 226m13-226 38 210" fill="none" stroke={craft.accent} strokeWidth="3" opacity=".45"/>
        <path d="M105 155h42l44 241q-28 13-45-4Z" fill={`url(#cloth-${id})`} stroke={craft.accent} strokeWidth="5"/><path d="m109 170 42 211m-36-204 40 205" stroke={`url(#stitch-${id})`} strokeWidth="8"/>
      </> : craft.kind === 'blouse' ? <>
        <path d="m157 124 30-16q15 18 30 0l30 16 30 36-21 25-20-17v141H168V168l-20 17-21-25Z" fill={`url(#cloth-${id})`} stroke={craft.color} strokeWidth="4"/>
        <path d="m187 108 24 28 24-28 8 10-18 30h-28l-18-30Z" fill={craft.accent} opacity=".9"/><path d="M168 169h68v113h-68z" fill={`url(#stitch-${id})`} opacity=".6"/><path d="M174 282q28 13 57 0m-69-118-16 15m103-15 16 15" fill="none" stroke={craft.accent} strokeWidth="5"/>
      </> : <>
        <path d="m153 115 32-17q17 20 34 0l31 17 37 42-22 27-25-17v194q-52 24-104 0V167l-25 17-22-27Z" fill={`url(#cloth-${id})`} stroke={craft.color} strokeWidth="4"/>
        <path d="m185 98 23 29 23-29 8 9-17 28h-28l-17-28Z" fill={craft.accent}/><path d="M207 136v199" stroke={craft.accent} strokeWidth="5" opacity=".9"/>
        {[158,184,210,236,262].map(y => <circle key={y} cx="207" cy={y} r="3.6" fill={craft.accent}/>)}
        <path d="M153 145q-16 98-9 207m124-207q16 98 9 207" fill="none" stroke="#fff" strokeWidth="4" opacity=".22"/>
        <path d="M151 161h116v157H151Z" fill={`url(#stitch-${id})`} opacity={craft.kind === 'kurti' || craft.kind === 'salwar' || craft.kind === 'sherwani' ? '.42' : '.2'}/>
        {craft.kind === 'salwar' && <><path d="M154 369 176 376 188 421h-47Zm104 0-22 7-12 45h47Z" fill={craft.color} opacity=".62"/><path d="M150 374h105" stroke={craft.accent} strokeWidth="5"/></>}
        {craft.kind === 'sherwani' && <path d="M158 136q50 22 99 0v182q-49 20-99 0Z" fill="none" stroke={craft.accent} strokeWidth="3" strokeDasharray="3 8"/>}
      </>}
    </g>
    <path d="M197 65 75 106q-9 4 0 9h245q9-5 0-9L197 65Z" fill="none" stroke="#987750" strokeWidth="5" strokeLinejoin="round"/>
  </svg>;
}

export default function FeaturedWork() {
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/featured-work').then(response => response.ok ? response.json() : { items: [] }).then(result => { if (alive) { setSlides(result.items || []); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    load();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  const current = slides[active];

  useEffect(() => {
    const sync = event => setLanguage(event.detail === 'bn' ? 'bn' : 'en');
    window.addEventListener('e-dorji-language', sync);
    return () => window.removeEventListener('e-dorji-language', sync);
  }, []);

  useEffect(() => { setActive(index => slides.length ? index % slides.length : 0); }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActive(index => (index + 1) % slides.length), 5600);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const move = direction => setActive(index => (index + direction + slides.length) % slides.length);
  if (loading) return <section className="featured-section featured-loading" aria-live="polite">{language === 'bn' ? 'নির্বাচিত কাজ লোড হচ্ছে…' : 'Loading featured work…'}</section>;
  if (!current) return null;
  const tailorHref = `tailor-profile.html?tailor=${encodeURIComponent(current.tailor.slug)}`;

  return <section className="featured-section" id="featured-work" aria-labelledby="featured-title" onKeyDown={event => { if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowLeft') move(-1); }}>
    <div className="featured-heading"><div><p className="featured-kicker">{language === 'bn' ? 'বাংলাদেশের দক্ষ কারিগর' : 'THE ARTISANS BEHIND THE WORK'}</p><h2 id="featured-title">{language === 'bn' ? 'দর্জিদের হাতে, আপনার পছন্দে' : 'Made by hand. Chosen by you.'}</h2><p>{language === 'bn' ? 'শীর্ষ দর্জিদের নির্বাচিত কাজ, আনুমানিক দাম ও তৈরির সময় দেখুন।' : 'Explore signature pieces from featured local tailors, with sample prices and working times.'}</p></div>
      <div className="featured-controls"><button type="button" onClick={() => move(-1)} aria-label={language === 'bn' ? 'আগের পোশাক' : 'Previous featured work'}><span aria-hidden="true">←</span></button><button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? (language === 'bn' ? 'স্বয়ংক্রিয় চলন চালু করুন' : 'Play automatic motion') : (language === 'bn' ? 'স্বয়ংক্রিয় চলন থামান' : 'Pause automatic motion')}>{paused ? '▶' : 'Ⅱ'}</button><button type="button" onClick={() => move(1)} aria-label={language === 'bn' ? 'পরের পোশাক' : 'Next featured work'}><span aria-hidden="true">→</span></button></div>
    </div>
    <article className="featured-card" key={current.craft.id}>
      <div className="featured-art" style={{ '--craft-color': current.craft.color, '--craft-accent': current.craft.accent }}><span className="featured-index">{String(active + 1).padStart(2, '0')} <i>/ {String(slides.length).padStart(2, '0')}</i></span><span className="featured-art-label">{language === 'bn' ? 'কারিগরের নির্বাচিত কাজ' : 'A TAILOR’S SIGNATURE PIECE'}</span><GarmentArt craft={current.craft} language={language}/></div>
      <div className="featured-details"><div className="featured-detail-top"><span className="featured-category">{text(current.craft.name, language)}</span><span className="featured-rating">★ {current.tailor.rating}</span></div>
        <h3>{text(current.craft.name, language)}</h3><p className="featured-description">{text(current.craft.description, language)}</p>
        <a className="featured-tailor-link" href={tailorHref}><span className="featured-avatar">{text(current.tailor.name, language).slice(0, 1)}</span><span><small>{language === 'bn' ? 'কারিগর' : 'CRAFTED BY'}</small><b>{text(current.tailor.name, language)} <span aria-hidden="true">↗</span></b><small>{text(current.tailor.shop, language)} · {text(current.tailor.city, language)}</small></span></a>
        <div className="featured-stats"><div><small>{language === 'bn' ? 'নমুনা প্রারম্ভিক মূল্য' : 'SAMPLE STARTING PRICE'}</small><strong>{money(current.craft.price)}</strong></div><div><small>{language === 'bn' ? 'কাজের সময়' : 'WORKING TIME'}</small><strong>{text(current.craft.days, language)}</strong></div></div>
        <div className="featured-detail-bottom"><span>{language === 'bn' ? 'রেফারেন্স ছবি · নমুনা মূল্য' : 'Reference photo · sample price'}</span><a href={tailorHref}>{language === 'bn' ? 'সব কাজ ও তথ্য দেখুন' : 'View all work & profile'} <span aria-hidden="true">→</span></a></div>
      </div>
    </article>
    <div className="featured-dots" role="tablist" aria-label={language === 'bn' ? 'নির্বাচিত কাজ' : 'Featured work'}>{slides.map((slide, index) => <button key={slide.craft.id} type="button" role="tab" aria-label={`${text(slide.craft.name, language)} · ${text(slide.tailor.name, language)}`} aria-selected={active === index} className={active === index ? 'active' : ''} onClick={() => setActive(index)}/>)}</div>
  </section>;
}
