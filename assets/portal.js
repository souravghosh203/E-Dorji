(() => {
  const root = document.documentElement;
  const request = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  };
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
      resetMissing: 'We could not find a customer or tailor account for that email or phone in this browser.',
      resetAdmin: 'Use the Admin demo account on the login page to open the demo workspace.',
      resetCodeSent: 'Demo verification code created. Enter the code shown below. It expires in 10 minutes.',
      resetCodeLabel: 'Demo verification code: ',
      resetCodeWrong: 'That verification code is not valid.',
      resetCodeExpired: 'This code has expired. Request a new one.',
      resetPasswordMismatch: 'The new passwords do not match.',
      resetPasswordDone: 'Your password was updated in this browser. You can now log in.',
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

  Object.assign(messages.bn, {
    resetMissing: 'এই ব্রাউজারে এই ইমেইল বা ফোন নম্বরের কোনো গ্রাহক বা দর্জি অ্যাকাউন্ট পাওয়া যায়নি।',
    resetAdmin: 'ডেমো ওয়ার্কস্পেস খুলতে লগইন পৃষ্ঠার অ্যাডমিন ডেমো অ্যাকাউন্ট ব্যবহার করুন।',
    resetCodeSent: 'ডেমো যাচাইকরণ কোড তৈরি হয়েছে। নিচের কোডটি লিখুন। ১০ মিনিট পর কোডটির মেয়াদ শেষ হবে।',
    resetCodeLabel: 'ডেমো যাচাইকরণ কোড: ',
    resetCodeWrong: 'যাচাইকরণ কোডটি সঠিক নয়।',
    resetCodeExpired: 'কোডটির মেয়াদ শেষ হয়েছে। নতুন কোড নিন।',
    resetPasswordMismatch: 'নতুন পাসওয়ার্ড দুটি মিলছে না।',
    resetPasswordDone: 'এই ব্রাউজারে আপনার পাসওয়ার্ড হালনাগাদ হয়েছে। এখন লগ ইন করতে পারবেন।',
  });

  const routeAfterLogin = user => {
    if (user.permissions?.includes('ADMIN')) location.href = 'admin-dashboard.html';
    else if (new URLSearchParams(location.search).get('next') === 'become-tailor.html') location.href = 'become-tailor.html';
    else if (user.permissions?.includes('TAILOR')) location.href = 'customer-dashboard.html?mode=customer';
    else location.href = 'customer-dashboard.html';
  };

  document.querySelector('#login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector('#login-status');
    try {
      const data = new FormData(form);
      const { user } = await request('/api/login', { method: 'POST', body: JSON.stringify({ email: data.get('identity'), password: data.get('password') }) });
      status.textContent = messages[language()].accountReady;
      setTimeout(() => routeAfterLogin(user), 250);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  document.querySelector('#admin-login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), status = document.querySelector('#admin-login-status');
    try {
      await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
      location.href = 'admin-dashboard.html';
    } catch (error) { status.textContent = error.message; }
  });

  document.querySelector('#password-reset-request')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const status = document.querySelector('#reset-request-status');
    try {
      const result = await request('/api/password-reset/request', { method: 'POST', body: JSON.stringify({ identity: data.get('identity') }) });
      const step = document.querySelector('#reset-next-step'), codeNotice = document.querySelector('#demo-reset-code');
      if (result.demoCode || result.delivery === 'email') {
        step.hidden = false;
        if (result.demoCode) { codeNotice.hidden = false; codeNotice.textContent = `${messages[language()].resetCodeLabel}${result.demoCode}`; }
        status.textContent = result.demoCode ? messages[language()].resetCodeSent : 'If the account exists, recovery instructions have been sent.';
        event.currentTarget.elements.identity.readOnly = true;
      } else {
        status.textContent = 'If the account exists, recovery instructions have been sent.';
      }
    } catch (error) { status.textContent = error.message; }
  });

  document.querySelector('#password-reset-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = document.querySelector('#reset-status');
    if (data.get('password') !== data.get('confirm')) {
      status.textContent = messages[language()].resetPasswordMismatch;
      form.elements.confirm.focus();
      return;
    }
    try {
      const identity = document.querySelector('#password-reset-request').elements.identity.value;
      await request('/api/password-reset/complete', { method: 'POST', body: JSON.stringify({ identity, code: data.get('code'), password: data.get('password') }) });
      form.querySelectorAll('label,button').forEach(element => { element.hidden = true; });
      document.querySelector('#demo-reset-code').hidden = true;
      status.textContent = messages[language()].resetPasswordDone;
    } catch (error) {
      status.textContent = error.message;
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
      const userData = Object.fromEntries(data.entries());
      const { user } = await request('/api/register', { method: 'POST', body: JSON.stringify(userData) });
      status.textContent = messages[language()].accountReady;
      setTimeout(() => routeAfterLogin(user), 250);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  document.querySelector('#demo-admin-link')?.addEventListener('click', async () => {
    try {
      await request('/api/demo/admin', { method: 'POST', body: '{}' });
      location.href = 'admin-dashboard.html';
    } catch (error) { document.querySelector('#login-status').textContent = error.message; }
  });

  document.querySelector('#demo-customer-link')?.addEventListener('click', async () => {
    try {
      const { user } = await request('/api/demo/customer', { method: 'POST', body: '{}' });
      routeAfterLogin(user);
    } catch (error) { document.querySelector('#login-status').textContent = error.message; }
  });
  document.querySelector('#demo-customer-two-link')?.addEventListener('click', async () => {
    try {
      const { user } = await request('/api/demo/customer?account=rafiq', { method: 'POST', body: '{}' });
      routeAfterLogin(user);
    } catch (error) { document.querySelector('#login-status').textContent = error.message; }
  });

  const applicationForm = document.querySelector('#tailor-application-form');
  if (applicationForm) {
    request('/api/session').then(({ user }) => {
      if (!user) { location.href = 'login.html?next=become-tailor.html'; return; }
      for (const [field, value] of Object.entries({ name: user.name, email: user.email, phone: user.phone, city: user.city })) {
        const input = applicationForm.elements[field];
        if (input && value) { input.value = value; input.readOnly = true; }
      }
    }).catch(() => { location.href = 'login.html?next=become-tailor.html'; });
    applicationForm.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(applicationForm), status = document.querySelector('#application-status');
      try {
        const specialties = data.getAll('specialties').map(item => String(item).trim()).filter(Boolean);
        await request('/api/tailor-applications', { method: 'POST', body: JSON.stringify({ experience: data.get('experience'), specialties, workshop: data.get('workshop'), portfolio: data.get('portfolio'), introduction: data.get('introduction'), consent: data.get('consent') === 'on' }) });
        status.textContent = 'Application submitted. You can track its review in your customer dashboard.';
        applicationForm.reset();
      } catch (error) { status.textContent = error.message; }
    });
  }
})();
