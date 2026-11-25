(() => {
  const root = document.documentElement;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const language = () => root.lang === 'bn' ? 'bn' : 'en';
  const messages = {
    en: {
      missing: 'We could not find that account. Create an account first.',
      wrong: 'That password does not match this account.',
      exists: 'An account with this email already exists. Please log in.',
      accountReady: 'Account created. Opening your dashboard…',
      accountUnavailable: 'Secure browser storage is unavailable. Please use a modern browser on localhost or HTTPS.',
      passwordMismatch: 'The passwords do not match. Please check them and try again.',
      applicationSaved: 'Your application has been saved in this browser for admin review. It has not been sent to a server.',
    },
    bn: {
      missing: 'এই অ্যাকাউন্টটি পাওয়া যায়নি। আগে একটি অ্যাকাউন্ট খুলুন।',
      wrong: 'এই পাসওয়ার্ডটি অ্যাকাউন্টের সঙ্গে মিলছে না।',
      exists: 'এই ইমেইলে একটি অ্যাকাউন্ট আছে। লগ ইন করুন।',
      accountReady: 'অ্যাকাউন্ট তৈরি হয়েছে। ড্যাশবোর্ড খোলা হচ্ছে…',
      accountUnavailable: 'নিরাপদ ব্রাউজার স্টোরেজ পাওয়া যায়নি। আধুনিক ব্রাউজারে localhost বা HTTPS ব্যবহার করুন।',
      passwordMismatch: 'পাসওয়ার্ড দুটি মিলছে না। আবার যাচাই করুন।',
      applicationSaved: 'আপনার আবেদন এই ব্রাউজারে সংরক্ষিত হয়েছে এবং অ্যাডমিন পর্যালোচনা করতে পারবেন। এটি সার্ভারে পাঠানো হয়নি।',
    },
  };

  async function passwordDigest(salt, password) {
    const input = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', input);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  document.querySelector('#login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector('#login-status');
    const data = new FormData(form);
    const identity = String(data.get('identity')).trim().toLowerCase();
    const user = read('e-dorji-users', []).find(account => account.email === identity || account.phone === identity);
    if (!user) { status.textContent = messages[language()].missing; return; }
    try {
      if (await passwordDigest(user.passwordSalt, data.get('password')) !== user.passwordHash) {
        status.textContent = messages[language()].wrong;
        return;
      }
      const session = { email: user.email, name: user.name, role: user.role, phone: user.phone, city: user.city };
      write('e-dorji-session', session);
      status.textContent = messages[language()].accountReady;
      setTimeout(() => { location.href = user.role === 'tailor' ? 'become-tailor.html' : 'customer-dashboard.html'; }, 350);
    } catch {
      status.textContent = messages[language()].accountUnavailable;
    }
  });

  document.querySelector('#register-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = document.querySelector('#register-status');
    if (data.get('password') !== data.get('confirm')) {
      status.textContent = messages[language()].passwordMismatch;
      form.elements.confirm.focus();
      return;
    }
    try {
      const users = read('e-dorji-users', []);
      const email = String(data.get('email')).trim().toLowerCase();
      if (users.some(user => user.email === email)) { status.textContent = messages[language()].exists; return; }
      const passwordSalt = crypto.randomUUID();
      const user = {
        id: crypto.randomUUID(), name: String(data.get('name')).trim(), email,
        phone: String(data.get('phone')).trim(), city: String(data.get('city')).trim(),
        role: String(data.get('role') || 'customer'), passwordSalt,
        passwordHash: await passwordDigest(passwordSalt, data.get('password')),
        createdAt: new Date().toISOString(),
      };
      write('e-dorji-users', [...users, user]);
      write('e-dorji-session', { email: user.email, name: user.name, role: user.role, phone: user.phone, city: user.city });
      status.textContent = messages[language()].accountReady;
      setTimeout(() => { location.href = user.role === 'tailor' ? 'become-tailor.html' : 'customer-dashboard.html'; }, 350);
    } catch {
      status.textContent = messages[language()].accountUnavailable;
    }
  });

  document.querySelector('#admin-demo-link')?.addEventListener('click', event => {
    event.preventDefault();
    write('e-dorji-session', { email: 'admin-demo@e-dorji.local', name: 'E-Dorji Admin', role: 'admin' });
    location.href = 'admin-dashboard.html';
  });

  const applicationForm = document.querySelector('#tailor-application-form');
  if (applicationForm) {
    const session = read('e-dorji-session', null);
    if (session?.role === 'tailor') {
      for (const field of ['name', 'email', 'phone', 'city']) {
        if (session[field]) applicationForm.elements[field].value = session[field];
      }
    }
    applicationForm.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(applicationForm);
      const applications = read('e-dorji-applications', []);
      const submission = Object.fromEntries(data.entries());
      submission.id = crypto.randomUUID();
      submission.status = 'pending';
      submission.createdAt = new Date().toISOString();
      write('e-dorji-applications', [submission, ...applications]);
      document.querySelector('#application-status').textContent = messages[language()].applicationSaved;
      applicationForm.reset();
      if (session?.role === 'tailor') {
        for (const field of ['name', 'email', 'phone', 'city']) if (session[field]) applicationForm.elements[field].value = session[field];
      }
    });
  }
})();
