const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const { requireUser } = require('../middleware/auth');
const { shippingFor, discountFor } = require('../utils/helpers');
const router = express.Router();

const reviewMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype))
});

const CARD_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug,
  (SELECT pi.id FROM product_images pi WHERE pi.product_id=p.id AND pi.mime_type LIKE 'image/%' ORDER BY pi.sort_order,pi.id LIMIT 1) AS image_id,
  (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.approved=1) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id=p.id AND r.approved=1) AS review_count
  FROM products p JOIN categories c ON c.id=p.category_id`;

async function getProductsByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(`${CARD_SELECT} WHERE p.id IN (${placeholders}) AND p.active=1`, ids);
  const map = new Map(rows.map(r => [Number(r.id), r]));
  return ids.map(id => map.get(Number(id))).filter(Boolean);
}

function getCart(req) {
  if (!Array.isArray(req.session.cart)) req.session.cart = [];
  return req.session.cart;
}

function getWishlist(req) {
  if (!Array.isArray(req.session.wishlist)) req.session.wishlist = [];
  return req.session.wishlist;
}

async function logActivity(productId, actionType) {
  try {
    await pool.query('INSERT INTO activity_logs(product_id,action_type,actor_label) VALUES(?,?,?)', [productId || null, actionType, 'A shopper']);
  } catch (_) {}
}

router.get('/', async (req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT id,name,slug,description FROM categories WHERE active=1 ORDER BY sort_order,id');
    const [banners] = await pool.query('SELECT id,title,subtitle,cta_text,cta_link FROM banners WHERE active=1 ORDER BY sort_order,id');
    const [featured] = await pool.query(`${CARD_SELECT} WHERE p.active=1 AND p.featured=1 ORDER BY p.updated_at DESC LIMIT 12`);
    const [newProducts] = await pool.query(`${CARD_SELECT} WHERE p.active=1 ORDER BY p.created_at DESC,p.id DESC LIMIT 12`);
    const [reviews] = await pool.query(`SELECT r.id,r.reviewer_name,r.rating,r.comment,p.name AS product_name,(SELECT rm.id FROM review_media rm WHERE rm.review_id=r.id ORDER BY rm.id LIMIT 1) media_id,(SELECT rm.mime_type FROM review_media rm WHERE rm.review_id=r.id ORDER BY rm.id LIMIT 1) media_type FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.approved=1 ORDER BY r.created_at DESC LIMIT 6`);
    const [celebrityMedia] = await pool.query('SELECT id,title,caption,mime_type FROM celebrity_media WHERE active=1 ORDER BY sort_order,id DESC LIMIT 8');
    res.render('home', { title: 'Handcrafted Botanical Keepsakes', categories, banners, featured, newProducts, reviews, celebrityMedia });
  } catch (err) { next(err); }
});

router.get('/shop', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const sort = String(req.query.sort || 'featured');
    const where = ['p.active=1', 'c.active=1'];
    const params = [];
    if (q) {
      where.push('(p.name LIKE ? OR p.short_description LIKE ? OR c.name LIKE ?)');
      const like = `%${q}%`; params.push(like, like, like);
    }
    if (category) { where.push('c.slug=?'); params.push(category); }
    const sortSql = {
      featured: 'p.featured DESC,p.id DESC',
      newest: 'p.id DESC',
      price_low: 'p.price ASC',
      price_high: 'p.price DESC',
      name: 'p.name ASC'
    }[sort] || 'p.featured DESC,p.id DESC';
    const [products] = await pool.query(`${CARD_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${sortSql}`, params);
    const [categories] = await pool.query('SELECT id,name,slug FROM categories WHERE active=1 ORDER BY sort_order,id');
    res.render('shop', { title: 'Shop', products, categories, q, category, sort });
  } catch (err) { next(err); }
});

router.get('/category/:slug', (req, res) => res.redirect(`/shop?category=${encodeURIComponent(req.params.slug)}`));

router.get('/product/:slug', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${CARD_SELECT} WHERE p.slug=? AND p.active=1 LIMIT 1`, [req.params.slug]);
    if (!rows.length) return res.status(404).render('404', { title: 'Product not found' });
    const product = rows[0];
    const [images] = await pool.query('SELECT id,mime_type FROM product_images WHERE product_id=? ORDER BY sort_order,id', [product.id]);
    const [reviews] = await pool.query("SELECT r.id,r.reviewer_name,r.rating,r.comment,r.created_at,(SELECT rm.id FROM review_media rm WHERE rm.review_id=r.id ORDER BY rm.id LIMIT 1) media_id,(SELECT rm.mime_type FROM review_media rm WHERE rm.review_id=r.id ORDER BY rm.id LIMIT 1) media_type FROM reviews r WHERE r.product_id=? AND r.approved=1 ORDER BY r.created_at DESC", [product.id]);
    const [questions] = await pool.query('SELECT name,question,answer,created_at FROM questions WHERE product_id=? AND answer IS NOT NULL AND answer<>\'\' ORDER BY created_at DESC LIMIT 10', [product.id]);
    const [related] = await pool.query(`${CARD_SELECT} WHERE p.active=1 AND p.category_id=? AND p.id<>? ORDER BY p.featured DESC,p.id DESC LIMIT 8`, [product.category_id, product.id]);
    await logActivity(product.id, 'view');
    res.render('product', { title: product.name, product, images, reviews, questions, related, inWishlist: getWishlist(req).includes(Number(product.id)) });
  } catch (err) { next(err); }
});

