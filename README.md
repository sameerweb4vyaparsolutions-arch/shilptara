# Shilptara by Sonali - Ecommerce

Node.js + Express + MySQL + EJS ecommerce website built from the supplied Shilptara product catalog images and layout notes.

## Included

- Responsive maroon/gold botanical ecommerce design
- Home banner slider + offer slider
- Product categories and seeded catalog images
- Product listing, search, category filter and sorting
- Product detail gallery with previous/next controls
- Add to cart, Buy Now, wishlist, related products
- WELCOME10 coupon (10% off) and free shipping over Rs. 1,499
- Checkout with customer/address details and COD
- Online payment UI is kept integration-ready but disabled until a gateway is connected
- Customer register/login/account/order history
- Reviews and product Q&A
- Contact and custom-order pages
- Floating WhatsApp button after a valid number is added in Admin > Site Settings
- Admin dashboard with categories, products, multiple product images, banners, orders, reviews, questions, messages, users, site settings and password change
- Product/category/banner images are stored as MySQL LONGBLOB data, so admin-uploaded images do not disappear after redeploy

## Important before going live

The catalog did not include final selling prices, stock counts, phone number, WhatsApp number or social URLs. Seed prices/stock are starter values only. Update them from the admin panel before launch.

No fake customer reviews are seeded. Review sections populate only after real users submit reviews.

## Local setup

1. Create a MySQL database.
2. Copy `.env.example` to `.env` and fill database credentials.
3. Install packages:

   npm install

4. Create tables and seed the catalog:

   npm run setup-db

5. Start:

   npm start

Open `http://localhost:3000`.

Admin URL: `http://localhost:3000/admin`

Admin email/password come from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` when the database is first seeded.

## Render deployment

This app listens immediately on `process.env.PORT`, so it works with Render's port requirement.

Use an external MySQL database and add these Render environment variables:

- `NODE_ENV=production`
- `DB_HOST`
- `DB_PORT=3306`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SESSION_SECRET`
- `SESSION_STORE=mysql`
- `ADMIN_EMAIL=shilptarabysonali@gmail.com`
- `ADMIN_PASSWORD=<strong-password>`

Suggested Render commands:

- Build Command: `npm install && npm run setup-db`
- Start Command: `npm start`

If you redeploy after the DB is already seeded, `npm run setup-db` is safe to run again. Existing products are not duplicated.

## Image persistence

Uploaded product images, category images and banners are saved in MySQL, not the deployment filesystem. They are served through `/media/...` routes.

## Change website contact details

Go to `Admin > Site Settings` and enter the actual phone, WhatsApp number, Instagram/Facebook links and address. The WhatsApp floating button only appears after a valid WhatsApp number is saved.


## Missing images after redeploy
This build automatically repairs missing seeded category image BLOBs and products that have lost all seeded images whenever `npm run setup-db` runs. The category image endpoint also falls back to the packaged `/public/seed-images/<slug>/01.jpg` file if an older database row has no BLOB.

On Render, keep the build command as:
```bash
npm install && npm run setup-db
```
Then redeploy the latest commit. Existing admin-customised images are not overwritten.


## Client-requested update (21 Sep 2026)
- Cleaner main navigation: Home, About Us, Shop, Categories dropdown, Custom Orders, My Orders, Contact.
- About Us page now includes category showcase and customer reviews.
- Product admin accepts both images and short videos; product detail gallery displays either type.
- Logged-in customers can attach up to 3 photos/videos to a review. Review media is stored in MySQL BLOB and displayed on product/About/Home where available.
- GSTIN field added to Admin > Site Settings and displayed in Contact/Footer when filled.
- Domain-name changes are hosting/DNS settings and are not performed by application code.


## Celebrity Gallery
A dedicated Admin → Celebrity Gallery section lets the client upload, edit, hide, reorder and delete celebrity/event photos or videos. Media is stored in MySQL `celebrity_media` as LONGBLOB data and appears on the homepage plus `/celebrity-gallery`.
