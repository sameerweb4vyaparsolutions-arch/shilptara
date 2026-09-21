const slugify = require('slugify');

function makeSlug(value) {
  return slugify(String(value || ''), { lower: true, strict: true, trim: true });
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function shippingFor(subtotal) {
  return Number(subtotal) >= 1499 ? 0 : 99;
}

function cartCount(cart = []) {
  return cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function discountFor(subtotal, couponCode) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (code === 'WELCOME10') return Math.round(Number(subtotal || 0) * 0.10);
  return 0;
}

module.exports = { makeSlug, money, shippingFor, cartCount, discountFor };
