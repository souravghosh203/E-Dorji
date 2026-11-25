import React, { useEffect, useMemo, useState } from 'react';
import tailors from './data/tailors.json';
import ui from './data/dashboard-ui.json';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function Dashboard({ role }) {
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const [tab, setTab] = useState('overview');
  const [notice, setNotice] = useState('');
  const [users, setUsers] = useState(() => read('e-dorji-users', []));
  const [orders, setOrders] = useState(() => read('e-dorji-orders', []));
  const [applications, setApplications] = useState(() => read('e-dorji-applications', []));
  const [session, setSession] = useState(() => read('e-dorji-session', null));
  const [savedByUser, setSavedByUser] = useState(() => read('e-dorji-saved-tailors', {}));
  const [filter, setFilter] = useState('');
  const labels = ui[language];
  const isAdmin = role === 'admin';
  const activeUser = users.find(user => user.email === session?.email) || session;
  const userOrders = isAdmin ? orders : orders.filter(order => order.customerEmail === activeUser?.email);
  const favoriteNames = savedByUser[activeUser?.email] || [];
  const inProgress = userOrders.filter(order => !['Delivered', 'Cancelled'].includes(order.status));
  const visibleTailors = tailors.filter(tailor => [tailor.name, tailor.nameBn, tailor.work.en, tailor.work.bn, tailor.city.en, tailor.city.bn].join(' ').toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    const sync = event => setLanguage(event.detail === 'bn' ? 'bn' : 'en');
    window.addEventListener('e-dorji-language', sync);
    const update = () => {
      setUsers(read('e-dorji-users', []));
      setOrders(read('e-dorji-orders', []));
      setApplications(read('e-dorji-applications', []));
      setSavedByUser(read('e-dorji-saved-tailors', {}));
      setSession(read('e-dorji-session', null));
    };
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('e-dorji-language', sync); window.removeEventListener('storage', update); };
  }, []);

  const persistOrders = value => { write('e-dorji-orders', value); setOrders(value); };
  const persistApplications = value => { write('e-dorji-applications', value); setApplications(value); };
  const say = message => { setNotice(message); window.setTimeout(() => setNotice(''), 3000); };
  const signOut = () => { localStorage.removeItem('e-dorji-session'); location.href = 'e-dorji.html'; };

  const navItems = isAdmin
    ? [['overview', labels.adminTabs[0]], ['orders', labels.adminTabs[1]], ['applications', labels.adminTabs[2]], ['customers', labels.adminTabs[3]]]
    : [['overview', labels.tabLabels[0]], ['orders', labels.tabLabels[1]], ['find', labels.tabLabels[2]], ['new', labels.tabLabels[3]], ['saved', labels.tabLabels[4]], ['profile', labels.tabLabels[5]]];

  function toggleSaved(tailorName) {
    const next = { ...savedByUser };
    const list = new Set(next[activeUser.email] || []);
    list.has(tailorName) ? list.delete(tailorName) : list.add(tailorName);
    next[activeUser.email] = [...list];
    write('e-dorji-saved-tailors', next);
    setSavedByUser(next);
  }

  function createOrder(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const order = {
      id: id(), customerEmail: activeUser.email, customerName: activeUser.name || activeUser.email,
      tailor: data.get('tailor'), garment: data.get('garment'), budget: Number(data.get('budget')) || 0,
      neededBy: data.get('neededBy') || '', notes: data.get('notes') || '', status: ui.en.allStatuses[0],
      createdAt: new Date().toISOString(),
    };
    persistOrders([order, ...orders]);
    event.currentTarget.reset();
    setTab('orders');
    say(labels.requestSuccess);
  }

  function updateProfile(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const updated = { ...activeUser, name: data.get('name'), phone: data.get('phone'), city: data.get('city') };
    const nextUsers = users.map(user => user.email === activeUser.email ? { ...user, ...updated } : user);
    const safeSession = { email: updated.email, name: updated.name, role: updated.role, phone: updated.phone, city: updated.city };
    write('e-dorji-users', nextUsers);
    write('e-dorji-session', safeSession);
    setUsers(nextUsers);
    setSession(safeSession);
    say(labels.profileSaved);
  }

  function updateOrder(orderId, status) {
    persistOrders(orders.map(order => order.id === orderId ? { ...order, status } : order));
    say(labels.orderUpdated);
  }

  function localizedStatus(status) {
    const index = ui.en.allStatuses.indexOf(status);
    return labels.allStatuses[index] || status;
  }

  function reviewApplication(applicationId, status) {
    persistApplications(applications.map(application => application.id === applicationId ? { ...application, status, reviewedAt: new Date().toISOString() } : application));
    say(status === 'approved' ? labels.applicationApproved : labels.applicationRejected);
  }

  function orderTable(items, admin = false) {
    if (!items.length) return <div className="dash-empty"><span>✂</span><h3>{labels.noOrders}</h3><p>{labels.noOrdersCopy}</p>{!admin && <button className="dash-primary" onClick={() => setTab('new')}>{labels.newOrder}</button>}</div>;
    return <div className="dash-order-list">{items.map(order => <article className="dash-order" key={order.id}>
      <div className="dash-order-main"><span className="dash-order-type">{order.garment}</span><h3>{order.tailor}</h3><p>{admin && <><b>{labels.customer}:</b> {order.customerName} · </>}{order.notes || labels.empty}</p><small>{new Date(order.createdAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-BD')}{order.neededBy ? ` · ${labels.neededBy}: ${order.neededBy}` : ''}</small></div>
      <div className="dash-order-side"><strong>{order.budget ? `৳${Number(order.budget).toLocaleString()}` : labels.empty}</strong>{admin ? <select value={order.status} onChange={event => updateOrder(order.id, event.target.value)} aria-label={`${labels.status}: ${order.garment}`}>{ui.en.allStatuses.map((status, index) => <option key={status} value={status}>{labels.allStatuses[index]}</option>)}</select> : <span className="dash-status">{localizedStatus(order.status)}</span>}</div>
    </article>)}</div>;
  }

  function tailorCards(names = null) {
    const list = names ? tailors.filter(tailor => names.includes(tailor.name)) : visibleTailors;
    if (!list.length) return <div className="dash-empty"><span>♡</span><h3>{labels.noSaved}</h3><p>{labels.noSavedCopy}</p><button className="dash-secondary" onClick={() => setTab('find')}>{labels.browseAll}</button></div>;
    return <div className="dash-tailor-grid">{list.map(tailor => {
      const saved = favoriteNames.includes(tailor.name);
      return <article className="dash-tailor-card" key={tailor.name}><div className="dash-tailor-avatar">{(language === 'bn' ? tailor.nameBn : tailor.name).slice(0, 1)}</div><div className="dash-tailor-rating">★ {tailor.rating}</div><h3>{language === 'bn' ? tailor.nameBn : tailor.name}</h3><p>{tailor.work[language]}</p><small>{tailor.city[language]}</small><button className={saved ? 'dash-secondary' : 'dash-primary'} onClick={() => toggleSaved(tailor.name)}>{saved ? labels.unsave : labels.save}</button></article>;
    })}</div>;
  }

  const heading = useMemo(() => navItems.find(item => item[0] === tab)?.[1] || labels.overview, [navItems, tab, labels.overview]);

  if ((!isAdmin && (!activeUser || activeUser.role === 'admin')) || (isAdmin && session?.role !== 'admin')) return <main className="dash-gate"><div><img src="assets/e-dorji-logo.svg" alt="E-Dorji"/><h1>{isAdmin ? labels.adminAccess : labels.loginRequired}</h1><a className="dash-primary" href="login.html">{isAdmin ? labels.adminDemoCta : labels.goLogin}</a></div></main>;

  return <main className={`dashboard-shell ${isAdmin ? 'admin-dashboard' : 'customer-dashboard'}`}>
    <aside className="dash-sidebar">
      <a className="dash-brand" href="e-dorji.html"><img src="assets/e-dorji-logo.svg" alt="E-Dorji"/></a>
      <p className="dash-sidebar-label">{isAdmin ? labels.eyebrowAdmin : labels.eyebrowCustomer}</p>
      <nav aria-label={isAdmin ? 'Admin management' : 'Customer management'}>{navItems.map(([key, text]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><span aria-hidden="true">{({ overview: '◫', orders: '▤', find: '⌕', new: '+', saved: '♡', profile: '◉', applications: '✂', customers: '♙' })[key]}</span>{text}</button>)}</nav>
      <div className="dash-sidebar-bottom"><span className="dash-user-avatar">{isAdmin ? 'A' : (activeUser.name || activeUser.email).slice(0, 1).toUpperCase()}</span><div><b>{isAdmin ? 'E-Dorji Admin' : (activeUser.name || activeUser.email)}</b><small>{isAdmin ? 'Admin · demo' : activeUser.email}</small></div><button onClick={signOut} title={labels.signOut} aria-label={labels.signOut}>↪</button></div>
    </aside>
    <section className="dash-content">
      <header className="dash-topline"><div><p>{isAdmin ? labels.eyebrowAdmin : labels.eyebrowCustomer}</p><h1>{heading}</h1></div><span className="dash-demo-badge">{labels.demoNotice}</span></header>
      {notice && <p className="dash-notice" role="status">{notice}</p>}
      {tab === 'overview' && <>
        <div className="dash-welcome"><div><span>{labels.welcome}{activeUser?.name ? `, ${activeUser.name.split(' ')[0]}` : ''}</span><h2>{isAdmin ? labels.adminTitle : labels.customerTitle}</h2></div><div className="dash-welcome-mark">✦</div></div>
        <div className="dash-metrics">{(isAdmin ? [[labels.activeOrders, orders.length, '▤'], [labels.pendingApplications, applications.filter(app => app.status === 'pending').length, '✂'], [labels.registeredCustomers, users.filter(user => user.role === 'customer').length, '♙']] : [[labels.totalOrders, userOrders.length, '▤'], [labels.inProgress, inProgress.length, '◷'], [labels.savedArtisans, favoriteNames.length, '♡']]).map(([label, value, icon]) => <article className="dash-metric" key={label}><span>{icon}</span><p>{label}</p><strong>{value}</strong></article>)}</div>
        <div className="dash-overview-grid"><section className="dash-panel"><div className="dash-panel-head"><h2>{isAdmin ? labels.manageOrders : labels.recentOrders}</h2><button onClick={() => setTab('orders')}>{labels.orders} →</button></div>{userOrders.length ? orderTable(userOrders.slice(0, 3), isAdmin) : <div className="dash-empty compact"><h3>{labels.noOrders}</h3><p>{labels.noOrdersCopy}</p></div>}</section><section className="dash-panel dash-start-panel"><span>✦</span><h2>{labels.quickStart}</h2><p>{labels.quickStartCopy}</p><button className="dash-primary" onClick={() => setTab(isAdmin ? 'applications' : 'new')}>{isAdmin ? labels.applications : labels.browse}</button></section></div>
      </>}
      {tab === 'orders' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{isAdmin ? labels.manageOrders : labels.orders}</h2><p>{isAdmin ? labels.demoNotice : labels.noOrdersCopy}</p></div>{!isAdmin && <button className="dash-primary" onClick={() => setTab('new')}>+ {labels.newOrder}</button>}</div>{orderTable(userOrders, isAdmin)}</section>}
      {tab === 'find' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.findTailors}</h2><p>{labels.browseAll}</p></div><input className="dash-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder={labels.specialty}/></div>{tailorCards()}</section>}
      {tab === 'saved' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.saved}</h2><p>{labels.noSavedCopy}</p></div></div>{tailorCards(favoriteNames)}</section>}
      {tab === 'new' && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>{labels.newOrder}</h2><p>{labels.quickStartCopy}</p></div></div><form className="dash-form" onSubmit={createOrder}>
        <label>{labels.garment}<select name="garment" required defaultValue=""><option value="" disabled>{labels.chooseGarment}</option>{labels.garments.map(garment => <option key={garment}>{garment}</option>)}</select></label>
        <label>{labels.tailor}<select name="tailor" required defaultValue=""><option value="" disabled>{labels.chooseTailor}</option>{tailors.map(tailor => <option key={tailor.name}>{language === 'bn' ? tailor.nameBn : tailor.name}</option>)}</select></label>
        <div className="dash-form-row"><label>{labels.budget}<input name="budget" type="number" min="0" step="100" placeholder="5000"/></label><label>{labels.neededBy}<input name="neededBy" type="date"/></label></div>
        <label>{labels.orderNotes}<textarea name="notes" rows="4" placeholder={labels.orderNotesPlaceholder}/></label>
        <button className="dash-primary" type="submit">{labels.placeRequest} →</button>
      </form></section>}
      {tab === 'profile' && <section className="dash-panel dash-form-panel"><div className="dash-panel-head"><div><h2>{labels.profileDetails}</h2><p>{activeUser.email}</p></div></div><form className="dash-form" onSubmit={updateProfile}><label>{labels.fullName}<input name="name" defaultValue={activeUser.name || ''} required/></label><label>{labels.email}<input value={activeUser.email} readOnly/></label><label>{labels.phone}<input name="phone" defaultValue={activeUser.phone || ''}/></label><label>{labels.city}<input name="city" defaultValue={activeUser.city || ''}/></label><button className="dash-primary">{labels.saveProfile}</button></form></section>}
      {isAdmin && tab === 'applications' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.applicationsTitle}</h2><p>{labels.demoNotice}</p></div></div>{applications.length ? <div className="dash-application-list">{applications.map(application => <article className="dash-application" key={application.id}><div><span className={`dash-status ${application.status}`}>{application.status === 'pending' ? labels.pending : application.status === 'approved' ? labels.applicationApproved : labels.applicationRejected}</span><h3>{application.name}</h3><p>{application.email} · {application.phone} · {application.city}</p><p><b>{labels.specialty}:</b> {application.specialties} · {application.experience} {labels.experience}</p><p><b>{labels.workshopLabel || labels.city}:</b> {application.workshop}</p>{application.portfolio && <a href={application.portfolio} target="_blank" rel="noreferrer">{application.portfolio}</a>}<p>{application.introduction}</p></div>{application.status === 'pending' && <div className="dash-actions"><button className="dash-primary" onClick={() => reviewApplication(application.id, 'approved')}>{labels.approve}</button><button className="dash-secondary" onClick={() => reviewApplication(application.id, 'rejected')}>{labels.reject}</button></div>}</article>)}</div> : <div className="dash-empty"><span>✂</span><h3>{labels.noApplications}</h3></div>}</section>}
      {isAdmin && tab === 'customers' && <section className="dash-panel full"><div className="dash-panel-head"><div><h2>{labels.customersTitle}</h2><p>{users.filter(user => user.role === 'customer').length} {labels.registeredCustomers.toLowerCase()}</p></div></div>{users.filter(user => user.role === 'customer').length ? <div className="dash-customer-list">{users.filter(user => user.role === 'customer').map(user => <article key={user.email}><span className="dash-user-avatar">{(user.name || user.email).slice(0,1).toUpperCase()}</span><div><b>{user.name}</b><small>{user.email} · {user.phone || labels.empty} · {user.city || labels.empty}</small></div><span>{orders.filter(order => order.customerEmail === user.email).length} {labels.orders.toLowerCase()}</span></article>)}</div> : <div className="dash-empty"><span>♙</span><h3>{labels.noCustomers}</h3></div>}</section>}
    </section>
  </main>;
}
