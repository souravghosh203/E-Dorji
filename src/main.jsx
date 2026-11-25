import React from 'react';
import { createRoot } from 'react-dom/client';
import SiteNav from './SiteNav.jsx';
import siteCopy from './data/site-copy.json';
import dashboardCopy from './data/dashboard-copy.json';
import './site-nav.css';

window.siteCopy = siteCopy;
window.applySiteLanguage = language => {
  const selected = language === 'bn' ? 'bn' : 'en';
  document.documentElement.lang = selected;
  document.querySelectorAll('[data-copy]').forEach(element => {
    const value = siteCopy[selected][element.dataset.copy];
    if (value) element.textContent = value;
  });
  document.querySelectorAll('[data-placeholder]').forEach(element => {
    const value = siteCopy[selected][element.dataset.placeholder];
    if (value) element.placeholder = value;
  });
  const reverseDashboardCopy = Object.fromEntries(Object.entries(dashboardCopy).map(([english, bangla]) => [bangla, english]));
  const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (textNodes.nextNode()) {
    const node = textNodes.currentNode;
    const current = node.nodeValue;
    const trimmed = current.trim();
    const replacement = selected === 'bn' ? dashboardCopy[trimmed] : reverseDashboardCopy[trimmed];
    if (replacement) node.nodeValue = current.replace(trimmed, replacement);
  }
  document.querySelectorAll('[placeholder], [aria-label], [title]').forEach(element => {
    ['placeholder', 'aria-label', 'title'].forEach(attribute => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const replacement = selected === 'bn' ? dashboardCopy[current] : Object.entries(dashboardCopy).find(([, bangla]) => bangla === current)?.[0];
      if (replacement) element.setAttribute(attribute, replacement);
    });
  });
  window.setLegacyLanguage?.(selected);
  window.dispatchEvent(new CustomEvent('e-dorji-language', { detail: selected }));
  try { localStorage.setItem('e-dorji-language', selected); } catch {}
};

const mount = document.getElementById('site-nav-root');
if (mount) createRoot(mount).render(<SiteNav page={mount.dataset.page || 'home'} />);
