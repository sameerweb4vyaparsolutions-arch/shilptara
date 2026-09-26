require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const root = __dirname;

const schema = [
`CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(170) NOT NULL UNIQUE,
  description TEXT NULL,
  image_data LONGBLOB NULL,
  mime_type VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(220) NOT NULL,
  slug VARCHAR(240) NOT NULL UNIQUE,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  compare_price DECIMAL(12,2) NULL,
  stock INT NOT NULL DEFAULT 0,
  short_description TEXT NULL,
  description LONGTEXT NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(80) NOT NULL DEFAULT 'image/jpeg',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images_product (product_id, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(300) NULL,
  cta_text VARCHAR(80) NULL,
  cta_link VARCHAR(255) NULL,
  image_data LONGBLOB NULL,
  mime_type VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS celebrity_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  caption TEXT NULL,
  media_data LONGBLOB NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_celebrity_active_sort (active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value LONGTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(60) NOT NULL UNIQUE,
  user_id INT NULL,
  customer_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  address_line TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'COD',
  payment_status VARCHAR(60) NOT NULL DEFAULT 'pending',
  order_status VARCHAR(60) NOT NULL DEFAULT 'placed',
  customer_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(220) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NULL,
  reviewer_name VARCHAR(150) NOT NULL,
  rating TINYINT NOT NULL DEFAULT 5,
  comment TEXT NOT NULL,
  approved TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS review_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  media_data LONGBLOB NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_media_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_review_media_review (review_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  subject VARCHAR(200) NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NULL,
  action_type ENUM('view','cart','wishlist','order') NOT NULL,
  actor_label VARCHAR(100) NOT NULL DEFAULT 'A shopper',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_activity_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

async function seed() {
  for (const sql of schema) await pool.query(sql);
  // Lightweight compatibility migration for databases created by an earlier build.
  try { await pool.query('ALTER TABLE orders ADD COLUMN discount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER subtotal'); } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  const adminEmail = process.env.ADMIN_EMAIL || 'shilptarabysonali@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Shilptara@123';
  const [adminRows] = await pool.query('SELECT id FROM users WHERE email=? LIMIT 1', [adminEmail]);
  if (!adminRows.length) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await pool.query('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)', ['Shilptara Admin', adminEmail, hash, 'admin']);
    console.log(`Admin created: ${adminEmail}`);
  }

  const categories = JSON.parse(fs.readFileSync(path.join(root, 'seed/categories.json'), 'utf8'));
  const categoryIds = {};
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const img = fs.readFileSync(path.join(root, c.image_path));
    const [found] = await pool.query(
      'SELECT id, OCTET_LENGTH(image_data) AS image_bytes FROM categories WHERE slug=? LIMIT 1',
      [c.slug]
    );
    if (found.length) {
      categoryIds[c.slug] = found[0].id;
      // Older/live databases may already have the category row but no image BLOB.
      // Backfill only missing images so admin-customised images are never overwritten.
      if (!Number(found[0].image_bytes || 0)) {
        await pool.query('UPDATE categories SET image_data=?, mime_type=? WHERE id=?', [img, 'image/jpeg', found[0].id]);
        console.log(`Restored missing category image: ${c.name}`);
      }
      continue;
    }
    const [result] = await pool.query(
      'INSERT INTO categories(name,slug,description,image_data,mime_type,active,sort_order) VALUES(?,?,?,?,?,?,?)',
      [c.name, c.slug, `Explore handcrafted ${c.name.toLowerCase()} by Shilptara.`, img, 'image/jpeg', 1, i + 1]
    );
    categoryIds[c.slug] = result.insertId;
  }

  // Seed missing products and repair seeded products that exist but lost all images.
  // Existing product details and existing/admin-uploaded images are left untouched.
  const products = JSON.parse(fs.readFileSync(path.join(root, 'seed/products.json'), 'utf8'));
  let seededProducts = 0;
  let repairedProductImages = 0;
  for (const p of products) {
    let productId;
    const [existingProducts] = await pool.query('SELECT id FROM products WHERE slug=? LIMIT 1', [p.slug]);
    if (existingProducts.length) {
      productId = existingProducts[0].id;
    } else {
      const [result] = await pool.query(
        `INSERT INTO products(category_id,name,slug,price,compare_price,stock,short_description,description,featured,active)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [categoryIds[p.category_slug], p.name, p.slug, p.price, p.compare_price, p.stock, p.short_description, p.description, p.featured, p.active]
      );
      productId = result.insertId;
      seededProducts++;
    }

    const [[imageCount]] = await pool.query('SELECT COUNT(*) AS total FROM product_images WHERE product_id=?', [productId]);
    if (Number(imageCount.total) === 0) {
      const imagePaths = [p.image_path, ...(p.extra_image_paths || [])];
      for (let imageIndex = 0; imageIndex < imagePaths.length; imageIndex++) {
        const img = fs.readFileSync(path.join(root, imagePaths[imageIndex]));
        await pool.query(
          'INSERT INTO product_images(product_id,image_data,mime_type,sort_order) VALUES(?,?,?,?)',
          [productId, img, 'image/jpeg', imageIndex + 1]
        );
      }
      repairedProductImages++;
    }
  }
  if (seededProducts) console.log(`Seeded ${seededProducts} missing products.`);
  if (repairedProductImages) console.log(`Restored images for ${repairedProductImages} product(s).`);

  const banners = [
    ['Nature, Preserved Beautifully', 'Handcrafted real-flower jewellery and botanical keepsakes made to hold your memories.', 'Shop Jewellery', '/shop?category=pendants', 'hero-jewellery.jpg'],
    ['Turn Wedding Flowers Into Forever', 'Preserve varmala flowers, photographs and milestones in custom memory frames.', 'Explore Preservation', '/shop?category=varmala-preservation', 'hero-preservation.jpg'],
    ['Little Keepsakes, Big Stories', 'Personalised keychains, bookmarks, gifts and custom resin pieces made with meaning.', 'Shop Keepsakes', '/shop?category=keychains', 'hero-keepsakes.jpg']
  ];
  for (let i = 0; i < banners.length; i++) {
    const [title, subtitle, ctaText, ctaLink, file] = banners[i];
    const img = fs.readFileSync(path.join(root, 'public/seed-banners', file));
    const [existingBanners] = await pool.query(
      'SELECT id, OCTET_LENGTH(image_data) AS image_bytes FROM banners WHERE title=? LIMIT 1',
      [title]
    );
    if (existingBanners.length) {
      if (!Number(existingBanners[0].image_bytes || 0)) {
        await pool.query('UPDATE banners SET image_data=?, mime_type=? WHERE id=?', [img, 'image/jpeg', existingBanners[0].id]);
        console.log(`Restored missing banner image: ${title}`);
      }
    } else {
      await pool.query(
        'INSERT INTO banners(title,subtitle,cta_text,cta_link,image_data,mime_type,active,sort_order) VALUES(?,?,?,?,?,?,1,?)',
        [title, subtitle, ctaText, ctaLink, img, 'image/jpeg', i + 1]
      );
    }
  }

  const defaults = {
    site_name: 'Shilptara by Sonali',
    announcement: 'Free shipping on orders above ₹1,499 • Except Wedding Preservation',
    contact_email: 'shilptarabysonali@gmail.com',
    contact_phone: '',
    whatsapp_number: '',
    gst_number: '',
    instagram_url: '#',
    facebook_url: '#',
    address: 'India',
    about_text: 'Shilptara by Sonali creates handcrafted resin jewellery, preserved-flower keepsakes and personalised décor inspired by nature and meaningful moments.',
    shipping_note: 'Free shipping on orders above ₹1,499. Standard shipping ₹99.',
    footer_note: 'Handmade with care. Because flowers and memories deserve to stay.'
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query('INSERT IGNORE INTO settings(setting_key,setting_value) VALUES(?,?)', [key, value]);
  }

  // One-time announcement update for existing deployments. Preserve any later admin customisation.
  const announcementMigrationKey = 'announcement_bar_shipping_v1';
  const [announcementMigration] = await pool.query('SELECT setting_value FROM settings WHERE setting_key=? LIMIT 1', [announcementMigrationKey]);
  if (!announcementMigration.length) {
    await pool.query(
      'UPDATE settings SET setting_value=? WHERE setting_key=?',
      ['Free shipping on orders above ₹1,499 • Except Wedding Preservation', 'announcement']
    );
    await pool.query(
      'INSERT INTO settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',
      [announcementMigrationKey, '1']
    );
  }

  // Reviews are never fabricated during setup. They appear only after real users submit them.

  console.log('Database setup complete.');
  console.log(`Admin login: ${adminEmail}`);
  console.log('Change ADMIN_PASSWORD and use the admin password-change flow after deployment.');
}

seed().then(() => pool.end()).catch(async (err) => {
  console.error('Setup failed:', err.code || err.message);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