router.post('/cart/add', async (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Math.max(1, Math.min(10, Number(req.body.qty || 1)));
  try {
    const [rows] = await pool.query('SELECT id,name,stock,active FROM products WHERE id=? LIMIT 1', [productId]);
    if (!rows.length || !rows[0].active || Number(rows[0].stock) <= 0) throw new Error('Product unavailable');
    const stock = Number(rows[0].stock);
    const cart = getCart(req);
    const item = cart.find(x => Number(x.product_id) === productId);
    if (item) item.qty = Math.min(stock, Number(item.qty) + qty);
    else cart.push({ product_id: productId, qty: Math.min(stock, qty) });
    req.session.cart = cart;
    await logActivity(productId, 'cart');
    if (req.get('accept')?.includes('application/json') || req.xhr) return res.json({ ok: true, message: `${rows[0].name} added to cart.`, cartCount: cart.reduce((s, x) => s + Number(x.qty), 0) });
    req.session.flash = { type: 'success', message: `${rows[0].name} added to cart.` };
    res.redirect(req.get('referer') || '/cart');
  } catch (err) {
    if (req.get('accept')?.includes('application/json') || req.xhr) return res.status(400).json({ ok: false, message: 'Could not add this item.' });
    req.session.flash = { type: 'error', message: 'Could not add this item.' };
    res.redirect(req.get('referer') || '/shop');
  }
});

router.post('/buy-now', async (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Math.max(1, Math.min(10, Number(req.body.qty || 1)));
  try {
    const [rows] = await pool.query('SELECT id,stock,active FROM products WHERE id=? LIMIT 1', [productId]);
    if (!rows.length || !rows[0].active || Number(rows[0].stock) <= 0) throw new Error('Product unavailable');
    req.session.cart = [{ product_id: productId, qty: Math.min(Number(rows[0].stock), qty) }];
    await logActivity(productId, 'cart');
    res.redirect('/checkout');
  } catch (_) {
    req.session.flash = { type: 'error', message: 'This product is currently unavailable.' };
    res.redirect(req.get('referer') || '/shop');
  }
});

router.get('/cart', async (req, res, next) => {
  try {
    const cart = getCart(req);
    const products = await getProductsByIds(cart.map(x => Number(x.product_id)));
    const items = products.map(p => {
      const c = cart.find(x => Number(x.product_id) === Number(p.id));
      return { ...p, qty: Number(c?.qty || 1), line_total: Number(p.price) * Number(c?.qty || 1) };
    });
    const subtotal = items.reduce((s, x) => s + x.line_total, 0);
    const shipping = shippingFor(subtotal);
    const couponCode = req.session.coupon || '';
    const discount = discountFor(subtotal, couponCode);
    res.render('cart', { title: 'Your Cart', items, subtotal, shipping, discount, couponCode, total: Math.max(0, subtotal - discount + shipping) });
  } catch (err) { next(err); }
});

router.post('/cart/update', (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Math.max(1, Math.min(10, Number(req.body.qty || 1)));
  const cart = getCart(req);
  const item = cart.find(x => Number(x.product_id) === productId);
  if (item) item.qty = qty;
  req.session.cart = cart;
  res.redirect('/cart');
});

router.post('/cart/remove', (req, res) => {
  const productId = Number(req.body.product_id);
  req.session.cart = getCart(req).filter(x => Number(x.product_id) !== productId);
  res.redirect('/cart');
});

router.post('/cart/coupon', (req, res) => {
  const code = String(req.body.coupon_code || '').trim().toUpperCase();
  if (!code) { delete req.session.coupon; req.session.flash = { type: 'success', message: 'Coupon removed.' }; }
  else if (code === 'WELCOME10') { req.session.coupon = code; req.session.flash = { type: 'success', message: 'WELCOME10 applied: 10% off.' }; }
  else { req.session.flash = { type: 'error', message: 'Coupon code is not valid.' }; }
  res.redirect('/cart');
});

