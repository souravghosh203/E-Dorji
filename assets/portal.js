(() => {
  const root = document.documentElement;
  const lang = document.querySelector('#portal-lang');
  const theme = document.querySelector('#portal-theme');

  lang?.addEventListener('click', () => {
    const next = root.lang === 'bn' ? 'en' : 'bn';
    root.lang = next;
    lang.textContent = next === 'en' ? 'বাংলা' : 'English';
  });
  theme?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    theme.textContent = root.dataset.theme === 'dark' ? '☼' : '☾';
  });

  document.querySelector('#login-form')?.addEventListener('submit', event => {
    event.preventDefault();
    document.querySelector('#login-status').textContent = document.documentElement.lang === 'bn'
      ? 'এই প্রিভিউ এখনো অ্যাকাউন্ট সেবার সঙ্গে যুক্ত নয়।'
      : 'This preview is not connected to an account service yet.';
  });
  document.querySelector('#register-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = document.querySelector('#register-status');
    if (data.get('password') !== data.get('confirm')) {
      status.textContent = document.documentElement.lang === 'bn'
        ? 'পাসওয়ার্ড দুটি মিলছে না। আবার যাচাই করুন।'
        : 'The passwords do not match. Please check them and try again.';
      form.elements.confirm.focus();
      return;
    }
    status.textContent = document.documentElement.lang === 'bn'
      ? 'তথ্যগুলো প্রস্তুত। নিবন্ধন সম্পূর্ণ করতে অ্যাকাউন্ট সেবা যুক্ত করতে হবে।'
      : 'Your details are ready. Connect an account service to finish registration.';
  });
})();
