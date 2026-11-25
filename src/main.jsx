import React from 'react';
import { createRoot } from 'react-dom/client';
import SiteNav from './SiteNav.jsx';
import './site-nav.css';

const mount = document.getElementById('site-nav-root');
if (mount) createRoot(mount).render(<SiteNav page={mount.dataset.page || 'home'} />);