router.post('/wishlist/toggle', async (req, res) => {
  const productId = Number(req.body.product_id);
  let list = getWishlist(req);
  const exists = list.includes(productId);
  list = exists ? list.filter(id => id !== productId) : [...list, productId];
  req.session.wishlist = list;
  if (!exists) await logActivity(productId, 'wishlist');
  if (req.get('accept')?.includes('application/json') || req.xhr) return res.json({ ok: true, active: !exists, wishlistCount: list.length });
  res.redirect(req.get('referer') || '/wishlist');
});

router.get('/wishlist', async (req, res, next) => {
  try {
    const products = await getProductsByIds(getWishlist(req));
    res.render('wishlist', { title: 'Wishlist', products });
  } catch (err) { next(err); }
});

router.get('/checkout', async (req, res, next) => {
  try {
    const cart = getCart(req);
    if (!cart.length) return res.redirect('/cart');
    const products = await getProductsByIds(cart.map(x => Number(x.product_id)));
    const items = products.map(p => {
      const c = cart.find(x => Number(x.product_id) === Number(p.id));
      return { ...p, qty: Number(c?.qty || 1), line_total: Number(p.price) * Number(c?.qty || 1) };
    });
    const subtotal = items.reduce((s, x) => s + x.line_total, 0);
    const shipping = shippingFor(subtotal);
    const couponCode = req.session.coupon || '';
    const discount = discountFor(subtotal, couponCode);
    let profile = null;
    if (req.session.user) {
      const [u] = await pool.query('SELECT name,email,phone FROM users WHERE id=?', [req.session.user.id]);
      profile = u[0] || null;
    }
    res.render('checkout', { title: 'Checkout', items, subtotal, shipping, discount, couponCode, total: Math.max(0, subtotal - discount + shipping), profile });
  } catch (err) { next(err); }
});

