const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { makeSlug } = require('../utils/helpers');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

function flash(req, type, message) { req.session.flash = { type, message }; }

router.get('/login', (req, res) => {
  if (req.session.user?.role === 'admin') return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login', layout: false });
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query("SELECT id,name,email,password_hash,role FROM users WHERE email=? AND role='admin' LIMIT 1", [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      flash(req, 'error', 'Invalid admin email or password.');
      return res.redirect('/admin/login');
    }
    req.session.user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: 'admin' };
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    flash(req, 'error', 'Admin login failed.');
    res.redirect('/admin/login');
  }
});

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const [[p],[c],[o],[m],[q]] = await Promise.all([
      pool.query('SELECT COUNT(*) total FROM products'),
      pool.query('SELECT COUNT(*) total FROM categories'),
      pool.query('SELECT COUNT(*) total, COALESCE(SUM(total),0) revenue FROM orders'),
      pool.query('SELECT COUNT(*) total FROM contact_messages'),
      pool.query('SELECT COUNT(*) total FROM questions WHERE answer IS NULL OR answer=\'\'')
    ]);
    const [orders] = await pool.query('SELECT order_number,customer_name,total,order_status,created_at FROM orders ORDER BY created_at DESC LIMIT 8');
    const [lowStock] = await pool.query('SELECT id,name,stock FROM products WHERE active=1 AND stock<=5 ORDER BY stock ASC LIMIT 8');
    res.render('admin/dashboard', { title: 'Dashboard', stats: { products:p[0], categories:c[0], orders:o[0], messages:m[0], questions:q[0] }, orders, lowStock });
  } catch (err) { next(err); }
});

