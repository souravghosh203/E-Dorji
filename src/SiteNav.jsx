import React, { useEffect, useRef, useState } from 'react';
import navigation from './data/navigation.json';
import tailors from './data/tailors.json';
import logo from '../assets/e-dorji-logo.svg';
import icon from '../assets/e-dorji-icon.svg';

const searchIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/></svg>;

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(window.scrollY > 8);
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem('e-dorji-language') === 'bn' ? 'bn' : 'en'; }
    catch { return 'en'; }
  });
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('e-dorji-theme') === 'dark' || document.documentElement.dataset.theme === 'dark'; }
    catch { return document.documentElement.dataset.theme === 'dark'; }
  });
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const labels = navigation[language];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = tailors.filter(tailor => {
    const searchable = [tailor.name, tailor.nameBn, tailor.work.en, tailor.work.bn, tailor.city.en, tailor.city.bn].join(' ').toLocaleLowerCase();
    return !normalizedQuery || searchable.includes(normalizedQuery);
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => { window.applySiteLanguage?.(language); }, []);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const sync = event => setLanguage(event.detail || document.documentElement.lang || 'en');
    const close = event => { if (!searchRef.current?.contains(event.target)) setSearchOpen(false); };
    window.addEventListener('e-dorji-language', sync);
    document.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('e-dorji-language', sync);
      document.removeEventListener('pointerdown', close);
    };
  }, []);

  function toggleLanguage() {
    const next = language === 'en' ? 'bn' : 'en';
    setLanguage(next);
    window.applySiteLanguage?.(next);
  }

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
    try { localStorage.setItem('e-dorji-theme', nextDark ? 'dark' : 'light'); } catch {}
  }

  return (
    <header className={`site-nav${scrolled ? ' is-scrolled' : ''}`}>
      <a className="site-brand" href="e-dorji.html#top" aria-label="E-দর্জি home">
        <picture>
          <source media="(max-width: 760px)" srcSet={icon} />
          <img src={logo} alt="E-দর্জি" />
        </picture>
      </a>
      <div className="site-search-wrap" ref={searchRef}>
        <form className="site-search" role="search" onSubmit={event => { event.preventDefault(); setSearchOpen(true); }}>
          <input name="query" type="search" placeholder={labels.search} aria-label={labels.searchLabel} value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} />
          <button type="submit" aria-label={labels.searchLabel} aria-expanded={searchOpen}>{searchIcon}</button>
        </form>
        {searchOpen && <div className="search-results" role="listbox" aria-label={labels.searchLabel}>
          {matches.length ? matches.map(tailor => <button className="search-result" key={tailor.name} type="button" role="option" aria-selected="false" onClick={() => setQuery(language === 'bn' ? tailor.nameBn : tailor.name)}>
            <span className="result-name">{language === 'bn' ? tailor.nameBn : tailor.name}</span>
            <span className="result-meta">{tailor.work[language]} <span>·</span> {tailor.city[language]}</span>
            <span className="result-rating">★ {tailor.rating}</span>
          </button>) : <p className="search-empty">{language === 'bn' ? 'কোনো দর্জি খুঁজে পাওয়া যায়নি' : 'No tailors found'}</p>}
        </div>}
      </div>
      <button className="site-option site-language" type="button" onClick={toggleLanguage} aria-label={labels.translator}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h9M8.5 3v2M6 5c1 4 3 6 6 8M12 5c-1 4-3 7-7 9M13 21l4-10 4 10M14.5 17.5h5"/></svg>
      </button>
      <button className="site-option site-theme" type="button" onClick={toggleTheme} aria-label={labels.dark}>
        {dark ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>}
      </button>
      <a className="site-about" href="about.html">{labels.about}</a>
      <a className="site-start" href="login.html" aria-label={labels.startLabel}>{labels.start}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a>
    </header>
  );
}
