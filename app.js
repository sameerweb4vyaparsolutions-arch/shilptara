require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pool = require('./config/db');
const { money, cartCount } = require('./utils/helpers');

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));

let sessionStore;
if ((process.env.SESSION_STORE || 'mysql').toLowerCase() === 'mysql') {
  try {
    const MySQLStore = require('express-mysql-session')(session);
    sessionStore = new MySQLStore({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '',
      createDatabaseTable: true,
      schema: {
        tableName: 'user_sessions',
        columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' }
      }
    });
  } catch (err) {
    console.warn('MySQL session store unavailable, using memory store:', err.message);
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'shilptara-local-dev-secret-change-me',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true'
  }
}));

let siteCache = { at: 0, settings: {}, categories: [] };
async function loadSiteGlobals() {
  if (Date.now() - siteCache.at < 30000) return siteCache;
  const next = { at: Date.now(), settings: {}, categories: [] };
  const [settingRows] = await pool.query('SELECT setting_key, setting_value FROM settings');
  for (const row of settingRows) next.settings[row.setting_key] = row.setting_value;
  const [categoryRows] = await pool.query('SELECT id,name,slug FROM categories WHERE active=1 ORDER BY sort_order,id');
  next.categories = categoryRows;
  siteCache = next;
  return next;
}

app.use(async (req, res, next) => {
  res.locals.money = money;
  res.locals.currentUser = req.session.user || null;
  res.locals.cartCount = cartCount(req.session.cart || []);
  res.locals.wishlistCount = (req.session.wishlist || []).length;
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.site = {
    site_name: 'Shilptara by Sonali',
    announcement: 'Handcrafted botanical keepsakes • Custom orders welcome',
    contact_email: 'shilptarabysonali@gmail.com',
    contact_phone: '',
    whatsapp_number: '',
    gst_number: '',
    instagram_url: '#', facebook_url: '#', address: 'India', footer_note: ''
  };
  res.locals.navCategories = [];
  if (req.path.startsWith('/media/')) return next();
  try {
    const data = await loadSiteGlobals();
    res.locals.site = { ...res.locals.site, ...data.settings };
    res.locals.navCategories = data.categories;
  } catch (err) {
    // App still starts immediately on hosting even before DB credentials are correct.
  }
  next();
});

app.use('/media', require('./routes/media'));
app.use(require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use(require('./routes/site'));

app.use((req, res) => res.status(404).render('404', { title: 'Page not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render('error', { title: 'Something went wrong', error: process.env.NODE_ENV === 'production' ? null : err });
});

// Do not wrap listen() in a DB callback. This is important on Hostinger/Passenger.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shilptara running on port ${PORT}`);
  console.log('Admin: /admin');
});
