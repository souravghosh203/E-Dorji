import React, { useEffect, useState } from 'react';
import showcase from './data/artisan-showcase.json';
import directory from './data/tailor-directory.json';
import { GarmentArt } from './FeaturedWork.jsx';
import './tailor-profile.css';

const text = (value, language) => value?.[language] || value?.en || '';
const money = amount => `৳${Number(amount).toLocaleString('en-BD')}`;

export default function TailorProfile() {
  const slug = new URLSearchParams(window.location.search).get('tailor');
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const [featuredItems, setFeaturedItems] = useState([]);
  const [readyItems, setReadyItems] = useState([]);
  useEffect(() => {
    fetch('/api/featured-work').then(response => response.ok ? response.json() : { items: [] }).then(result => setFeaturedItems(result.items || [])).catch(() => {});
    fetch('/api/ready-made').then(response => response.ok ? response.json() : { items: [] }).then(result => setReadyItems(result.items || [])).catch(() => {});
  }, []);
  const base = showcase.find(item => item.slug === slug) || directory.find(item => item.slug === slug);
  const matching = featuredItems.filter(item => item.tailor.slug === slug);
  const matchingReady = readyItems.filter(item => item.tailor.slug === slug);
  const liveTailor = matchingReady[0]?.tailor;
  const source = base || matching[0]?.tailor || (liveTailor ? { slug, name: { en: liveTailor.name }, shop: { en: liveTailor.shop }, city: { en: liveTailor.city }, rating: 'New', experience: { en: 'Verified E-Dorji tailor' }, bio: { en: 'An independent local artisan on E-Dorji.' }, hours: { en: 'Contact the tailor for availability' } } : null);
  const liveCrafts = matchingReady.map(item => ({ id: item.id, name: { en: item.title }, description: { en: item.description }, price: item.price, days: { en: item.time }, kind: 'panjabi', color: '#6d2541', accent: '#d3a66c', imageUrl: item.imageUrl }));
  const crafts = [...(base?.crafts || []), ...matching.map(item => item.craft), ...liveCrafts].filter((craft, index, all) => all.findIndex(item => item.id === craft.id) === index);
  const tailor = source ? { ...source, crafts } : null;
  useEffect(() => {
    const sync = event => setLanguage(event.detail === 'bn' ? 'bn' : 'en');
    window.addEventListener('e-dorji-language', sync);
    document.title = tailor ? `${text(tailor.name, language)} · E-Dorji` : 'Tailor profile · E-Dorji';
    return () => window.removeEventListener('e-dorji-language', sync);
  }, [language, tailor]);

  if (!tailor) return <main className="artisan-missing"><span>✂</span><h1>{language === 'bn' ? 'এই দর্জির প্রোফাইল পাওয়া যায়নি' : 'We could not find this tailor profile.'}</h1><a href="e-dorji.html#featured-work">{language === 'bn' ? 'নির্বাচিত কাজ দেখুন' : 'Browse featured work'} →</a></main>;

  return <main className="artisan-profile" id="profile">
    <section className="artisan-intro">
      <a className="artisan-back" href="e-dorji.html#featured-work">← {language === 'bn' ? 'নির্বাচিত কাজ' : 'Featured work'}</a>
      <div className="artisan-intro-layout"><div className="artisan-monogram" aria-hidden="true">{text(tailor.name, language).slice(0, 1)}</div><div className="artisan-intro-copy"><p className="artisan-kicker">{language === 'bn' ? 'যাচাইকৃত কারিগর · বাংলাদেশ' : 'FEATURED ARTISAN · BANGLADESH'}</p><h1>{text(tailor.name, language)}</h1><p className="artisan-shop">{text(tailor.shop, language)} <span>·</span> {text(tailor.city, language)}</p><p className="artisan-bio">{text(tailor.bio, language)}</p><div className="artisan-meta"><span>★ {tailor.rating} {language === 'bn' ? 'নমুনা রেটিং' : 'sample rating'}</span><span>{text(tailor.experience, language)}</span></div></div>
        <aside className="artisan-hours"><span className="artisan-open-dot"/><small>{language === 'bn' ? 'কাজের সময়' : 'WORKING HOURS'}</small><b>{text(tailor.hours, language)}</b><small>{language === 'bn' ? 'অর্ডার সময়সীমা' : 'TYPICAL ORDER TIME'}</small><b>{language === 'bn' ? 'কাজভেদে ৫–২২ কর্মদিবস' : '5–22 working days, by craft'}</b></aside></div>
    </section>
    <section className="artisan-crafts" aria-labelledby="artisan-crafts-title"><div className="artisan-crafts-heading"><div><p className="artisan-kicker">{language === 'bn' ? 'নির্বাচিত কাজ' : 'MADE WITH CARE'}</p><h2 id="artisan-crafts-title">{language === 'bn' ? `${text(tailor.name, language)}-এর কাজ` : 'Crafts by ' + text(tailor.name, language)}</h2><p>{language === 'bn' ? 'প্রতিটি পোশাক আপনার মাপ ও পছন্দ অনুযায়ী তৈরি করা যায়।' : 'Each piece can be discussed and made to your measurements.'}</p></div><span className="artisan-sample-note">{language === 'bn' ? 'নমুনা কাজ ও আনুমানিক প্রারম্ভিক মূল্য' : 'SHOWCASE EXAMPLES · SAMPLE STARTING PRICES'}</span></div>
      <div className="artisan-craft-list">{tailor.crafts.map(craft => <article className="artisan-craft-card" key={craft.id}><div className="artisan-craft-art" style={{ '--craft-color': craft.color, '--craft-accent': craft.accent }}><GarmentArt craft={craft} language={language}/></div><div className="artisan-craft-info"><h3>{text(craft.name, language)}</h3><p>{text(craft.description, language)}</p><div className="artisan-craft-facts"><span><small>{language === 'bn' ? 'প্রারম্ভিক মূল্য' : 'STARTING AT'}</small><b>{money(craft.price)}</b></span><span><small>{language === 'bn' ? 'তৈরির সময়' : 'MAKING TIME'}</small><b>{text(craft.days, language)}</b></span></div><a href="login.html">{language === 'bn' ? 'এই কাজ নিয়ে কথা বলুন' : 'Discuss this piece'} <span aria-hidden="true">→</span></a></div></article>)}</div>
      <p className="artisan-note">{language === 'bn' ? 'ছবিগুলো পোশাকের রেফারেন্স ছবি; এগুলো নির্দিষ্ট দর্জির তৈরি নমুনা নয়। দাম ও সময় নমুনা হিসেবে দেখানো হয়েছে। চূড়ান্ত মূল্য, কাপড় ও সময় দর্জির লিখিত প্রস্তাবে নিশ্চিত হবে।' : 'Photos are garment references and are not confirmed examples of this tailor’s own work. Prices and timings are illustrative samples; confirm the final quote, fabric and schedule with the tailor before ordering.'}</p>
    </section>
  </main>;
}