router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT c.*, COUNT(p.id) product_count FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.sort_order,c.id`);
    res.render('admin/categories', { title: 'Categories', categories: rows });
  } catch (err) { next(err); }
});

router.get('/categories/new', (req, res) => res.render('admin/category-form', { title: 'Add Category', category: null }));
router.get('/categories/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id=?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/categories');
    res.render('admin/category-form', { title: 'Edit Category', category: rows[0] });
  } catch (err) { next(err); }
});

router.post('/categories/save', upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.body.id || 0);
    const name = String(req.body.name || '').trim();
    let slug = makeSlug(req.body.slug || name);
    if (!name || !slug) throw new Error('Name required');
    const [dupes] = await pool.query('SELECT id FROM categories WHERE slug=? AND id<>?', [slug, id || 0]);
    if (dupes.length) slug = `${slug}-${Date.now().toString().slice(-5)}`;
    const values = [name, slug, String(req.body.description || '').trim(), req.body.active ? 1 : 0, Number(req.body.sort_order || 0)];
    if (id) {
      await pool.query('UPDATE categories SET name=?,slug=?,description=?,active=?,sort_order=? WHERE id=?', [...values, id]);
      if (req.file) await pool.query('UPDATE categories SET image_data=?,mime_type=? WHERE id=?', [req.file.buffer, req.file.mimetype, id]);
      flash(req, 'success', 'Category updated.');
    } else {
      const [result] = await pool.query('INSERT INTO categories(name,slug,description,active,sort_order,image_data,mime_type) VALUES(?,?,?,?,?,?,?)', [...values, req.file?.buffer || null, req.file?.mimetype || null]);
      flash(req, 'success', 'Category added.');
    }
  } catch (err) {
    console.error(err);
    flash(req, 'error', 'Could not save category.');
  }
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', async (req, res) => {
  try {
    const [count] = await pool.query('SELECT COUNT(*) total FROM products WHERE category_id=?', [req.params.id]);
    if (Number(count[0].total) > 0) flash(req, 'error', 'Move or delete products from this category first.');
    else { await pool.query('DELETE FROM categories WHERE id=?', [req.params.id]); flash(req, 'success', 'Category deleted.'); }
  } catch (_) { flash(req, 'error', 'Could not delete category.'); }
  res.redirect('/admin/categories');
});

router.get('/products', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const categoryId = Number(req.query.category_id || 0);
    const where = ['1=1']; const params=[];
    if (q) { where.push('(p.name LIKE ? OR p.slug LIKE ?)'); params.push(`%${q}%`,`%${q}%`); }
    if (categoryId) { where.push('p.category_id=?'); params.push(categoryId); }
    const [products] = await pool.query(`SELECT p.*,c.name category_name,(SELECT pi.id FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order,pi.id LIMIT 1) image_id FROM products p JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC`, params);
    const [categories] = await pool.query('SELECT id,name FROM categories ORDER BY sort_order,id');
    res.render('admin/products', { title: 'Products', products, categories, q, categoryId });
  } catch (err) { next(err); }
});

router.get('/products/new', async (req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT id,name FROM categories WHERE active=1 ORDER BY sort_order,id');
    res.render('admin/product-form', { title: 'Add Product', product: null, categories, images: [] });
  } catch (err) { next(err); }
});

router.get('/products/:id/edit', async (req, res, next) => {
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE id=?', [req.params.id]);
    if (!products.length) return res.redirect('/admin/products');
    const [categories] = await pool.query('SELECT id,name FROM categories ORDER BY sort_order,id');
    const [images] = await pool.query('SELECT id,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order,id', [req.params.id]);
    res.render('admin/product-form', { title: 'Edit Product', product: products[0], categories, images });
  } catch (err) { next(err); }
});

router.post('/products/save', upload.array('images', 10), async (req, res) => {
  try {
    const id = Number(req.body.id || 0);
    const name = String(req.body.name || '').trim();
    let slug = makeSlug(req.body.slug || name);
    const categoryId = Number(req.body.category_id || 0);
    if (!name || !slug || !categoryId) throw new Error('Required fields missing');
    const [dupes] = await pool.query('SELECT id FROM products WHERE slug=? AND id<>?', [slug, id || 0]);
    if (dupes.length) slug = `${slug}-${Date.now().toString().slice(-5)}`;
    const values = [categoryId,name,slug,Number(req.body.price||0),req.body.compare_price?Number(req.body.compare_price):null,Number(req.body.stock||0),String(req.body.short_description||'').trim(),String(req.body.description||'').trim(),req.body.featured?1:0,req.body.active?1:0];
    let productId=id;
    if (id) {
      await pool.query(`UPDATE products SET category_id=?,name=?,slug=?,price=?,compare_price=?,stock=?,short_description=?,description=?,featured=?,active=? WHERE id=?`, [...values,id]);
    } else {
      const [result] = await pool.query(`INSERT INTO products(category_id,name,slug,price,compare_price,stock,short_description,description,featured,active) VALUES(?,?,?,?,?,?,?,?,?,?)`, values);
      productId=result.insertId;
    }
    if (req.files?.length) {
      const [[mx]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) max_sort FROM product_images WHERE product_id=?', [productId]);
      let sort = Number(mx.max_sort || 0) + 1;
      for (const file of req.files) await pool.query('INSERT INTO product_images(product_id,image_data,mime_type,sort_order) VALUES(?,?,?,?)', [productId,file.buffer,file.mimetype,sort++]);
    }
    flash(req,'success', id ? 'Product updated.' : 'Product added.');
    res.redirect(`/admin/products/${productId}/edit`);
  } catch (err) {
    console.error(err);
    flash(req,'error','Could not save product.');
    res.redirect('/admin/products');
  }
});

router.post('/products/:productId/images/:imageId/delete', async (req, res) => {
  await pool.query('DELETE FROM product_images WHERE id=? AND product_id=?', [req.params.imageId,req.params.productId]).catch(()=>{});
  flash(req,'success','Image removed.');
  res.redirect(`/admin/products/${req.params.productId}/edit`);
});

router.post('/products/:id/delete', async (req, res) => {
  try { await pool.query('DELETE FROM products WHERE id=?', [req.params.id]); flash(req,'success','Product deleted.'); }
  catch (err) { flash(req,'error','Product cannot be deleted because it is linked to an order. You can mark it inactive instead.'); }
  res.redirect('/admin/products');
});

router.get('/banners', async (req, res, next) => {
  try {
    const [banners] = await pool.query('SELECT id,title,subtitle,cta_text,cta_link,active,sort_order,image_data IS NOT NULL has_image FROM banners ORDER BY sort_order,id');
    res.render('admin/banners', { title:'Banners', banners });
  } catch (err) { next(err); }
});

router.get('/banners/new', (req,res)=>res.render('admin/banner-form',{title:'Add Banner',banner:null}));
router.get('/banners/:id/edit', async (req,res,next)=>{
  try { const [r]=await pool.query('SELECT id,title,subtitle,cta_text,cta_link,active,sort_order,image_data IS NOT NULL has_image FROM banners WHERE id=?',[req.params.id]); if(!r.length)return res.redirect('/admin/banners'); res.render('admin/banner-form',{title:'Edit Banner',banner:r[0]}); } catch(e){next(e);}
});
router.post('/banners/save', upload.single('image'), async (req,res)=>{
  try {
    const id=Number(req.body.id||0); const vals=[String(req.body.title||'').trim(),String(req.body.subtitle||'').trim(),String(req.body.cta_text||'').trim(),String(req.body.cta_link||'').trim(),req.body.active?1:0,Number(req.body.sort_order||0)];
    let bannerId=id;
    if(id) await pool.query('UPDATE banners SET title=?,subtitle=?,cta_text=?,cta_link=?,active=?,sort_order=? WHERE id=?',[...vals,id]);
    else { const [r]=await pool.query('INSERT INTO banners(title,subtitle,cta_text,cta_link,active,sort_order) VALUES(?,?,?,?,?,?)',vals); bannerId=r.insertId; }
    if(req.file) await pool.query('UPDATE banners SET image_data=?,mime_type=? WHERE id=?',[req.file.buffer,req.file.mimetype,bannerId]);
    flash(req,'success','Banner saved.'); res.redirect('/admin/banners');
  } catch(e){console.error(e);flash(req,'error','Could not save banner.');res.redirect('/admin/banners');}
});
router.post('/banners/:id/delete', async (req,res)=>{await pool.query('DELETE FROM banners WHERE id=?',[req.params.id]).catch(()=>{});flash(req,'success','Banner deleted.');res.redirect('/admin/banners');});

router.get('/orders', async (req,res,next)=>{
  try { const [orders]=await pool.query('SELECT * FROM orders ORDER BY created_at DESC'); res.render('admin/orders',{title:'Orders',orders}); } catch(e){next(e);}
});
router.get('/orders/:id', async (req,res,next)=>{
  try { const [o]=await pool.query('SELECT * FROM orders WHERE id=?',[req.params.id]); if(!o.length)return res.redirect('/admin/orders'); const [items]=await pool.query('SELECT * FROM order_items WHERE order_id=?',[req.params.id]); res.render('admin/order-detail',{title:`Order ${o[0].order_number}`,order:o[0],items}); } catch(e){next(e);}
});
router.post('/orders/:id/status', async (req,res)=>{
  const allowed=['placed','confirmed','processing','shipped','delivered','cancelled']; const status=allowed.includes(req.body.order_status)?req.body.order_status:'placed'; const pay=['pending','paid','failed','refunded'].includes(req.body.payment_status)?req.body.payment_status:'pending';
  await pool.query('UPDATE orders SET order_status=?,payment_status=? WHERE id=?',[status,pay,req.params.id]).catch(()=>{}); flash(req,'success','Order status updated.'); res.redirect(`/admin/orders/${req.params.id}`);
});

router.get('/reviews', async (req,res,next)=>{
  try { const [reviews]=await pool.query('SELECT r.*,p.name product_name FROM reviews r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC'); res.render('admin/reviews',{title:'Reviews',reviews}); } catch(e){next(e);}
});
router.post('/reviews/:id/toggle', async (req,res)=>{await pool.query('UPDATE reviews SET approved=1-approved WHERE id=?',[req.params.id]).catch(()=>{});res.redirect('/admin/reviews');});
router.post('/reviews/:id/delete', async (req,res)=>{await pool.query('DELETE FROM reviews WHERE id=?',[req.params.id]).catch(()=>{});res.redirect('/admin/reviews');});

router.get('/questions', async (req,res,next)=>{
  try { const [questions]=await pool.query('SELECT q.*,p.name product_name FROM questions q JOIN products p ON p.id=q.product_id ORDER BY q.created_at DESC'); res.render('admin/questions',{title:'Product Questions',questions}); } catch(e){next(e);}
});
router.post('/questions/:id/answer', async (req,res)=>{await pool.query('UPDATE questions SET answer=? WHERE id=?',[String(req.body.answer||'').trim(),req.params.id]).catch(()=>{});flash(req,'success','Answer saved.');res.redirect('/admin/questions');});
router.post('/questions/:id/delete', async (req,res)=>{await pool.query('DELETE FROM questions WHERE id=?',[req.params.id]).catch(()=>{});res.redirect('/admin/questions');});

router.get('/messages', async (req,res,next)=>{
  try { const [messages]=await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC'); res.render('admin/messages',{title:'Messages',messages}); } catch(e){next(e);}
});
router.post('/messages/:id/delete', async (req,res)=>{await pool.query('DELETE FROM contact_messages WHERE id=?',[req.params.id]).catch(()=>{});res.redirect('/admin/messages');});

router.get('/users', async (req,res,next)=>{
  try { const [users]=await pool.query('SELECT id,name,email,phone,role,created_at FROM users ORDER BY created_at DESC'); res.render('admin/users',{title:'Customers & Users',users}); } catch(e){next(e);}
});

router.get('/settings', async (req,res,next)=>{
  try { const [rows]=await pool.query('SELECT setting_key,setting_value FROM settings'); const settings={}; rows.forEach(r=>settings[r.setting_key]=r.setting_value); res.render('admin/settings',{title:'Site Settings',settings}); } catch(e){next(e);}
});
router.post('/settings', async (req,res)=>{
  const keys=['site_name','announcement','contact_email','contact_phone','whatsapp_number','instagram_url','facebook_url','address','about_text','shipping_note','footer_note'];
  for(const key of keys) await pool.query('INSERT INTO settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',[key,String(req.body[key]||'').trim()]);
  flash(req,'success','Site settings updated.');res.redirect('/admin/settings');
});

router.get('/password', (req,res)=>res.render('admin/password',{title:'Change Password'}));
router.post('/password', async (req,res)=>{
  try {
    const current=String(req.body.current_password||''); const next=String(req.body.new_password||''); const confirm=String(req.body.confirm_password||'');
    if(next.length<8 || next!==confirm) throw new Error('New password must be at least 8 characters and match confirmation.');
    const [rows]=await pool.query('SELECT password_hash FROM users WHERE id=?',[req.session.user.id]);
    if(!rows.length || !(await bcrypt.compare(current,rows[0].password_hash))) throw new Error('Current password is incorrect.');
    const hash=await bcrypt.hash(next,12); await pool.query('UPDATE users SET password_hash=? WHERE id=?',[hash,req.session.user.id]); flash(req,'success','Password changed successfully.');
  } catch(e){flash(req,'error',e.message || 'Could not change password.');}
  res.redirect('/admin/password');
});

module.exports = router;
