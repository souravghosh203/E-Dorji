import { createServer } from 'node:http';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';

const scrypt = promisify(scryptCallback);
const root = process.cwd();
const envFile = resolve(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
  }
}
const dataDir = resolve(root, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.E_DORJI_DB_PATH ? resolve(process.env.E_DORJI_DB_PATH) : resolve(dataDir, 'e-dorji.sqlite'));
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
    salt TEXT NOT NULL, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, is_demo INTEGER NOT NULL DEFAULT 0,
    tailor_suspended INTEGER NOT NULL DEFAULT 0, avatar_type TEXT NOT NULL DEFAULT '', avatar_data BLOB,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tailor_applications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experience INTEGER NOT NULL, specialties TEXT NOT NULL, workshop TEXT NOT NULL,
    portfolio TEXT NOT NULL DEFAULT '', introduction TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','NEEDS_INFORMATION')),
    review_message TEXT NOT NULL DEFAULT '', internal_note TEXT NOT NULL DEFAULT '',
    submitted_at TEXT NOT NULL, reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS tailor_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL DEFAULT '', biography TEXT NOT NULL DEFAULT '',
    services TEXT NOT NULL DEFAULT '[]', portfolio TEXT NOT NULL DEFAULT '[]', availability TEXT NOT NULL DEFAULT 'available',
    public INTEGER NOT NULL DEFAULT 0, verification TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tailor_name TEXT NOT NULL, garment TEXT NOT NULL, budget INTEGER NOT NULL DEFAULT 0,
    needed_by TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', design TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'New request', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id,created_at);
  CREATE TABLE IF NOT EXISTS saved_tailors (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, tailor_name TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY(user_id,tailor_name)
  );
  CREATE TABLE IF NOT EXISTS measurements (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    values_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences_json TEXT NOT NULL DEFAULT '{"inApp":true,"email":false,"sms":false}',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    email TEXT PRIMARY KEY COLLATE NOCASE, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL,
    subject_id TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS featured_work (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS featured_images (
    item_id TEXT PRIMARY KEY REFERENCES featured_work(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, data BLOB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ready_made_products (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
    price INTEGER NOT NULL, time TEXT NOT NULL, image_type TEXT NOT NULL, image_data BLOB NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ready_made_owner_idx ON ready_made_products(user_id,created_at DESC);
  CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS session_expiry_idx ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS application_status_idx ON tailor_applications(status);
`);
try { db.exec('ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar_type TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN avatar_data BLOB'); } catch {}
try { db.exec("ALTER TABLE tailor_profiles ADD COLUMN portfolio TEXT NOT NULL DEFAULT '[]'"); } catch {}

if (!db.prepare("SELECT value FROM app_settings WHERE key='featured_work_seeded'").get()) {
  const seedProfiles = JSON.parse(readFileSync(resolve(root, 'src/data/artisan-showcase.json'), 'utf8'));
  const insertSeed = db.prepare('INSERT OR IGNORE INTO featured_work (id,payload,created_at) VALUES (?,?,?)');
  for (const profile of seedProfiles) {
    const { crafts, ...tailor } = profile;
    for (const craft of crafts) insertSeed.run(`seed-${tailor.slug}-${craft.id}`, JSON.stringify({ tailor, craft }), new Date().toISOString());
  }
  db.prepare("INSERT INTO app_settings (key,value) VALUES ('featured_work_seeded','1')").run();
}
if (!db.prepare("SELECT value FROM app_settings WHERE key='featured_work_photos_added'").get()) {
  const profilesWithPhotos = JSON.parse(readFileSync(resolve(root, 'src/data/artisan-showcase.json'), 'utf8'));
  for (const profile of profilesWithPhotos) for (const craft of profile.crafts) {
    const seedId = `seed-${profile.slug}-${craft.id}`;
    const row = db.prepare('SELECT payload FROM featured_work WHERE id=?').get(seedId);
    if (!row) continue;
    const payload = JSON.parse(row.payload);
    payload.craft.imageUrl ||= craft.imageUrl;
    payload.craft.imageCredit ||= craft.imageCredit;
    db.prepare('UPDATE featured_work SET payload=? WHERE id=?').run(JSON.stringify(payload), seedId);
  }
  db.prepare("INSERT INTO app_settings (key,value) VALUES ('featured_work_photos_added','1')").run();
}
if (!db.prepare("SELECT value FROM app_settings WHERE key='featured_work_customer_photos_added'").get()) {
  const profiles = JSON.parse(readFileSync(resolve(root, 'src/data/artisan-showcase.json'), 'utf8'));
  const profileBySlug = new Map(profiles.map(profile => [profile.slug, profile]));
  const featured = JSON.parse(readFileSync(resolve(root, 'src/data/featured-work-seed.json'), 'utf8'));
  const insertSeed = db.prepare('INSERT OR REPLACE INTO featured_work (id,payload,created_at) VALUES (?,?,?)');
  const keepIds = new Set();
  for (const { tailorSlug, craft } of featured) {
    const profile = profileBySlug.get(tailorSlug);
    if (!profile) continue;
    const { crafts, ...tailor } = profile;
    const id = `seed-${tailorSlug}-${craft.id}`;
    keepIds.add(id);
    insertSeed.run(id, JSON.stringify({ tailor, craft }), new Date().toISOString());
  }
  const oldSeeds = db.prepare("SELECT id FROM featured_work WHERE id LIKE 'seed-%'").all();
  const removeSeed = db.prepare('DELETE FROM featured_work WHERE id=?');
  for (const row of oldSeeds) if (!keepIds.has(row.id)) removeSeed.run(row.id);
  db.prepare("INSERT INTO app_settings (key,value) VALUES ('featured_work_customer_photos_added','1')").run();
}

const nowIso = () => new Date().toISOString();
const hashToken = token => createHash('sha256').update(token).digest('hex');
const send = (res, status, payload, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
};
function cookie(req, name) {
  const item = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}
function setSessionCookie(res, token, maxAge) {
  res.setHeader('set-cookie', `ed_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
function clearSessionCookie(res) { res.setHeader('set-cookie', 'ed_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); }
async function body(req, maxBytes = 32768) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBytes) throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function publicUser(row) {
  if (!row) return null;
  const application = db.prepare('SELECT status FROM tailor_applications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1').get(row.id);
  const approvedTailor = application?.status === 'APPROVED' && !row.tailor_suspended;
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone, city: row.city,
    address: row.address, avatarUrl: row.avatar_type ? `/api/avatar/${encodeURIComponent(row.id)}` : '', permissions: row.is_admin ? ['ADMIN'] : approvedTailor ? ['CUSTOMER', 'TAILOR'] : ['CUSTOMER'],
    accountType: row.is_admin ? 'ADMIN' : approvedTailor ? 'CUSTOMER + TAILOR' : 'CUSTOMER',
    tailorSuspended: Boolean(row.tailor_suspended), applicationStatus: application?.status || 'NOT_APPLIED',
  };
}
function currentUser(req) {
  const token = cookie(req, 'ed_session');
  if (!token) return null;
  const session = db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token), Date.now());
  return session ? db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id) : null;
}
function requireUser(req, res, admin = false) {
  const user = currentUser(req);
  if (!user) { send(res, 401, { error: 'Please log in to continue.' }); return null; }
  if (admin && !user.is_admin) { send(res, 403, { error: 'Admin access required.' }); return null; }
  return user;
}
async function passwordHash(password, salt) { return (await scrypt(password, salt, 64)).toString('hex'); }
async function createAccount({ name, email, phone, city, address = '', password, isAdmin = false, isDemo = false }) {
  const salt = randomBytes(16).toString('hex');
  const digest = await passwordHash(password, salt);
  const id = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users (id,name,email,phone,city,address,salt,password_hash,is_admin,is_demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, name, email, phone, city, address, salt, digest, isAdmin ? 1 : 0, isDemo ? 1 : 0, nowIso());
  return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}
async function issueSession(user, res) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(hashToken(token), user.id, expires, nowIso());
  setSessionCookie(res, token, 7 * 24 * 60 * 60);
  return publicUser(user);
}
function notify(userId, kind, message) {
  const preferences = db.prepare('SELECT preferences_json FROM notification_preferences WHERE user_id=?').get(userId);
  if (preferences && JSON.parse(preferences.preferences_json).inApp === false) return;
  db.prepare('INSERT INTO notifications (id,user_id,kind,message,created_at) VALUES (?,?,?,?,?)')
    .run(randomBytes(12).toString('hex'), userId, kind, message, nowIso());
}
const audit = (actor, action, subject) => db.prepare('INSERT INTO audit_logs (id,actor_id,action,subject_id,created_at) VALUES (?,?,?,?,?)').run(randomBytes(12).toString('hex'), actor?.id || null, action, subject || null, nowIso());

let adminPassword = process.env.E_DORJI_ADMIN_PASSWORD;
let generatedAdminPassword = false;
if (!adminPassword && !production) {
  adminPassword = randomBytes(24).toString('base64url');
  process.env.E_DORJI_ADMIN_PASSWORD = adminPassword;
  generatedAdminPassword = true;
}
process.env.E_DORJI_ADMIN_EMAIL ||= production ? '' : 'amrito.ghosh.admin@e-dorji.local';
process.env.E_DORJI_ADMIN_NAME ||= production ? 'E-Dorji Admin' : 'Amrito Ghosh';
const adminEmail = process.env.E_DORJI_ADMIN_EMAIL.trim().toLowerCase();
if (generatedAdminPassword && !production) {
  const { appendFile } = await import('node:fs/promises');
  const existingEnv = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  const additions = [
    !/^\s*E_DORJI_ADMIN_EMAIL\s*=/m.test(existingEnv) ? `E_DORJI_ADMIN_EMAIL=${adminEmail}` : '',
    !/^\s*E_DORJI_ADMIN_NAME\s*=/m.test(existingEnv) ? `E_DORJI_ADMIN_NAME=${process.env.E_DORJI_ADMIN_NAME}` : '',
    !/^\s*E_DORJI_ADMIN_PASSWORD\s*=/m.test(existingEnv) ? `E_DORJI_ADMIN_PASSWORD=${adminPassword}` : '',
    !/^\s*PORT\s*=/m.test(existingEnv) ? `PORT=${process.env.PORT || 5173}` : '',
  ].filter(Boolean).join('\n');
  if (additions) await appendFile(envFile, `${existingEnv.endsWith('\n') || !existingEnv ? '' : '\n'}${additions}\n`, { mode: 0o600 }).catch(() => {});
}
let generatedAdmin = false;
if (adminPassword) {
  const existing = db.prepare('SELECT id,is_admin FROM users WHERE email=?').get(adminEmail);
  if (!existing) {
    await createAccount({ name: process.env.E_DORJI_ADMIN_NAME, email: adminEmail, phone: '', city: '', password: adminPassword, isAdmin: true });
    generatedAdmin = generatedAdminPassword;
  } else if (existing.is_admin && process.env.E_DORJI_ADMIN_PASSWORD) {
    const adminRow = db.prepare('SELECT * FROM users WHERE id=?').get(existing.id);
    const candidate = await passwordHash(adminPassword, adminRow.salt);
    if (!timingSafeEqual(Buffer.from(candidate), Buffer.from(adminRow.password_hash))) {
      const salt = randomBytes(16).toString('hex');
      db.prepare('UPDATE users SET salt=?,password_hash=? WHERE id=?').run(salt, await passwordHash(adminPassword, salt), existing.id);
    }
  }
}

async function api(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method || 'GET';
  if (['/api/register', '/api/login', '/api/admin/login', '/api/password-reset/request', '/api/password-reset/complete'].includes(path)) {
    const bucket = `${req.socket.remoteAddress}:${path}`;
    const current = loginLimits.get(bucket) || { count: 0, until: Date.now() + 15 * 60 * 1000 };
    if (current.until < Date.now()) { current.count = 0; current.until = Date.now() + 15 * 60 * 1000; }
    current.count += 1; loginLimits.set(bucket, current);
    if (current.count > 12) return send(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
  }
  try {
    if (path === '/api/health' && method === 'GET') return send(res, 200, { ok: true });
    if (path === '/api/register' && method === 'POST') {
      const data = await body(req);
      const name = String(data.name || '').trim();
      const email = String(data.email || '').trim().toLowerCase();
      const phone = String(data.phone || '').trim();
      const city = String(data.city || '').trim();
      const password = String(data.password || '');
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7 || city.length < 2 || password.length < 10) return send(res, 400, { error: 'Enter valid account details and a password of at least 10 characters.' });
      if ([adminEmail, 'sourav.ghosh.demo@e-dorji.local', 'rafiq.islam.demo@e-dorji.local'].includes(email)) return send(res, 400, { error: 'That email address is reserved for a system account.' });
      if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return send(res, 409, { error: 'An account with this email already exists.' });
      const user = await createAccount({ name, email, phone, city, address: String(data.address || '').trim(), password });
      audit(user, 'customer.registered', user.id);
      notify(user.id, 'registration', 'Your E-Dorji customer account is ready.');
      return send(res, 201, { user: await issueSession(user, res) });
    }
    if (path === '/api/demo/customer' && method === 'POST' && !production) {
      const secondDemo = url.searchParams.get('account') === 'rafiq';
      const demoAccount = secondDemo
        ? { name: 'Rafiq Islam', email: 'rafiq.islam.demo@e-dorji.local', phone: '+880 1700-000003', orderId: 'demo-order-rafiq' }
        : { name: 'Sourav Ghosh', email: 'sourav.ghosh.demo@e-dorji.local', phone: '+880 1700-000001', orderId: 'demo-order-sourav' };
      let user = db.prepare('SELECT * FROM users WHERE email=?').get(demoAccount.email);
      if (user && !user.is_demo) return send(res, 409, { error: 'The customer demo account is unavailable.' });
      if (!user) user = await createAccount({ name: demoAccount.name, email: demoAccount.email, phone: demoAccount.phone, city: 'Dhaka', password: randomBytes(24).toString('base64url'), isDemo: true });
      if (!db.prepare('SELECT id FROM orders WHERE customer_id=?').get(user.id)) {
        const time = nowIso();
        db.prepare('INSERT INTO orders (id,customer_id,tailor_name,garment,budget,needed_by,notes,design,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(demoAccount.orderId, user.id, 'Kamal Hossain', 'Panjabi', 6500, '', 'Deep maroon Panjabi with a band collar and subtle gold buttons.', '{}', 'Production started', time, time);
        db.prepare('INSERT INTO saved_tailors (user_id,tailor_name,created_at) VALUES (?,?,?)').run(user.id, 'Nusrat Jahan Chowdhury', time);
        db.prepare('INSERT INTO saved_tailors (user_id,tailor_name,created_at) VALUES (?,?,?)').run(user.id, 'Kamal Hossain', time);
      }
      return send(res, 200, { user: await issueSession(user, res) });
    }
    if (path === '/api/demo/admin' && method === 'POST' && !production) {
      const admin = db.prepare('SELECT * FROM users WHERE email=? AND is_admin=1').get(adminEmail);
      if (!admin) return send(res, 503, { error: 'The local admin demo is not provisioned.' });
      audit(admin, 'demo.admin_access', admin.id);
      return send(res, 200, { user: await issueSession(admin, res) });
    }
    if ((path === '/api/login' || path === '/api/admin/login') && method === 'POST') {
      const data = await body(req);
      const identity = String(data.email || '').trim().toLowerCase();
      const user = db.prepare('SELECT * FROM users WHERE email=? OR lower(phone)=?').get(identity, identity);
      const validRole = user && (path === '/api/admin/login' ? Boolean(user.is_admin) : !user.is_admin);
      const candidate = user ? await passwordHash(String(data.password || ''), user.salt) : await passwordHash(String(data.password || ''), randomBytes(16).toString('hex'));
      if (!validRole || !timingSafeEqual(Buffer.from(candidate), Buffer.from(user?.password_hash || candidate.replace(/./g, '0')))) return send(res, 401, { error: 'Email or password is incorrect.' });
      audit(user, 'login', user.id);
      return send(res, 200, { user: await issueSession(user, res) });
    }
    if (path === '/api/password-reset/request' && method === 'POST') {
      const data = await body(req), identity = String(data.identity || '').trim().toLowerCase();
      const user = db.prepare('SELECT * FROM users WHERE (email=? OR lower(phone)=?) AND is_admin=0').get(identity, identity);
      if (!user) return send(res, 202, { ok: true, delivery: false });
      const code = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
      const codeHash = hashToken(code);
      db.prepare('INSERT INTO password_resets (email,code_hash,expires_at,attempts) VALUES (?,?,?,0) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0').run(user.email, codeHash, Date.now() + 10 * 60 * 1000);
      if (process.env.E_DORJI_MAILER_URL && process.env.E_DORJI_MAILER_TOKEN) {
        const delivery = await fetch(process.env.E_DORJI_MAILER_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.E_DORJI_MAILER_TOKEN}` }, body: JSON.stringify({ to: user.email, template: 'password-reset', code, expiresInMinutes: 10 }) });
        if (!delivery.ok) return send(res, 503, { error: 'Password reset delivery is temporarily unavailable.' });
        return send(res, 202, { ok: true, delivery: 'email' });
      }
      if (!production) return send(res, 200, { ok: true, demoCode: code });
      db.prepare('DELETE FROM password_resets WHERE email=?').run(user.email);
      return send(res, 503, { error: 'Password recovery delivery is not configured.' });
    }
    if (path === '/api/password-reset/complete' && method === 'POST') {
      const data = await body(req), identity = String(data.identity || '').trim().toLowerCase(), code = String(data.code || '').trim(), password = String(data.password || '');
      if (password.length < 10) return send(res, 400, { error: 'Choose a password of at least 10 characters.' });
      const user = db.prepare('SELECT * FROM users WHERE (email=? OR lower(phone)=?) AND is_admin=0').get(identity, identity);
      const reset = user && db.prepare('SELECT * FROM password_resets WHERE email=?').get(user.email);
      if (!reset || reset.expires_at < Date.now() || reset.attempts >= 5 || hashToken(code) !== reset.code_hash) {
        if (reset && reset.attempts < 5) db.prepare('UPDATE password_resets SET attempts=attempts+1 WHERE email=?').run(reset.email);
        return send(res, 400, { error: 'That code is invalid or expired. Request a new code and try again.' });
      }
      const salt = randomBytes(16).toString('hex'), digest = await passwordHash(password, salt);
      db.prepare('UPDATE users SET salt=?,password_hash=? WHERE id=?').run(salt, digest, user.id);
      db.prepare('DELETE FROM password_resets WHERE email=?').run(user.email);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      notify(user.id, 'password_reset', 'Your password was changed. Please log in with your new password.');
      audit(user, 'password.reset', user.id);
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/logout' && method === 'POST') {
      const token = cookie(req, 'ed_session');
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/session' && method === 'GET') {
      const user = currentUser(req);
      return user ? send(res, 200, { user: publicUser(user) }) : send(res, 200, { user: null });
    }
    const avatarMatch = path.match(/^\/api\/avatar\/([a-f\d]+)$/i);
    if (avatarMatch && method === 'GET') {
      const viewer = requireUser(req, res); if (!viewer) return;
      if (viewer.id !== avatarMatch[1]) return send(res, 403, { error: 'You can only view your own account photo.' });
      const profile = db.prepare('SELECT avatar_type,avatar_data FROM users WHERE id=?').get(avatarMatch[1]);
      if (!profile?.avatar_data || !profile.avatar_type) return send(res, 404, { error: 'Profile photo not found.' });
      res.writeHead(200, { 'content-type': profile.avatar_type, 'cache-control': 'private, no-cache, must-revalidate', 'x-content-type-options': 'nosniff' });
      return res.end(profile.avatar_data);
    }
    if (path === '/api/public-tailors' && method === 'GET') {
      const rows = db.prepare(`SELECT u.name,u.city,p.shop_name,p.biography,p.services,p.portfolio,p.availability
        FROM users u JOIN tailor_profiles p ON p.user_id=u.id
        WHERE u.is_admin=0 AND u.tailor_suspended=0 AND p.public=1 AND p.verification='verified'
        AND EXISTS (SELECT 1 FROM tailor_applications a WHERE a.user_id=u.id AND a.status='APPROVED')
        ORDER BY u.name COLLATE NOCASE`).all();
      return send(res, 200, { tailors: rows.map(row => ({ name: row.name, slug: row.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), city: row.city, shopName: row.shop_name, biography: row.biography, services: JSON.parse(row.services), portfolio: JSON.parse(row.portfolio), availability: row.availability, verified: true })) });
    }
    const readyImageMatch = path.match(/^\/api\/ready-made\/([a-f\d]{24})\/image$/i);
    if (readyImageMatch && method === 'GET') {
      const image = db.prepare('SELECT image_type,image_data FROM ready_made_products WHERE id=?').get(readyImageMatch[1]);
      if (!image) return send(res, 404, { error: 'Product photo not found.' });
      res.writeHead(200, { 'content-type': image.image_type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
      return res.end(image.image_data);
    }
    if (path === '/api/ready-made' && method === 'GET') {
      const rows = db.prepare(`SELECT r.*,u.name AS tailor_name,u.city,p.shop_name,u.id AS tailor_id
        FROM ready_made_products r JOIN users u ON u.id=r.user_id
        JOIN tailor_profiles p ON p.user_id=u.id
        WHERE u.is_admin=0 AND u.tailor_suspended=0 AND p.public=1 AND p.verification='verified'
        AND EXISTS (SELECT 1 FROM tailor_applications a WHERE a.user_id=u.id AND a.status='APPROVED')
        ORDER BY r.created_at DESC`).all();
      return send(res, 200, { items: rows.map(readyMadeJson) });
    }
    if (path === '/api/tailor/ready-made' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      if (!publicUser(user).permissions.includes('TAILOR')) return send(res, 403, { error: 'Only approved tailors can manage ready-made items.' });
      const rows = db.prepare('SELECT r.*,u.name AS tailor_name,u.city,p.shop_name,u.id AS tailor_id FROM ready_made_products r JOIN users u ON u.id=r.user_id LEFT JOIN tailor_profiles p ON p.user_id=u.id WHERE r.user_id=? ORDER BY r.created_at DESC').all(user.id);
      return send(res, 200, { items: rows.map(readyMadeJson) });
    }
    if (path === '/api/tailor/ready-made' && method === 'POST') {
      const user = requireUser(req, res); if (!user) return;
      if (!publicUser(user).permissions.includes('TAILOR')) return send(res, 403, { error: 'Only approved tailors can manage ready-made items.' });
      const data = await body(req, 4_250_000);
      const title = String(data.title || '').trim().slice(0, 120), description = String(data.description || '').trim().slice(0, 1000);
      const category = String(data.category || '').trim(), time = String(data.time || '').trim().slice(0, 80), price = Math.floor(Number(data.price));
      const categories = ['Borka','Saree','Lungi','Panjabi','Girls’ dress','Other'];
      if (title.length < 2 || !categories.includes(category) || description.length < 12 || !time || !Number.isSafeInteger(price) || price < 1 || price > 10000000) return send(res, 400, { error: 'Enter the item name, category, description, price, and ready or making time.' });
      const imageMatch = String(data.imageData || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!imageMatch) return send(res, 400, { error: 'Upload a product photo in JPG, PNG, or WebP format.' });
      const imageBytes = Buffer.from(imageMatch[2], 'base64');
      const imageType = imageMatch[1] === 'jpeg' ? 'image/jpeg' : `image/${imageMatch[1]}`;
      const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
      const isPng = imageBytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
      const isWebp = imageBytes.toString('ascii', 0, 4) === 'RIFF' && imageBytes.toString('ascii', 8, 12) === 'WEBP';
      if (!imageBytes.length || imageBytes.length > 3 * 1024 * 1024 || !(imageType === 'image/jpeg' ? isJpeg : imageType === 'image/png' ? isPng : isWebp)) return send(res, 400, { error: 'Use a valid product image smaller than 3 MB.' });
      const profile = db.prepare('SELECT public FROM tailor_profiles WHERE user_id=?').get(user.id);
      if (!profile) return send(res, 409, { error: 'Save your tailor profile before publishing products.' });
      const id = randomBytes(12).toString('hex'), timeNow = nowIso();
      db.prepare('INSERT INTO ready_made_products (id,user_id,title,category,description,price,time,image_type,image_data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(id,user.id,title,category,description,price,time,imageType,imageBytes,timeNow,timeNow);
      audit(user, 'ready_made.created', id);
      const row = db.prepare('SELECT r.*,u.name AS tailor_name,u.city,p.shop_name,u.id AS tailor_id FROM ready_made_products r JOIN users u ON u.id=r.user_id LEFT JOIN tailor_profiles p ON p.user_id=u.id WHERE r.id=?').get(id);
      return send(res, 201, { item: readyMadeJson(row) });
    }
    const readyMadeMatch = path.match(/^\/api\/tailor\/ready-made\/([a-f\d]{24})$/i);
    if (readyMadeMatch && method === 'DELETE') {
      const user = requireUser(req, res); if (!user) return;
      if (!publicUser(user).permissions.includes('TAILOR')) return send(res, 403, { error: 'Only approved tailors can manage ready-made items.' });
      const result = db.prepare('DELETE FROM ready_made_products WHERE id=? AND user_id=?').run(readyMadeMatch[1], user.id);
      if (!result.changes) return send(res, 404, { error: 'Ready-made item not found in your listings.' });
      audit(user, 'ready_made.deleted', readyMadeMatch[1]);
      return send(res, 200, { ok: true });
    }
    const featuredImageMatch = path.match(/^\/api\/featured-work\/([a-z\d-]+)\/image$/i);
    if (featuredImageMatch && method === 'GET') {
      const image = db.prepare('SELECT content_type,data FROM featured_images WHERE item_id=?').get(featuredImageMatch[1]);
      if (!image) return send(res, 404, { error: 'Featured photo not found.' });
      res.writeHead(200, { 'content-type': image.content_type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
      return res.end(image.data);
    }
    if (path === '/api/featured-work' && method === 'GET') {
      const items = db.prepare('SELECT f.*,i.content_type AS image_type FROM featured_work f LEFT JOIN featured_images i ON i.item_id=f.id ORDER BY f.created_at,f.id').all().map(featuredWorkJson);
      return send(res, 200, { items });
    }
    if (path === '/api/admin/featured-work' && method === 'GET') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const items = db.prepare('SELECT f.*,i.content_type AS image_type FROM featured_work f LEFT JOIN featured_images i ON i.item_id=f.id ORDER BY f.created_at,f.id').all().map(featuredWorkJson);
      return send(res, 200, { items });
    }
    if (path === '/api/admin/featured-work' && method === 'POST') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const data = await body(req, 4_250_000);
      const name = String(data.tailorName || '').trim().slice(0, 100), shopName = String(data.shopName || '').trim().slice(0, 100);
      const city = String(data.city || '').trim().slice(0, 100), biography = String(data.biography || '').trim().slice(0, 1200);
      const experience = String(data.experience || '').trim().slice(0, 120), hours = String(data.hours || '').trim().slice(0, 120);
      const craftName = String(data.craftName || '').trim().slice(0, 120), description = String(data.description || '').trim().slice(0, 1200);
      const days = String(data.days || '').trim().slice(0, 80), price = Math.floor(Number(data.price));
      const kinds = ['panjabi','saree','blouse','kurti','salwar','sherwani'];
      const kind = kinds.includes(data.kind) ? data.kind : 'panjabi';
      const color = /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#236653';
      const accent = /^#[0-9a-f]{6}$/i.test(data.accent) ? data.accent : '#e6c17e';
      const imageCredit = String(data.imageCredit || 'Admin supplied photo').trim().slice(0, 120);
      if (name.length < 2 || shopName.length < 2 || city.length < 2 || biography.length < 12 || !hours || craftName.length < 2 || description.length < 12 || !days || !Number.isSafeInteger(price) || price < 1 || price > 10000000) return send(res, 400, { error: 'Complete the tailor, garment, price, and working-time details.' });
      const imageMatch = String(data.imageData || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!imageMatch) return send(res, 400, { error: 'Upload a real garment photo in JPG, PNG, or WebP format.' });
      const imageBytes = Buffer.from(imageMatch[2], 'base64');
      const imageType = imageMatch[1] === 'jpeg' ? 'image/jpeg' : `image/${imageMatch[1]}`;
      const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
      const isPng = imageBytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
      const isWebp = imageBytes.toString('ascii', 0, 4) === 'RIFF' && imageBytes.toString('ascii', 8, 12) === 'WEBP';
      if (imageBytes.length > 3 * 1024 * 1024 || imageBytes.length === 0 || !(imageType === 'image/jpeg' ? isJpeg : imageType === 'image/png' ? isPng : isWebp)) return send(res, 400, { error: 'Use a valid JPG, PNG, or WebP photo smaller than 3 MB.' });
      const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
      if (!slug) return send(res, 400, { error: 'Enter a tailor name using letters or numbers.' });
      const id = randomBytes(12).toString('hex'), craft = { id, name: { en: craftName, bn: craftName }, description: { en: description, bn: description }, price, days: { en: days, bn: days }, kind, color, accent, imageUrl: `/api/featured-work/${id}/image`, imageCredit };
      const tailor = { slug, name: { en: name, bn: name }, shop: { en: shopName, bn: shopName }, city: { en: city, bn: city }, rating: 'New', experience: { en: experience || 'Featured local artisan', bn: experience || 'নির্বাচিত স্থানীয় কারিগর' }, bio: { en: biography, bn: biography }, hours: { en: hours, bn: hours } };
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO featured_work (id,payload,created_at) VALUES (?,?,?)').run(id, JSON.stringify({ tailor, craft }), nowIso());
        db.prepare('INSERT INTO featured_images (item_id,content_type,data) VALUES (?,?,?)').run(id, imageType, imageBytes);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      audit(admin, 'featured_work.created', id);
      return send(res, 201, { item: { id, tailor, craft } });
    }
    const featuredWorkMatch = path.match(/^\/api\/admin\/featured-work\/([a-z\d-]+)$/i);
    if (featuredWorkMatch && method === 'DELETE') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const result = db.prepare('DELETE FROM featured_work WHERE id=?').run(featuredWorkMatch[1]);
      if (!result.changes) return send(res, 404, { error: 'Featured work item not found.' });
      audit(admin, 'featured_work.deleted', featuredWorkMatch[1]);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/profile' && method === 'PATCH') {
      const user = requireUser(req, res); if (!user) return;
      const data = await body(req, 4_250_000);
      const name = String(data.name || '').trim(), phone = String(data.phone || '').trim(), city = String(data.city || '').trim(), address = String(data.address || '').trim();
      if (name.length < 2 || phone.length < 7 || city.length < 2) return send(res, 400, { error: 'Enter a valid name, phone number, and city.' });
      if (data.removeAvatar === true) {
        db.prepare("UPDATE users SET name=?,phone=?,city=?,address=?,avatar_type='',avatar_data=NULL WHERE id=?").run(name, phone, city, address, user.id);
      } else if (data.avatarData) {
        const imageMatch = String(data.avatarData).match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!imageMatch) return send(res, 400, { error: 'Upload a JPG, PNG, or WebP profile photo.' });
        const image = Buffer.from(imageMatch[2], 'base64'), type = imageMatch[1] === 'jpeg' ? 'image/jpeg' : `image/${imageMatch[1]}`;
        const jpegOk = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
        const pngOk = image.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
        const webpOk = image.toString('ascii',0,4) === 'RIFF' && image.toString('ascii',8,12) === 'WEBP';
        if (!image.length || image.length > 3 * 1024 * 1024 || !(type === 'image/jpeg' ? jpegOk : type === 'image/png' ? pngOk : webpOk)) return send(res, 400, { error: 'Use a valid profile photo smaller than 3 MB.' });
        db.prepare('UPDATE users SET name=?,phone=?,city=?,address=?,avatar_type=?,avatar_data=? WHERE id=?').run(name, phone, city, address, type, image, user.id);
      } else {
        db.prepare('UPDATE users SET name=?,phone=?,city=?,address=? WHERE id=?').run(name, phone, city, address, user.id);
      }
      return send(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
    }
    if (path === '/api/password' && method === 'PATCH') {
      const user = requireUser(req, res); if (!user) return;
      const data = await body(req), oldPassword = String(data.oldPassword || ''), newPassword = String(data.newPassword || '');
      if (newPassword.length < 10) return send(res, 400, { error: 'Choose a new password of at least 10 characters.' });
      const currentHash = await passwordHash(oldPassword, user.salt);
      if (!timingSafeEqual(Buffer.from(currentHash), Buffer.from(user.password_hash))) return send(res, 400, { error: 'Your current password is incorrect.' });
      const salt = randomBytes(16).toString('hex'), digest = await passwordHash(newPassword, salt);
      db.prepare('UPDATE users SET salt=?,password_hash=? WHERE id=?').run(salt, digest, user.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(hashToken(token), user.id, Date.now() + 7 * 86400000, nowIso());
      setSessionCookie(res, token, 7 * 86400);
      notify(user.id, 'password_changed', 'Your password was changed successfully.');
      audit(user, 'password.changed', user.id);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/account' && method === 'DELETE') {
      const user = requireUser(req, res); if (!user) return;
      const data = await body(req), digest = await passwordHash(String(data.password || ''), user.salt);
      if (!timingSafeEqual(Buffer.from(digest), Buffer.from(user.password_hash))) return send(res, 400, { error: 'Password confirmation did not match.' });
      audit(user, 'account.deleted', user.id);
      db.prepare('DELETE FROM users WHERE id=?').run(user.id);
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/orders' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      let rows;
      if (user.is_admin) rows = db.prepare('SELECT o.*,u.name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.customer_id ORDER BY o.created_at DESC').all();
      else if (publicUser(user).permissions.includes('TAILOR') && url.searchParams.get('mode') === 'tailor') rows = db.prepare('SELECT o.*,u.name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.customer_id WHERE lower(o.tailor_name)=lower(?) ORDER BY o.created_at DESC').all(user.name);
      else rows = db.prepare('SELECT o.*,u.name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.customer_id=? ORDER BY o.created_at DESC').all(user.id);
      return send(res, 200, { orders: rows.map(orderJson) });
    }
    if (path === '/api/orders' && method === 'POST') {
      const user = requireUser(req, res); if (!user) return;
      if (user.is_admin) return send(res, 403, { error: 'Admin accounts cannot place customer orders.' });
      const data = await body(req), tailorName = String(data.tailor || '').trim(), garment = String(data.garment || '').trim(), budget = Math.max(0, Math.min(10000000, Math.floor(Number(data.budget) || 0)));
      const neededBy = String(data.neededBy || '').slice(0, 10), notes = String(data.notes || '').trim().slice(0, 4000);
      if (tailorName.length < 2 || garment.length < 2 || (neededBy && !/^\d{4}-\d{2}-\d{2}$/.test(neededBy))) return send(res, 400, { error: 'Choose a tailor and garment, then check the requested date.' });
      const design = JSON.stringify(data.design && typeof data.design === 'object' ? data.design : {});
      const orderId = randomBytes(16).toString('hex'), time = nowIso();
      db.prepare('INSERT INTO orders (id,customer_id,tailor_name,garment,budget,needed_by,notes,design,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?,?,?)').run(orderId, user.id, tailorName, garment, budget, neededBy, notes, design, 'New request', time, time);
      const tailor = db.prepare('SELECT id FROM users WHERE lower(name)=lower(?) AND is_admin=0').get(tailorName);
      if (tailor) notify(tailor.id, 'order_request', `New ${garment} request from ${user.name}.`);
      audit(user, 'order.created', orderId);
      return send(res, 201, { order: orderJson(db.prepare('SELECT o.*,u.name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.id=?').get(orderId)) });
    }
    const orderMatch = path.match(/^\/api\/orders\/([a-f\d]+)$/i);
    if (orderMatch && method === 'PATCH') {
      const user = requireUser(req, res); if (!user) return;
      const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderMatch[1]); if (!order) return send(res, 404, { error: 'Order not found.' });
      const data = await body(req), status = String(data.status || '');
      const isOwner = order.customer_id === user.id, isAssignedTailor = !user.is_admin && publicUser(user).permissions.includes('TAILOR') && order.tailor_name.toLowerCase() === user.name.toLowerCase();
      const allowed = user.is_admin || isAssignedTailor ? ['New request','Proposal sent','Production started','Ready for fitting','Delivered','Cancelled'] : isOwner && order.status === 'New request' && status === 'Cancelled' ? ['Cancelled'] : [];
      if (!allowed.includes(status)) return send(res, 403, { error: 'You do not have permission to make that order update.' });
      db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').run(status, nowIso(), order.id);
      if (!isOwner) notify(order.customer_id, 'order_updated', `Your ${order.garment} order is now: ${status}.`);
      audit(user, 'order.status_changed', order.id);
      return send(res, 200, { order: orderJson(db.prepare('SELECT o.*,u.name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.id=?').get(order.id)) });
    }
    if (path === '/api/saved-tailors' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      return send(res, 200, { names: db.prepare('SELECT tailor_name FROM saved_tailors WHERE user_id=? ORDER BY created_at DESC').all(user.id).map(row => row.tailor_name) });
    }
    if (path === '/api/saved-tailors' && method === 'PUT') {
      const user = requireUser(req, res); if (!user) return;
      const data = await body(req), names = Array.isArray(data.names) ? [...new Set(data.names.map(name => String(name).trim()).filter(name => name.length > 1))].slice(0, 500) : [];
      const replace = db.prepare('INSERT INTO saved_tailors (user_id,tailor_name,created_at) VALUES (?,?,?)');
      db.exec('BEGIN');
      try { db.prepare('DELETE FROM saved_tailors WHERE user_id=?').run(user.id); for (const name of names) replace.run(user.id, name, nowIso()); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
      return send(res, 200, { names });
    }
    if (path === '/api/measurements' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      const row = db.prepare('SELECT values_json,updated_at FROM measurements WHERE user_id=?').get(user.id);
      return send(res, 200, { measurements: row ? JSON.parse(row.values_json) : {}, updatedAt: row?.updated_at || null });
    }
    if (path === '/api/measurements' && method === 'PUT') {
      const user = requireUser(req, res); if (!user) return;
      const data = await body(req), values = data.measurements && typeof data.measurements === 'object' ? data.measurements : {};
      const filtered = Object.fromEntries(Object.entries(values).filter(([key, value]) => /^[a-zA-Z][\w -]{0,40}$/.test(key) && (value === '' || /^\d+(?:\.\d{1,2})?$/.test(String(value)))).slice(0, 40));
      db.prepare('INSERT INTO measurements (user_id,values_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET values_json=excluded.values_json,updated_at=excluded.updated_at').run(user.id, JSON.stringify(filtered), nowIso());
      notify(user.id, 'measurements_updated', 'Your measurements were saved privately to your account.');
      return send(res, 200, { measurements: filtered });
    }
    if (path === '/api/tailor-applications' && method === 'POST') {
      const user = requireUser(req, res); if (!user) return;
      if (user.is_admin) return send(res, 403, { error: 'Admin accounts cannot submit public tailor applications.' });
      const existing = db.prepare('SELECT * FROM tailor_applications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1').get(user.id);
      if (existing && ['SUBMITTED','UNDER_REVIEW','APPROVED'].includes(existing.status)) return send(res, 409, { error: 'You already have an active tailor application.' });
      if (user.tailor_suspended) return send(res, 403, { error: 'Your tailor access is suspended. Contact support before reapplying.' });
      const data = await body(req);
      if (data.consent !== true) return send(res, 400, { error: 'Confirm the application statement before submitting.' });
      const experience = Number(data.experience);
      const specialties = Array.isArray(data.specialties) ? [...new Set(data.specialties.map(s => String(s).trim()).filter(Boolean))].slice(0, 12) : [];
      const workshop = String(data.workshop || '').trim(), portfolio = String(data.portfolio || '').trim(), introduction = String(data.introduction || '').trim();
      if (!Number.isInteger(experience) || experience < 0 || experience > 70 || specialties.length === 0 || workshop.length < 3 || introduction.length < 30) return send(res, 400, { error: 'Complete experience, specialties, workshop, and a 30-character introduction.' });
      if (portfolio && !/^https:\/\//i.test(portfolio)) return send(res, 400, { error: 'Portfolio links must use HTTPS.' });
      const id = randomBytes(16).toString('hex');
      db.prepare(`INSERT INTO tailor_applications (id,user_id,experience,specialties,workshop,portfolio,introduction,status,submitted_at)
        VALUES (?,?,?,?,?,?,?,'SUBMITTED',?)`).run(id, user.id, experience, JSON.stringify(specialties), workshop, portfolio, introduction, nowIso());
      notify(user.id, 'application_submitted', 'Your tailor application was submitted for review.');
      audit(user, 'tailor.application_submitted', id);
      return send(res, 201, { application: applicationJson(db.prepare('SELECT * FROM tailor_applications WHERE id=?').get(id)) });
    }
    if (path === '/api/tailor-applications' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      const row = db.prepare('SELECT * FROM tailor_applications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1').get(user.id);
      return send(res, 200, { application: row ? applicationJson(row) : null });
    }
    if (path === '/api/tailor-profile' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      if (!publicUser(user).permissions.includes('TAILOR')) return send(res, 403, { error: 'Only approved tailors can manage a tailor profile.' });
      const profile = db.prepare('SELECT * FROM tailor_profiles WHERE user_id=?').get(user.id);
      return send(res, 200, { profile: profile ? tailorProfileJson(profile) : { shopName: '', biography: '', services: [], portfolio: [], availability: 'available', public: false, verification: 'verified' } });
    }
    if (path === '/api/tailor-profile' && method === 'PATCH') {
      const user = requireUser(req, res); if (!user) return;
      if (!publicUser(user).permissions.includes('TAILOR')) return send(res, 403, { error: 'Only approved tailors can manage a tailor profile.' });
      const data = await body(req), shopName = String(data.shopName || '').trim().slice(0, 100), biography = String(data.biography || '').trim().slice(0, 3000);
      const services = Array.isArray(data.services) ? [...new Set(data.services.map(item => String(item).trim()).filter(Boolean))].slice(0, 40) : [];
      const portfolio = Array.isArray(data.portfolio) ? [...new Set(data.portfolio.map(item => String(item).trim()).filter(item => /^https:\/\//i.test(item)))].slice(0, 30) : [];
      const availability = ['available','limited','unavailable'].includes(data.availability) ? data.availability : 'available';
      db.prepare(`INSERT INTO tailor_profiles (user_id,shop_name,biography,services,portfolio,availability,public,verification)
        VALUES (?,?,?,?,?,?,?,'verified') ON CONFLICT(user_id) DO UPDATE SET shop_name=excluded.shop_name,biography=excluded.biography,services=excluded.services,portfolio=excluded.portfolio,availability=excluded.availability,public=excluded.public`).run(user.id, shopName, biography, JSON.stringify(services), JSON.stringify(portfolio), availability, data.public === true ? 1 : 0);
      notify(user.id, 'tailor_profile_updated', 'Your tailor profile was updated.');
      return send(res, 200, { profile: tailorProfileJson(db.prepare('SELECT * FROM tailor_profiles WHERE user_id=?').get(user.id)) });
    }
    if (path === '/api/admin/applications' && method === 'GET') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const status = String(url.searchParams.get('status') || '').toUpperCase();
      const query = `SELECT a.*,u.name,u.email,u.phone,u.city FROM tailor_applications a JOIN users u ON u.id=a.user_id ${['SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','NEEDS_INFORMATION'].includes(status) ? 'WHERE a.status=?' : ''} ORDER BY a.submitted_at DESC`;
      const rows = status ? db.prepare(query).all(status) : db.prepare(query).all();
      return send(res, 200, { applications: rows.map(applicationJson) });
    }
    const reviewMatch = path.match(/^\/api\/admin\/applications\/([a-f\d]+)$/i);
    const noteMatch = path.match(/^\/api\/admin\/applications\/([a-f\d]+)\/notes$/i);
    if (noteMatch && method === 'PATCH') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const row = db.prepare('SELECT * FROM tailor_applications WHERE id=?').get(noteMatch[1]);
      if (!row) return send(res, 404, { error: 'Application not found.' });
      const data = await body(req), note = String(data.internalNote || '').trim().slice(0, 2000);
      db.prepare('UPDATE tailor_applications SET internal_note=? WHERE id=?').run(note, row.id);
      audit(admin, 'tailor.application_note_updated', row.id);
      return send(res, 200, { ok: true, internalNote: note });
    }
    if (reviewMatch && method === 'PATCH') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const data = await body(req), status = String(data.status || '').toUpperCase();
      const allowed = ['UNDER_REVIEW','APPROVED','REJECTED','NEEDS_INFORMATION'];
      if (!allowed.includes(status)) return send(res, 400, { error: 'Choose a valid application status.' });
      const row = db.prepare('SELECT * FROM tailor_applications WHERE id=?').get(reviewMatch[1]);
      if (!row) return send(res, 404, { error: 'Application not found.' });
      const message = String(data.message || '').trim().slice(0, 2000);
      db.prepare('UPDATE tailor_applications SET status=?,review_message=?,internal_note=?,reviewed_at=? WHERE id=?').run(status, message, String(data.internalNote || '').trim().slice(0, 2000), nowIso(), row.id);
      if (status === 'APPROVED') {
        db.prepare(`INSERT INTO tailor_profiles (user_id,verification) VALUES (?,'verified') ON CONFLICT(user_id) DO UPDATE SET verification='verified'`).run(row.user_id);
      }
      const messages = { UNDER_REVIEW: 'Your tailor application is under review.', APPROVED: 'Congratulations! Your tailor application is approved. Your account now has customer and tailor access.', REJECTED: message || 'Your tailor application was not approved. You can update it and apply again.', NEEDS_INFORMATION: message || 'The team needs more information to review your tailor application.' };
      notify(row.user_id, `application_${status.toLowerCase()}`, messages[status]);
      audit(admin, `tailor.application_${status.toLowerCase()}`, row.id);
      return send(res, 200, { application: applicationJson(db.prepare('SELECT a.*,u.name,u.email,u.phone,u.city FROM tailor_applications a JOIN users u ON u.id=a.user_id WHERE a.id=?').get(row.id)) });
    }
    if (path === '/api/notifications' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      return send(res, 200, { notifications: db.prepare('SELECT id,kind,message,created_at AS createdAt,read_at AS readAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(user.id) });
    }
    if (path === '/api/notifications/read' && method === 'POST') {
      const user = requireUser(req, res); if (!user) return;
      db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').run(nowIso(), user.id);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/notification-preferences' && method === 'GET') {
      const user = requireUser(req, res); if (!user) return;
      const row = db.prepare('SELECT preferences_json FROM notification_preferences WHERE user_id=?').get(user.id);
      return send(res, 200, { preferences: row ? JSON.parse(row.preferences_json) : { inApp: true, email: false, sms: false } });
    }
    if (path === '/api/notification-preferences' && method === 'PUT') {
      const user = requireUser(req, res); if (!user) return;
      const data = await body(req), preferences = { inApp: data.inApp !== false, email: data.email === true, sms: data.sms === true };
      db.prepare('INSERT INTO notification_preferences (user_id,preferences_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,updated_at=excluded.updated_at').run(user.id, JSON.stringify(preferences), nowIso());
      return send(res, 200, { preferences });
    }
    if (path === '/api/admin/summary' && method === 'GET') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const count = (sql, ...args) => db.prepare(sql).get(...args).count;
      return send(res, 200, { customers: count('SELECT COUNT(*) AS count FROM users WHERE is_admin=0'), applications: count('SELECT COUNT(*) AS count FROM tailor_applications'), pending: count("SELECT COUNT(*) AS count FROM tailor_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW')"), approved: count("SELECT COUNT(*) AS count FROM tailor_applications WHERE status='APPROVED'"), rejected: count("SELECT COUNT(*) AS count FROM tailor_applications WHERE status='REJECTED'"), suspended: count('SELECT COUNT(*) AS count FROM users WHERE tailor_suspended=1') });
    }
    if (path === '/api/admin/customers' && method === 'GET') {
      const admin = requireUser(req, res, true); if (!admin) return;
      return send(res, 200, { users: db.prepare('SELECT * FROM users WHERE is_admin=0 ORDER BY created_at DESC').all().map(publicUser) });
    }
    const customerMatch = path.match(/^\/api\/admin\/customers\/([a-f\d]+)$/i);
    if (customerMatch && method === 'PATCH') {
      const admin = requireUser(req, res, true); if (!admin) return;
      const user = db.prepare('SELECT * FROM users WHERE id=? AND is_admin=0').get(customerMatch[1]);
      if (!user) return send(res, 404, { error: 'Customer account not found.' });
      const data = await body(req), suspended = Boolean(data.tailorSuspended);
      db.prepare('UPDATE users SET tailor_suspended=? WHERE id=?').run(suspended ? 1 : 0, user.id);
      notify(user.id, suspended ? 'tailor_suspended' : 'tailor_reactivated', suspended ? 'Your tailor access has been suspended. Your customer account remains active.' : 'Your tailor access has been reactivated.');
      audit(admin, suspended ? 'tailor.suspended' : 'tailor.reactivated', user.id);
      return send(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error('API error:', error);
    return send(res, error.status || 500, { error: error.status ? error.message : 'The request could not be completed.' });
  }
}
const loginLimits = new Map();
function applicationJson(row) {
  return { id: row.id, userId: row.user_id, name: row.name, email: row.email, phone: row.phone, city: row.city, experience: row.experience, specialties: JSON.parse(row.specialties), workshop: row.workshop, portfolio: row.portfolio, introduction: row.introduction, status: row.status, reviewMessage: row.review_message, internalNote: row.internal_note, submittedAt: row.submitted_at, reviewedAt: row.reviewed_at };
}
function orderJson(row) {
  return { id: row.id, customerId: row.customer_id, customerName: row.customer_name, customerEmail: row.customer_email, tailor: row.tailor_name, garment: row.garment, budget: row.budget, neededBy: row.needed_by, notes: row.notes, design: JSON.parse(row.design || '{}'), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
function tailorProfileJson(row) {
  return { shopName: row.shop_name, biography: row.biography, services: JSON.parse(row.services || '[]'), portfolio: JSON.parse(row.portfolio || '[]'), availability: row.availability, public: Boolean(row.public), verification: row.verification };
}
function featuredWorkJson(row) {
  const item = { id: row.id, ...JSON.parse(row.payload) };
  if (row.image_type) item.craft.imageUrl = `/api/featured-work/${encodeURIComponent(row.id)}/image`;
  return item;
}
function readyMadeJson(row) {
  return {
    id: row.id, title: row.title, category: row.category, description: row.description,
    price: row.price, time: row.time, imageUrl: `/api/ready-made/${encodeURIComponent(row.id)}/image`,
    tailor: { id: row.tailor_id, name: row.tailor_name, city: row.city, shop: row.shop_name || '', slug: row.tailor_name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
  };
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/api/')) return api(req, res);
  if (path === '/admin/login' || path === '/admin/login/') req.url = '/admin-login.html';
  if (!production) return vite.middlewares(req, res, error => {
    if (error) { console.error(error); res.statusCode = 500; res.end('Vite error'); }
  });
  let filePath = resolve(root, 'dist', `.${new URL(req.url, 'http://localhost').pathname}`);
  if (!filePath.startsWith(resolve(root, 'dist'))) { res.writeHead(403); return res.end('Forbidden'); }
  if (new URL(req.url, 'http://localhost').pathname.endsWith('/')) filePath = join(filePath, 'index.html');
  try {
    const { readFile } = await import('node:fs/promises');
    const file = await readFile(filePath);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream' }); res.end(file);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const vite = !production ? await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }) : null;
server.listen(Number(process.env.PORT) || 5173, '127.0.0.1', () => {
  console.log(`E-Dorji ${production ? 'production' : 'development'} server listening on http://127.0.0.1:${process.env.PORT || 5173}`);
  if (generatedAdmin) console.warn(`One-time admin created: ${adminEmail}. Its generated password is stored in the ignored .env file.`);
  if (!adminEmail || !adminPassword) console.warn('Admin login is not provisioned. Set E_DORJI_ADMIN_EMAIL and E_DORJI_ADMIN_PASSWORD before creating the admin account.');
});
function stop() { vite?.close(); db.close(); server.close(() => process.exit(0)); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
