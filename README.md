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