router.post('/checkout', async (req, res, next) => {
  const conn = await pool.getConnection().catch(() => null);
  if (!conn) return next(new Error('Database unavailable'));
  try {
    const cart = getCart(req);
    if (!cart.length) return res.redirect('/cart');
    const products = await getProductsByIds(cart.map(x => Number(x.product_id)));
    const items = products.map(p => {
      const c = cart.find(x => Number(x.product_id) === Number(p.id));
      return { ...p, qty: Number(c?.qty || 1), line_total: Number(p.price) * Number(c?.qty || 1) };
    });
    const subtotal = items.reduce((s, x) => s + x.line_total, 0);
    const shipping = shippingFor(subtotal);
    const couponCode = req.session.coupon || '';
    const discount = discountFor(subtotal, couponCode);
    const total = Math.max(0, subtotal - discount + shipping);
    const body = req.body;
    for (const key of ['customer_name','email','phone','address_line','city','state','pincode']) {
      if (!String(body[key] || '').trim()) {
        req.session.flash = { type: 'error', message: 'Please fill all required checkout fields.' };
        return res.redirect('/checkout');
      }
    }
    const paymentMethod = String(body.payment_method || 'COD').toUpperCase() === 'ONLINE' ? 'ONLINE' : 'COD';
    if (paymentMethod === 'ONLINE') {
      req.session.flash = { type: 'error', message: 'Online payment is ready to integrate but is not enabled yet. Please choose Cash on Delivery.' };
      return res.redirect('/checkout');
    }
    const orderNumber = `SH${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 90 + 10)}`;
    await conn.beginTransaction();
    const [orderResult] = await conn.query(
      `INSERT INTO orders(order_number,user_id,customer_name,email,phone,address_line,city,state,pincode,subtotal,discount,shipping,total,payment_method,payment_status,order_status,customer_note)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderNumber, req.session.user?.id || null, body.customer_name.trim(), body.email.trim(), body.phone.trim(), body.address_line.trim(), body.city.trim(), body.state.trim(), body.pincode.trim(), subtotal, discount, shipping, total, paymentMethod, 'pending', 'placed', String(body.customer_note || '').trim()]
    );
    for (const item of items) {
      await conn.query('INSERT INTO order_items(order_id,product_id,product_name,price,quantity,line_total) VALUES(?,?,?,?,?,?)', [orderResult.insertId, item.id, item.name, item.price, item.qty, item.line_total]);
      await conn.query('UPDATE products SET stock=GREATEST(stock-?,0) WHERE id=?', [item.qty, item.id]);
      await conn.query('INSERT INTO activity_logs(product_id,action_type,actor_label) VALUES(?,?,?)', [item.id, 'order', 'A shopper']);
    }
    await conn.commit();
    req.session.cart = [];
    delete req.session.coupon;
    res.redirect(`/order-success/${encodeURIComponent(orderNumber)}`);
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally { conn.release(); }
});

router.get('/order-success/:number', async (req, res, next) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE order_number=? LIMIT 1', [req.params.number]);
    if (!orders.length) return res.status(404).render('404', { title: 'Order not found' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [orders[0].id]);
    res.render('order-success', { title: 'Order placed', order: orders[0], items });
  } catch (err) { next(err); }
});

router.get('/account', requireUser, async (req, res, next) => {
  try {
    const [orders] = await pool.query('SELECT id,order_number,total,order_status,payment_status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC', [req.session.user.id]);
    res.render('account', { title: 'My account', orders });
  } catch (err) { next(err); }
});

router.post('/product/:id/review', requireUser, reviewMediaUpload.array('review_media', 3), async (req, res) => {
  const productId = Number(req.params.id);
  const rating = Math.max(1, Math.min(5, Number(req.body.rating || 5)));
  const comment = String(req.body.comment || '').trim();
  try {
    if (comment) {
      const [result] = await pool.query('INSERT INTO reviews(product_id,user_id,reviewer_name,rating,comment,approved) VALUES(?,?,?,?,?,1)', [productId, req.session.user.id, req.session.user.name, rating, comment]);
      for (const file of (req.files || [])) {
        await pool.query('INSERT INTO review_media(review_id,media_data,mime_type) VALUES(?,?,?)', [result.insertId, file.buffer, file.mimetype]);
      }
      req.session.flash = { type: 'success', message: 'Thank you. Your review has been submitted.' };
    }
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', message: 'Could not submit review media. Please try a smaller image/video.' };
  }
  res.redirect(req.get('referer') || '/shop');
});

router.post('/product/:id/question', async (req, res) => {
  const productId = Number(req.params.id);
  const name = String(req.body.name || req.session.user?.name || '').trim();
  const email = String(req.body.email || req.session.user?.email || '').trim();
  const question = String(req.body.question || '').trim();
  if (name && email && question) {
    await pool.query('INSERT INTO questions(product_id,name,email,question) VALUES(?,?,?,?)', [productId, name, email, question]);
    req.session.flash = { type: 'success', message: 'Your question has been submitted.' };
  }
  res.redirect(req.get('referer') || '/shop');
});

router.get('/celebrity-gallery', async (req, res, next) => {
  try {
    const [items] = await pool.query('SELECT id,title,caption,mime_type FROM celebrity_media WHERE active=1 ORDER BY sort_order,id DESC');
    res.render('celebrity-gallery', { title: 'Celebrity Gallery', items });
  } catch (err) { next(err); }
});

router.get('/about', async (req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT id,name,slug,description FROM categories WHERE active=1 ORDER BY sort_order,id');
    const [reviews] = await pool.query("SELECT r.id,r.reviewer_name,r.rating,r.comment,p.name AS product_name,(SELECT rm.id FROM review_media rm WHERE rm.review_id=r.id ORDER BY rm.id LIMIT 1) media_id,(SELECT rm.mime_type FROM review_media rm WHERE rm.review_id=r.id ORDER BY rm.id LIMIT 1) media_type FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.approved=1 ORDER BY r.created_at DESC LIMIT 6");
    res.render('about', { title: 'About Shilptara', categories, reviews });
  } catch (err) { next(err); }
});
router.get('/contact', (req, res) => res.render('contact', { title: 'Contact us' }));
router.get('/custom-order', (req, res) => res.render('custom-order', { title: 'Custom Orders' }));

router.post('/contact', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const phone = String(req.body.phone || '').trim();
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  if (name && email && message) {
    await pool.query('INSERT INTO contact_messages(name,email,phone,subject,message) VALUES(?,?,?,?,?)', [name, email, phone, subject, message]);
    req.session.flash = { type: 'success', message: 'Message received. We will get back to you soon.' };
  }
  res.redirect('/contact');
});

router.get('/api/activity', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.action_type,a.actor_label,a.created_at,p.name,p.slug,
      (SELECT pi.id FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order,pi.id LIMIT 1) AS image_id
      FROM activity_logs a LEFT JOIN products p ON p.id=a.product_id
      WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND p.active=1
      ORDER BY a.id DESC LIMIT 10`);
    res.json({ ok: true, activities: rows });
  } catch (_) { res.json({ ok: true, activities: [] }); }
});

module.exports = router;
