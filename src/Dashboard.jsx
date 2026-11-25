import React, { useEffect, useMemo, useState } from 'react';
import tailors from './data/tailors.json';
import ui from './data/dashboard-ui.json';
import DesignStudio from './DesignStudio.jsx';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const api = async (path, options = {}) => {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
};

export default function Dashboard({ role }) {
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const [tab, setTab] = useState('overview');
  const [notice, setNotice] = useState('');
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [applications, setApplications] = useState([]);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [application, setApplication] = useState(null);
  const [adminSummary, setAdminSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [measurements, setMeasurements] = useState({});
  const [tailorProfile, setTailorProfile] = useState(null);
  const [notificationPreferences, setNotificationPreferences] = useState({ inApp: true, email: false, sms: false });
  const [marketTailors, setMarketTailors] = useState(tailors);
  const [savedByUser, setSavedByUser] = useState(() => read('e-dorji-saved-tailors', {}));
  const [filter, setFilter] = useState('');
  const [applicationSearch, setApplicationSearch] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('all');
  const [attachedDesign, setAttachedDesign] = useState(() => read('e-dorji-active-design', null));
  const labels = ui[language];
  const isAdmin = role === 'admin';
  const isTailor = role === 'tailor';
  const activeUser = session;
  const userOrders = isAdmin || isTailor ? orders : orders.filter(order => order.customerEmail === activeUser?.email);
  const favoriteNames = savedByUser[activeUser?.email] || [];
  const completionItems = isTailor ? [tailorProfile?.shopName, tailorProfile?.biography, tailorProfile?.services?.length] : [activeUser?.name, activeUser?.phone, activeUser?.city, activeUser?.address];
  const profileCompletion = Math.round(completionItems.filter(Boolean).length / completionItems.length * 100);
  const inProgress = userOrders.filter(order => !['Delivered', 'Cancelled'].includes(order.status));
  const visibleTailors = marketTailors.filter(tailor => [tailor.name, tailor.nameBn, tailor.work.en, tailor.work.bn, tailor.city.en, tailor.city.bn].join(' ').toLowerCase().includes(filter.toLowerCase()));
  const visibleApplications = applications.filter(application => (applicationFilter === 'all' || application.status === applicationFilter) && [application.name, application.email, application.city, ...application.specialties].join(' ').toLowerCase().includes(applicationSearch.toLowerCase()));

  useEffect(() => {
    const sync = event => setLanguage(event.detail === 'bn' ? 'bn' : 'en');
    window.addEventListener('e-dorji-language', sync);
    api('/api/session').then(async ({ user }) => {
      setSession(user);
      if (user && isAdmin) {
        const [appResult, customerResult, summaryResult, orderResult] = await Promise.all([api('/api/admin/applications'), api('/api/admin/customers'), api('/api/admin/summary'), api('/api/orders')]);
        setApplications(appResult.applications);
        setUsers(customerResult.users);
        setAdminSummary(summaryResult);
        setOrders(orderResult.orders);
      } else if (user) {
        const [applicationResult, notificationResult, orderResult, savedResult, measurementResult, preferenceResult] = await Promise.all([api('/api/tailor-applications'), api('/api/notifications'), api(`/api/orders${isTailor ? '?mode=tailor' : ''}`), api('/api/saved-tailors'), api('/api/measurements'), api('/api/notification-preferences')]);
        setApplication(applicationResult.application);
        setNotifications(notificationResult.notifications);
        setOrders(orderResult.orders);
        setSavedByUser({ [user.email]: savedResult.names });
        setMeasurements(measurementResult.measurements);
        setNotificationPreferences(preferenceResult.preferences);
        if (isTailor) setTailorProfile((await api('/api/tailor-profile')).profile);
      }
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    return () => window.removeEventListener('e-dorji-language', sync);
  }, [isAdmin, isTailor]);

  useEffect(() => {
    fetch('/api/public-tailors').then(response => response.ok ? response.json() : { tailors: [] }).then(result => {
      const registered = (result.tailors || []).map(item => ({ name: item.name, nameBn: item.name, work: { en: [item.shopName, ...item.services].filter(Boolean).join(' · '), bn: [item.shopName, ...item.services].filter(Boolean).join(' · ') }, city: { en: item.city, bn: item.city }, rating: 'New', verified: true }));
      setMarketTailors([...tailors.filter(sample => !registered.some(item => item.name.toLowerCase() === sample.name.toLowerCase())), ...registered]);
    }).catch(() => {});
  }, []);
  const say = message => { setNotice(message); window.setTimeout(() => setNotice(''), 3000); };
  const signOut = async () => { try { await api('/api/logout', { method: 'POST', body: '{}' }); } finally { location.href = 'e-dorji.html'; } };

  const navItems = isAdmin
    ? [['overview', labels.adminTabs[0]], ['orders', labels.adminTabs[1]], ['applications', labels.adminTabs[2]], ['customers', labels.adminTabs[3]]]
    : isTailor
      ? [['overview', 'Overview'], ['orders', 'Work orders'], ['profile', 'Tailor profile'], ['notifications', 'Notifications']]
      : [['overview', labels.tabLabels[0]], ['orders', labels.tabLabels[1]], ['find', labels.tabLabels[2]], ['studio', labels.tabLabels[6]], ['new', labels.tabLabels[3]], ['saved', labels.tabLabels[4]], ['measurements', 'My measurements'], ['profile', labels.tabLabels[5]], ['notifications', 'Notifications'], ['settings', 'Account settings']];

  async function toggleSaved(tailorName) {
    const current = savedByUser[activeUser.email] || [];
    const names = current.includes(tailorName) ? current.filter(name => name !== tailorName) : [...current, tailorName];
    try {
      const result = await api('/api/saved-tailors', { method: 'PUT', body: JSON.stringify({ names }) });
      setSavedByUser({ [activeUser.email]: result.names });
    } catch (error) { say(error.message); }
  }

  async function createOrder(event) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    try {
      const { order } = await api('/api/orders', { method: 'POST', body: JSON.stringify({ tailor: data.get('tailor'), garment: data.get('garment'), budget: data.get('budget'), neededBy: data.get('neededBy'), notes: data.get('notes'), design: attachedDesign }) });
      setOrders(current => [order, ...current]);
      localStorage.removeItem('e-dorji-active-design'); setAttachedDesign(null);
      form.reset(); setTab('orders'); say(labels.requestSuccess);
    } catch (error) { say(error.message); }
  }

  async function updateProfile(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const { user } = await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ name: data.get('name'), phone: data.get('phone'), city: data.get('city'), address: data.get('address') || '' }) });
      setSession(user); say(labels.profileSaved);
    } catch (error) { say(error.message); }
  }

  async function saveMeasurements(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await api('/api/measurements', { method: 'PUT', body: JSON.stringify({ measurements: values }) });
      setMeasurements(result.measurements); say('Measurements saved privately to your account.');
    } catch (error) { say(error.message); }
  }

  async function saveTailorProfile(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api('/api/tailor-profile', { method: 'PATCH', body: JSON.stringify({ shopName: data.get('shopName'), biography: data.get('biography'), services: String(data.get('services') || '').split(',').map(item => item.trim()).filter(Boolean), portfolio: String(data.get('portfolio') || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean), availability: data.get('availability'), public: data.get('public') === 'on' }) });
      setTailorProfile(result.profile); say('Your tailor profile has been saved.');
    } catch (error) { say(error.message); }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    if (data.get('newPassword') !== data.get('confirmPassword')) return say('The new passwords do not match.');
    try {
      await api('/api/password', { method: 'PATCH', body: JSON.stringify({ oldPassword: data.get('oldPassword'), newPassword: data.get('newPassword') }) });
      form.reset(); say('Password changed successfully.');
    } catch (error) { say(error.message); }
  }

  async function saveNotificationPreferences(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api('/api/notification-preferences', { method: 'PUT', body: JSON.stringify({ inApp: data.get('inApp') === 'on', email: data.get('email') === 'on', sms: data.get('sms') === 'on' }) });
      setNotificationPreferences(result.preferences); say('Notification preferences saved.');
    } catch (error) { say(error.message); }
  }

  async function deleteAccount() {
    const password = window.prompt('Enter your password to permanently delete your account.');
    if (password === null) return;
    try { await api('/api/account', { method: 'DELETE', body: JSON.stringify({ password }) }); location.href = 'e-dorji.html'; }
    catch (error) { say(error.message); }
  }

  function useDesign(design) {
    write('e-dorji-active-design', design);
    setAttachedDesign(design);
    setTab('new');
    say(labels.designAttached);
  }

  async function updateOrder(orderId, status) {
    try {
      const { order } = await api(`/api/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setOrders(current => current.map(item => item.id === orderId ? order : item)); say(labels.orderUpdated);
    } catch (error) { say(error.message); }
  }

  function localizedStatus(status) {
    const index = ui.en.allStatuses.indexOf(status);
    return labels.allStatuses[index] || status;
  }

  async function reviewApplication(applicationId, status) {
    const message = status === 'REJECTED' || status === 'NEEDS_INFORMATION' ? window.prompt(status === 'REJECTED' ? 'Reason for rejection (shown to applicant):' : 'What information is needed from the applicant?') : '';
    if ((status === 'REJECTED' || status === 'NEEDS_INFORMATION') && message === null) return;
    try {
      const { application: updated } = await api(`/api/admin/applications/${applicationId}`, { method: 'PATCH', body: JSON.stringify({ status, message }) });
      setApplications(items => items.map(item => item.id === applicationId ? updated : item));
      const summary = await api('/api/admin/summary'); setAdminSummary(summary);
      say(status === 'APPROVED' ? labels.applicationApproved : status === 'REJECTED' ? labels.applicationRejected : status);
    } catch (error) { say(error.message); }
  }

  async function toggleTailorAccess(user) {
    try {
      const { user: updated } = await api(`/api/admin/customers/${user.id}`, { method: 'PATCH', body: JSON.stringify({ tailorSuspended: !user.tailorSuspended }) });
      setUsers(current => current.map(item => item.id === user.id ? updated : item));
      const summary = await api('/api/admin/summary'); setAdminSummary(summary);
    } catch (error) { say(error.message); }
  }

  async function saveInternalNote(applicationId, internalNote) {
    try {
      await api(`/api/admin/applications/${applicationId}/notes`, { method: 'PATCH', body: JSON.stringify({ internalNote }) });
      setApplications(items => items.map(item => item.id === applicationId ? { ...item, internalNote } : item));
    } catch (error) { say(error.message); }
  }

  function orderTable(items, admin = false) {
    if (!items.length) return <div className="dash-empty"><span>✂</span><h3>{labels.noOrders}</h3><p>{labels.noOrdersCopy}</p>{!admin && <button className="dash-primary" onClick={() => setTab('new')}>{labels.newOrder}</button>}</div>;
    return <div className="dash-order-list">{items.map(order => <article className="dash-order" key={order.id}>
      <div className="dash-order-main"><span className="dash-order-type">{order.garment}</span><h3>{order.tailor}</h3><p>{(admin || isTailor) && <><b>{labels.customer}:</b> {order.customerName} · </>}{order.design?.label ? <><b>{labels.design}:</b> {order.design.label} · </> : null}{order.notes || labels.empty}</p><small>{new Date(order.createdAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-BD')}{order.neededBy ? ` · ${labels.neededBy}: ${order.neededBy}` : ''}</small></div>
      <div className="dash-order-side"><strong>{order.budget ? `৳${Number(order.budget).toLocaleString()}` : labels.empty}</strong>{admin || isTailor ? <select value={order.status} onChange={event => updateOrder(order.id, event.target.value)} aria-label={`${labels.status}: ${order.garment}`}>{['New request','Proposal sent','Production started','Ready for fitting','Delivered','Cancelled'].map(status => <option key={status} value={status}>{status}</option>)}</select> : <span className="dash-status">{localizedStatus(order.status)}</span>}</div>
    </article>)}</div>;
  }

  function tailorCards(names = null) {
    const list = names ? tailors.filter(tailor => names.includes(tailor.name)) : visibleTailors;
    if (!list.length) return <div className="dash-empty"><span>♡</span><h3>{labels.noSaved}</h3><p>{labels.noSavedCopy}</p><button className="dash-secondary" onClick={() => setTab('find')}>{labels.browseAll}</button></div>;
    return <div className="dash-tailor-grid">{list.map(tailor => {
      const saved = favoriteNames.includes(tailor.name);
      return <article className="dash-tailor-card" key={tailor.name}><div className="dash-tailor-avatar">{(language === 'bn' ? tailor.nameBn : tailor.name).slice(0, 1)}</div><div className="dash-tailor-rating">{tailor.rating === 'New' ? 'NEW' : `★ ${tailor.rating}`}</div><h3>{language === 'bn' ? tailor.nameBn : tailor.name} {tailor.verified && <span className="verification-badge" title="Approved tailor">✓</span>}</h3><p>{tailor.work[language]}</p><small>{tailor.city[language]}</small><button className={saved ? 'dash-secondary' : 'dash-primary'} onClick={() => toggleSaved(tailor.name)}>{saved ? labels.unsave : labels.save}</button></article>;
    })}</div>;
  }

  const heading = useMemo(() => navItems.find(item => item[0] === tab)?.[1] || labels.overview, [navItems, tab, labels.overview]);

  if (!authReady) return <main className="dash-gate"><div><img src="assets/e-dorji-logo.svg" alt="E-Dorji"/><p>Loading your secure account…</p></div></main>;
  const hasPermission = isAdmin ? session?.permissions?.includes('ADMIN') : isTailor ? session?.permissions?.includes('TAILOR') : session?.permissions?.includes('CUSTOMER');
  if (!activeUser || !hasPermission) return <main className="dash-gate"><div><img src="assets/e-dorji-logo.svg" alt="E-Dorji"/><h1>{isAdmin ? 'Administrator access required' : isTailor ? 'Approved tailor access required' : labels.loginRequired}</h1><a className="dash-primary" href={isAdmin ? '/admin/login' : 'login.html'}>{isAdmin ? 'Administrator sign in' : labels.goLogin}</a></div></main>;

  return <main className={`dashboard-shell ${isAdmin ? 'admin-dashboard' : 'customer-dashboard'}`}>
    <aside className="dash-sidebar">
      <a className="dash-brand" href="e-dorji.html"><img src="assets/e-dorji-logo.svg" alt="E-Dorji"/></a>
      <p className="dash-sidebar-label">{isAdmin ? labels.eyebrowAdmin : labels.eyebrowCustomer}</p>
      <nav aria-label={isAdmin ? 'Admin management' : 'Customer management'}>{navItems.map(([key, text]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><span aria-hidden="true">{({ overview: '◫', orders: '▤', find: '⌕', studio: '✦', new: '+', saved: '♡', profile: '◉', applications: '✂', customers: '♙' })[key]}</span>{text}</button>)}</nav>
      <div className="dash-sidebar-bottom"><span className="dash-user-avatar">{(activeUser?.name || (isAdmin ? 'A' : activeUser?.email || '?')).slice(0, 1).toUpperCase()}</span><div><b>{activeUser?.name || (isAdmin ? 'Admin' : activeUser?.email)}</b><small>{isAdmin ? 'Admin · demo' : activeUser?.email}</small></div><button onClick={signOut} title={labels.signOut} aria-label={labels.signOut}>↪</button></div>
    </aside>
    <section className="dash-content">
      <header className="dash-topline"><div><p>{isAdmin ? labels.eyebrowAdmin : isTailor ? 'APPROVED ARTISAN' : labels.eyebrowCustomer}</p><h1>{heading}</h1></div><div className="dash-top-actions">{session?.permissions?.includes('TAILOR') && <a className="dash-secondary" href={isTailor ? 'customer-dashboard.html' : 'tailor-dashboard.html'}>{isTailor ? 'Customer mode' : 'Tailor mode'}</a>}<span className="dash-demo-badge">{isAdmin ? 'Secure admin workspace' : isTailor ? 'Verified tailor' : labels.demoNotice}</span></div></header>
      {notice && <p className="dash-notice" role="status">{notice}</p>}
      {tab === 'overview' && <>
        <div className="dash-welcome"><div><span>{labels.welcome}{activeUser?.name ? `, ${activeUser.name.split(' ')[0]}` : ''} {isTailor && <span className="verification-badge" title="Verified tailor">✓</span>}</span><h2>{isAdmin ? labels.adminTitle : isTailor ? 'Your craft, ready for its next customer.' : labels.customerTitle}</h2></div><div className="dash-welcome-mark">✦</div></div>
        <div className="dash-metrics">{(isAdmin ? [[labels.registeredCustomers, adminSummary?.customers ?? users.length, '♙'], ['Tailor applications', adminSummary?.applications ?? applications.length, '✂'], ['Pending review', adminSummary?.pending ?? 0, '◷'], ['Approved tailors', adminSummary?.approved ?? 0, '✓'], ['Rejected applications', adminSummary?.rejected ?? 0, '×'], ['Suspended tailors', adminSummary?.suspended ?? 0, 'Ⅱ']] : isTailor ? [['New requests', orders.filter(order => order.status === 'New request').length, '✂'], ['Active orders', inProgress.length, '▤'], ['Rating', '—', '★']] : [[labels.totalOrders, userOrders.length, '▤'], [labels.inProgress, inProgress.length, '◷'], [labels.savedArtisans, favoriteNames.length, '♡']]).map(([label, value, icon]) => <article className="dash-metric" key={label}><span>{icon}</span><p>{label}</p><strong>{value}</strong></article>)}</div>
        {!isAdmin && <section className="dash-panel profile-completion"><div><span>{isTailor ? 'Tailor profile completion' : 'Profile completion'}</span><strong>{profileCompletion}%</strong></div><progress max="100" value={profileCompletion}/><button className="dash-secondary" onClick={() => setTab('profile')}>{isTailor ? 'Edit tailor profile' : 'Complete your profile'}</button></section>}
        {!isAdmin && !isTailor && <section className="dash-panel tailor-application-card"><div><span className={`dash-status ${(application?.status || 'not-applied').toLowerCase()}`}>{application?.status?.replaceAll('_', ' ') || 'NOT APPLIED'}</span><h2>{application?.status === 'APPROVED' ? 'You are an approved tailor' : application?.status === 'UNDER_REVIEW' ? 'Your application is under review' : application?.status === 'SUBMITTED' ? 'Application submitted' : application?.status === 'NEEDS_INFORMATION' ? 'More information needed' : application?.status === 'REJECTED' ? 'Application not approved' : 'Become a tailor'}</h2><p>{application?.reviewMessage || (application?.status === 'APPROVED' ? 'Your existing account now includes customer and tailor access.' : application?.status ? 'You can follow your application status here.' : 'Share your experience and specialties to apply as an artisan.')}</p></div>{application?.status === 'APPROVED' ? <a className="dash-primary" href="tailor-dashboard.html">Open tailor dashboard</a> : application?.status === 'SUBMITTED' || application?.status === 'UNDER_REVIEW' ? null : <a className="dash-primary" href="become-tailor.html">{application?.status ? 'Update and reapply' : 'Start application'}</a>}</section>}
        <div className="dash-overview-grid"><section className="dash-panel"><div className="dash-panel-head"><h2>{isAdmin ? labels.manageOrders : isTailor ? 'Recent work requests' : labels.recentOrders}</h2><button onClick={() => setTab('orders')}>{isTailor ? 'Work orders' : labels.orders} →</button></div>{userOrders.length ? orderTable(userOrders.slice(0, 3), isAdmin) : <div className="dash-empty compact"><h3>{labels.noOrders}</h3><p>{labels.noOrdersCopy}</p></div>}</section><section className="dash-panel dash-start-panel"><span>✦</span><h2>{isTailor ? 'Grow your tailor profile' : labels.quickStart}</h2><p>{isTailor ? 'Keep your services and availability up to date for customers.' : labels.quickStartCopy}</p><button className="dash-primary" onClick={() => setTab(isAdmin ? 'applications' : isTailor ? 'profile' : 'new')}>{isAdmin ? labels.applications : isTailor ? 'Edit tailor profile' : labels.browse}</button>{!isAdmin && !isTailor && <button className="dash-secondary" onClick={() => setTab('studio')}>{labels.tabLabels[6]} ↗</button>}</section></div>
      </>}
      {tab === 'orders' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{isAdmin ? labels.manageOrders : isTailor ? 'Work orders' : labels.orders}</h2><p>{isAdmin ? labels.demoNotice : labels.noOrdersCopy}</p></div>{!isAdmin && !isTailor && <button className="dash-primary" onClick={() => setTab('new')}>+ {labels.newOrder}</button>}</div>{orderTable(userOrders, isAdmin)}</section>}
      {tab === 'find' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.findTailors}</h2><p>{labels.browseAll}</p></div><input className="dash-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder={labels.specialty}/></div>{tailorCards()}</section>}
      {tab === 'studio' && !isAdmin && <section className="dash-panel full studio-dash-panel"><DesignStudio language={language} onUseDesign={useDesign}/></section>}
      {tab === 'saved' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.saved}</h2><p>{labels.noSavedCopy}</p></div></div>{tailorCards(favoriteNames)}</section>}
      {tab === 'new' && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>{labels.newOrder}</h2><p>{labels.quickStartCopy}</p></div></div><form className="dash-form" onSubmit={createOrder}>
        <label>{labels.garment}<select name="garment" required defaultValue=""><option value="" disabled>{labels.chooseGarment}</option>{labels.garments.map(garment => <option key={garment}>{garment}</option>)}</select></label>
        <label>{labels.tailor}<select name="tailor" required defaultValue=""><option value="" disabled>{labels.chooseTailor}</option>{marketTailors.map(tailor => <option key={tailor.name}>{language === 'bn' ? tailor.nameBn : tailor.name}</option>)}</select></label>
        <div className="dash-form-row"><label>{labels.budget}<input name="budget" type="number" min="0" step="100" placeholder="5000"/></label><label>{labels.neededBy}<input name="neededBy" type="date"/></label></div>
        {attachedDesign && <div className="attached-design"><span className="attached-design-chip" style={{ background: attachedDesign.fabric }}></span><div><b>{labels.attachedDesign}</b><small>{attachedDesign.label}</small></div><button type="button" onClick={() => { localStorage.removeItem('e-dorji-active-design'); setAttachedDesign(null); }}>{labels.removeDesign}</button></div>}
        {!attachedDesign && <button className="dash-secondary order-design-link" type="button" onClick={() => setTab('studio')}>✦ {labels.tabLabels[6]}</button>}
        <label>{labels.orderNotes}<textarea name="notes" rows="4" placeholder={labels.orderNotesPlaceholder}/></label>
        <button className="dash-primary" type="submit">{labels.placeRequest} →</button>
      </form></section>}
      {tab === 'measurements' && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>My measurements</h2><p>Only you can view and update these private sizing details.</p></div></div><form className="dash-form" onSubmit={saveMeasurements}><div className="dash-form-row">{[['chest','Chest'],['waist','Waist'],['hip','Hip'],['shoulder','Shoulder'],['sleeve','Sleeve'],['inseam','Inseam'],['length','Garment length']].map(([key,label]) => <label key={key}>{label} (cm)<input name={key} type="number" min="0" max="300" step="0.1" defaultValue={measurements[key] || ''}/></label>)}</div><button className="dash-primary">Save measurements</button></form></section>}
      {tab === 'profile' && isTailor && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>Tailor profile</h2><p><span className="verification-badge">✓ Verified tailor</span> · {activeUser.email}</p></div></div><form className="dash-form" onSubmit={saveTailorProfile}><label>Shop or studio name<input name="shopName" defaultValue={tailorProfile?.shopName || ''} required/></label><label>About your craft<textarea name="biography" rows="4" defaultValue={tailorProfile?.biography || ''} required minLength="30"/></label><label>Services, separated by commas<input name="services" defaultValue={tailorProfile?.services?.join(', ') || ''} placeholder="Panjabi, alterations, embroidery"/></label><label>Portfolio links, one HTTPS URL per line<textarea name="portfolio" rows="3" defaultValue={tailorProfile?.portfolio?.join('\n') || ''}/></label><label>Availability<select name="availability" defaultValue={tailorProfile?.availability || 'available'}><option value="available">Available</option><option value="limited">Limited availability</option><option value="unavailable">Not taking orders</option></select></label><label className="dash-check-label"><input name="public" type="checkbox" defaultChecked={tailorProfile?.public || false}/> Show my tailor profile publicly</label><button className="dash-primary">Save tailor profile</button></form></section>}
      {tab === 'profile' && !isTailor && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>{labels.profileDetails}</h2><p>{activeUser.email}</p></div></div><form className="dash-form" onSubmit={updateProfile}><label>{labels.fullName}<input name="name" defaultValue={activeUser.name || ''} required/></label><label>{labels.email}<input value={activeUser.email} readOnly/></label><label>{labels.phone}<input name="phone" defaultValue={activeUser.phone || ''} required/></label><label>{labels.city}<input name="city" defaultValue={activeUser.city || ''} required/></label><label>Address<input name="address" defaultValue={activeUser.address || ''}/></label><button className="dash-primary">{labels.saveProfile}</button></form></section>}
      {!isAdmin && !isTailor && tab === 'settings' && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>Account security</h2><p>Update your password, notification preferences, or account.</p></div></div><form className="dash-form" onSubmit={changePassword}><label>Current password<input name="oldPassword" type="password" required autoComplete="current-password"/></label><label>New password<input name="newPassword" type="password" required minLength="10" autoComplete="new-password"/></label><label>Confirm new password<input name="confirmPassword" type="password" required minLength="10" autoComplete="new-password"/></label><button className="dash-primary">Change password</button></form><form className="dash-form preference-form" onSubmit={saveNotificationPreferences}><h3>Notification preferences</h3><label className="dash-check-label"><input name="inApp" type="checkbox" defaultChecked={notificationPreferences.inApp}/> In-app alerts</label><label className="dash-check-label"><input name="email" type="checkbox" defaultChecked={notificationPreferences.email}/> Email alerts (available when email delivery is configured)</label><label className="dash-check-label"><input name="sms" type="checkbox" defaultChecked={notificationPreferences.sms}/> SMS alerts (available when SMS delivery is configured)</label><button className="dash-secondary">Save preferences</button></form><button className="dash-secondary delete-account-button" onClick={deleteAccount}>Delete my account</button></section>}
      {tab === 'notifications' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>Notifications</h2><p>Your account and application updates</p></div></div>{notifications.length ? <div className="dash-application-list">{notifications.map(item => <article className="dash-application" key={item.id}><div><span className="dash-status">{item.kind.replaceAll('_', ' ')}</span><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></article>)}</div> : <div className="dash-empty"><h3>You’re all caught up.</h3></div>}</section>}
      {isAdmin && tab === 'applications' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.applicationsTitle}</h2><p>Review submissions and send a decision or information request.</p></div></div><div className="application-filters"><input aria-label="Search applications" placeholder="Search name, email, specialty or city" value={applicationSearch} onChange={event => setApplicationSearch(event.target.value)}/><select aria-label="Filter by application status" value={applicationFilter} onChange={event => setApplicationFilter(event.target.value)}><option value="all">All statuses</option>{['SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','NEEDS_INFORMATION'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div>{visibleApplications.length ? <div className="dash-application-list">{visibleApplications.map(application => <article className="dash-application" key={application.id}><div><span className={`dash-status ${application.status.toLowerCase()}`}>{application.status.replaceAll('_', ' ')}</span><h3>{application.name}</h3><p>{application.email} · {application.phone} · {application.city}</p><p><b>{labels.specialty}:</b> {application.specialties.join(', ')} · {application.experience} {labels.experience}</p><p><b>{labels.workshopLabel || labels.city}:</b> {application.workshop}</p>{application.portfolio && <a href={application.portfolio} target="_blank" rel="noreferrer">{application.portfolio}</a>}<p>{application.introduction}</p>{application.reviewMessage && <p><b>Applicant message:</b> {application.reviewMessage}</p>}<label className="internal-note">Internal admin note<textarea rows="2" defaultValue={application.internalNote} onBlur={event => saveInternalNote(application.id, event.currentTarget.value)} placeholder="Only visible to admins"/></label></div>{application.status !== 'APPROVED' && <div className="dash-actions"><button className="dash-secondary" onClick={() => reviewApplication(application.id, 'UNDER_REVIEW')}>Under review</button><button className="dash-primary" onClick={() => reviewApplication(application.id, 'APPROVED')}>{labels.approve}</button><button className="dash-secondary" onClick={() => reviewApplication(application.id, 'NEEDS_INFORMATION')}>Request information</button><button className="dash-secondary" onClick={() => reviewApplication(application.id, 'REJECTED')}>{labels.reject}</button></div>}</article>)}</div> : <div className="dash-empty"><span>✂</span><h3>{applications.length ? 'No matching applications.' : labels.noApplications}</h3></div>}</section>}
      {isAdmin && tab === 'customers' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.customersTitle}</h2><p>{users.length} {labels.registeredCustomers.toLowerCase()}</p></div></div>{users.length ? <div className="dash-customer-list">{users.map(user => <article key={user.email}><span className="dash-user-avatar">{(user.name || user.email).slice(0,1).toUpperCase()}</span><div><b>{user.name} {user.applicationStatus === 'APPROVED' && !user.tailorSuspended && <span className="verification-badge" title="Approved tailor">✓</span>}</b><small>{user.email} · {user.phone || labels.empty} · {user.city || labels.empty} · {user.applicationStatus.replaceAll('_', ' ')}</small></div>{user.applicationStatus === 'APPROVED' && <button className="dash-secondary" onClick={() => toggleTailorAccess(user)}>{user.tailorSuspended ? 'Reactivate tailor' : 'Suspend tailor'}</button>}</article>)}</div> : <div className="dash-empty"><span>♙</span><h3>{labels.noCustomers}</h3></div>}</section>}
    </section>
  </main>;
}
