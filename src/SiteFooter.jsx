import React, { useEffect, useState } from 'react';
import footerCopy from './data/footer-copy.json';
import logo from '../assets/e-dorji-logo.svg';

export default function SiteFooter() {
  const [language, setLanguage] = useState(document.documentElement.lang === 'bn' ? 'bn' : 'en');
  const year = new Date().getFullYear();
  const labels = footerCopy[language];

  useEffect(() => {
    const syncLanguage = event => setLanguage(event.detail === 'bn' ? 'bn' : 'en');
    window.addEventListener('e-dorji-language', syncLanguage);
    return () => window.removeEventListener('e-dorji-language', syncLanguage);
  }, []);

  const links = [
    { heading: labels.discover, items: [[labels.explore, 'e-dorji.html#tailors'], [labels.categories, 'e-dorji.html#all'], [labels.stories, 'about.html#our-work'], [labels.how, 'e-dorji.html#how']] },
    { heading: labels.artisans, items: [[labels.join, 'become-tailor.html'], [labels.guide, 'become-tailor.html#application-title'], [labels.community, 'about.html#our-work']] },
    { heading: labels.support, items: [[labels.faqs, 'help.html#faqs'], [labels.contact, 'help.html#contact'], [labels.privacy, 'help.html#privacy'], [labels.terms, 'help.html#terms']] },
  ];

  return (
      <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <a href="e-dorji.html#top" className="footer-brand" aria-label="E-Dorji home"><img src={logo} alt="E-Dorji" /></a>
          <p className="footer-tagline">{labels.tagline}</p>
          <p className="footer-description">{labels.description}</p>
        </div>
        {links.map(column => <nav className="footer-column" key={column.heading} aria-label={column.heading}>
          <h2>{column.heading}</h2>
          {column.items.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
        </nav>)}
      </div>
      <div className="footer-bottom"><div><p>{labels.copyright.replace('{year}', year)}</p><p className="footer-promise">{labels.promise}</p></div><p>{labels.developers}</p></div>
    </footer>
  );
}
