import React, { useEffect, useRef, useState } from 'react';
import navigation from './data/navigation.json';
import tailors from './data/tailors.json';
import directory from './data/tailor-directory.json';
import logo from '../assets/e-dorji-logo.svg';
import icon from '../assets/e-dorji-icon.svg';

const searchIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/></svg>;

export default function SiteNav({ page = 'home' }) {
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
  const [registeredTailors, setRegisteredTailors] = useState([]);
  const searchRef = useRef(null);
  const accountRef = useRef(null);
  const notificationRef = useRef(null);
  const [user, setUser] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dashboardPages = ['customer-dashboard', 'admin-dashboard', 'tailor-dashboard'];
  const isDashboard = dashboardPages.includes(page);
  const labels = navigation[language];
  const showTailorLink = page === 'customer-dashboard';
  const homeHref = page === 'customer-dashboard' ? 'customer-dashboard.html' : page === 'admin-dashboard' ? 'admin-dashboard.html' : page === 'tailor-dashboard' ? 'tailor-dashboard.html' : 'e-dorji.html#top';
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const directoryResults = directory.map(tailor => ({ slug: tailor.slug, name: tailor.name.en, nameBn: tailor.name.bn, work: { en: tailor.crafts.map(craft => craft.name.en).join(' · '), bn: tailor.crafts.map(craft => craft.name.bn).join(' · ') }, city: { en: tailor.city.en, bn: tailor.city.bn }, rating: tailor.rating }));
  const publicResults = registeredTailors.map(tailor => ({ ...tailor, nameBn: tailor.name, work: { en: [tailor.shopName, ...tailor.services].filter(Boolean).join(' · '), bn: [tailor.shopName, ...tailor.services].filter(Boolean).join(' · ') }, city: { en: tailor.city, bn: tailor.city }, rating: 'New' }));
  const dynamicTailors = [...new Map([...directoryResults, ...publicResults].map(item => [item.name.toLowerCase(), item])).values()];
  const searchableNames = new Set(dynamicTailors.map(item => item.name.toLowerCase()));
  const searchableTailors = [...tailors.filter(sample => !searchableNames.has(sample.name.toLowerCase())), ...dynamicTailors];
  const slugFor = tailor => tailor.slug || tailor.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const matches = searchableTailors.filter(tailor => {
    const searchable = [tailor.name, tailor.nameBn, tailor.work.en, tailor.work.bn, tailor.city.en, tailor.city.bn].join(' ').toLocaleLowerCase();
    return !normalizedQuery || searchable.includes(normalizedQuery);
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    fetch('/api/public-tailors').then(response => response.ok ? response.json() : { tailors: [] }).then(result => setRegisteredTailors(result.tailors || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isDashboard) return;
    fetch('/api/session', { credentials: 'same-origin' }).then(response => response.json()).then(result => setUser(result.user || null)).catch(() => {});
  }, [isDashboard]);

  useEffect(() => {
    if (!isDashboard || !user?.id) return;
    let active = true;
    const loadNotifications = () => fetch('/api/notifications', { credentials: 'same-origin' }).then(response => response.ok ? response.json() : { notifications: [] }).then(result => {
      if (!active) return;
      const items = result.notifications || [];
      setNotifications(items);
      window.dispatchEvent(new CustomEvent('e-dorji-notifications-updated', { detail: items }));
    }).catch(() => {});
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isDashboard, user?.id]);

  useEffect(() => { window.applySiteLanguage?.(language); }, []);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const sync = event => setLanguage(event.detail || document.documentElement.lang || 'en');
    const close = event => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const escape = event => { if (event.key === 'Escape') { setSearchOpen(false); setAccountOpen(false); setNotificationsOpen(false); } };
    const accountUpdated = event => setUser(event.detail || null);
    const notificationsUpdated = event => setNotifications(event.detail || []);
    window.addEventListener('e-dorji-language', sync);
    window.addEventListener('e-dorji-account-updated', accountUpdated);
    window.addEventListener('e-dorji-notifications-updated', notificationsUpdated);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('e-dorji-language', sync);
      window.removeEventListener('e-dorji-account-updated', accountUpdated);
      window.removeEventListener('e-dorji-notifications-updated', notificationsUpdated);
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  async function leaveAccount() {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); }
    finally { window.location.href = 'login.html'; }
  }

  async function markAllNotificationsRead() {
    const response = await fetch('/api/notifications/read', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (!response.ok) return;
    const readAt = new Date().toISOString();
    const updated = notifications.map(item => ({ ...item, readAt: item.readAt || readAt }));
    setNotifications(updated);
    window.dispatchEvent(new CustomEvent('e-dorji-notifications-updated', { detail: updated }));
  }

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
    <header className={`site-nav${scrolled ? ' is-scrolled' : ''}${page === 'home' ? ' has-start' : ''}${showTailorLink ? ' has-tailor' : ''}${user && isDashboard ? ' has-account' : ''}`}>
      <a className="site-brand" href={homeHref} aria-label="E-দর্জি home">
        <picture>
          <source media="(max-width: 760px)" srcSet={icon} />
          <img src={logo} alt="E-দর্জি" />
        </picture>
      </a>
      <div className="site-search-wrap" ref={searchRef}>
        <form className="site-search" role="search" onSubmit={event => { event.preventDefault(); if (matches[0]) window.location.href = `tailor-profile.html?tailor=${encodeURIComponent(slugFor(matches[0]))}`; else setSearchOpen(true); }}>
          <input name="query" type="search" placeholder={labels.search} aria-label={labels.searchLabel} value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} />
          <button type="submit" aria-label={labels.searchLabel} aria-expanded={searchOpen}>{searchIcon}</button>
        </form>
        {searchOpen && <div className="search-results" role="listbox" aria-label={labels.searchLabel}>
          {matches.length ? matches.map(tailor => <button className="search-result" key={tailor.name} type="button" role="option" aria-selected="false" onClick={() => { window.location.href = `tailor-profile.html?tailor=${encodeURIComponent(slugFor(tailor))}`; }}>
            <span className="result-name">{language === 'bn' ? tailor.nameBn : tailor.name}{tailor.verified && <span className="verification-badge" title="Approved tailor">✓</span>}</span>
            <span className="result-meta">{tailor.work[language]} <span>·</span> {tailor.city[language]}</span>
            <span className="result-rating">★ {tailor.rating}</span>
          </button>) : <p className="search-empty">{language === 'bn' ? 'কোনো দর্জি খুঁজে পাওয়া যায়নি' : 'No tailors found'}</p>}
        </div>}
      </div>
      {showTailorLink && <a className="site-tailor" href="become-tailor.html"><span aria-hidden="true">✦</span>{labels.becomeTailor}</a>}
      <button className="site-option site-language" type="button" onClick={toggleLanguage} aria-label={labels.translator}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h9M8.5 3v2M6 5c1 4 3 6 6 8M12 5c-1 4-3 7-7 9M13 21l4-10 4 10M14.5 17.5h5"/></svg>
      </button>
      <button className="site-option site-theme" type="button" onClick={toggleTheme} aria-label={labels.dark}>
        {dark ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>}
      </button>
      <a className="site-about" href="about.html">{labels.about}</a>
      {user && isDashboard && <div className="site-profile-controls">
        <div className="site-notifications-wrap" ref={notificationRef}>
          <button className="site-notifications-button" type="button" aria-label={`Notifications${notifications.some(item => !item.readAt) ? `, ${notifications.filter(item => !item.readAt).length} unread` : ''}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(value => !value); setAccountOpen(false); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
            {notifications.some(item => !item.readAt) && <i className="site-notifications-dot" aria-label="Unread notifications"/>}
          </button>
          {notificationsOpen && <div className="notifications-menu" role="dialog" aria-label={language === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'}>
            <div className="notifications-menu-head"><b>{language === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'}</b><span>{notifications.filter(item => !item.readAt).length} {language === 'bn' ? 'অপঠিত' : 'unread'}</span></div>
            {notifications.length ? <div className="notifications-menu-list">{notifications.slice(0, 6).map(item => <article key={item.id} className={!item.readAt ? 'unread' : ''}><span className="notifications-menu-mark"/><div><b>{String(item.kind || 'update').replaceAll('_', ' ')}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-BD')}</small></div></article>)}</div> : <p className="notifications-menu-empty">{language === 'bn' ? 'এখন কোনো বিজ্ঞপ্তি নেই।' : 'You have no notifications yet.'}</p>}
            <div className="notifications-menu-actions"><button type="button" disabled={!notifications.some(item => !item.readAt)} onClick={markAllNotificationsRead}>{language === 'bn' ? 'সব পড়া হয়েছে' : 'Mark all as read'}</button><a href={`${homeHref}?tab=notifications`} onClick={() => setNotificationsOpen(false)}>{language === 'bn' ? 'সব বিজ্ঞপ্তি দেখুন' : 'View all notifications'} →</a></div>
          </div>}
        </div>
        <div className="site-account-wrap" ref={accountRef}>
          <a className="site-profile-link" href={`${homeHref.split('#')[0]}?tab=profile`} onClick={() => setAccountOpen(false)}>Profile</a>
          <button className="site-account-button" type="button" aria-label={`Open ${user.name || 'account'} menu`} aria-expanded={accountOpen} onClick={() => { setAccountOpen(value => !value); setNotificationsOpen(false); }}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt=""/> : <span>{(user.name || user.email || 'A').trim().slice(0,1).toUpperCase()}</span>}
          </button>
          {accountOpen && <div className="account-menu" role="menu">
            <div className="account-menu-heading"><b>{user.name || 'E-Dorji account'}</b><small>{user.email}</small><span>{user.permissions?.includes('ADMIN') ? 'Administrator' : user.permissions?.includes('TAILOR') ? 'Customer · Tailor' : 'Customer'}</span></div>
            <a role="menuitem" href={`${homeHref.split('#')[0]}?tab=profile`} onClick={() => setAccountOpen(false)}><span>◉</span>Profile details & editing</a>
            <a role="menuitem" href={`${homeHref.split('#')[0]}?tab=orders`} onClick={() => setAccountOpen(false)}><span>▤</span>{user.permissions?.includes('ADMIN') ? 'Manage orders' : 'My orders'}</a>
            <a role="menuitem" href={`${homeHref.split('#')[0]}?tab=settings`} onClick={() => setAccountOpen(false)}><span>⚙</span>Security & settings</a>
            {user.permissions?.includes('TAILOR') && <a role="menuitem" href={page === 'tailor-dashboard' ? 'customer-dashboard.html' : 'tailor-dashboard.html'} onClick={() => setAccountOpen(false)}><span>⇄</span>{page === 'tailor-dashboard' ? 'Customer dashboard' : 'Tailor dashboard'}</a>}
            <button role="menuitem" type="button" onClick={leaveAccount}><span>⇄</span>Switch account</button>
            <button role="menuitem" type="button" className="account-menu-logout" onClick={leaveAccount}><span>↪</span>Log out</button>
          </div>}
        </div>
      </div>}
      {page === 'home' && <a className="site-start" href="login.html" aria-label={labels.startLabel}>{labels.start}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a>}
    </header>
  );
}
