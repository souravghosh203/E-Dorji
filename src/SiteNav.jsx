import React, { useEffect, useState } from 'react';
import navigation from './data/navigation.json';
import logo from '../assets/e-dorji-logo.svg';
import icon from '../assets/e-dorji-icon.svg';

const searchIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/></svg>;

export default function SiteNav({ page }) {
  const [scrolled, setScrolled] = useState(window.scrollY > 8);
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('e-dorji-theme') === 'dark' || document.documentElement.dataset.theme === 'dark'; }
    catch { return document.documentElement.dataset.theme === 'dark'; }
  });
  const labels = navigation[language];

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  function toggleLanguage() {
    const next = language === 'en' ? 'bn' : 'en';
    setLanguage(next);
    document.documentElement.lang = next;
    window.setL?.(next);
  }

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
    try { localStorage.setItem('e-dorji-theme', nextDark ? 'dark' : 'light'); } catch {}
  }

  function search(event) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('query')?.toString().trim() || '';
    if (page === 'home' && window.openTailorSearch) window.openTailorSearch(query);
    else window.location.href = `e-dorji.html?search=${encodeURIComponent(query)}`;
  }

  return (
    <header className={`site-nav${scrolled ? ' is-scrolled' : ''}`}>
      <a className="site-brand" href="e-dorji.html#top" aria-label="E-দর্জি home">
        <picture>
          <source media="(max-width: 760px)" srcSet={icon} />
          <img src={logo} alt="E-দর্জি" />
        </picture>
      </a>
      <form className="site-search" role="search" onSubmit={search}>
        <input name="query" type="search" placeholder={labels.search} aria-label={labels.searchLabel} />
        <button type="submit" aria-label={labels.searchLabel}>{searchIcon}</button>
      </form>
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
