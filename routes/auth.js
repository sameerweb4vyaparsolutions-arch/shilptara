const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const router = express.Router();

router.get('/login', (req, res) => res.render('login', { title: 'Login' }));
router.get('/register', (req, res) => res.render('register', { title: 'Create account' }));

router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (!name || !email || password.length < 6) {
      req.session.flash = { type: 'error', message: 'Please enter a name, valid email and password of at least 6 characters.' };
      return res.redirect('/register');
    }
    const [existing] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) {
      req.session.flash = { type: 'error', message: 'An account with this email already exists.' };
      return res.redirect('/login');
    }
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query('INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)', [name, email, phone, hash, 'customer']);
    req.session.user = { id: result.insertId, name, email, role: 'customer' };
    req.session.flash = { type: 'success', message: 'Your account has been created.' };
    res.redirect(req.session.returnTo || '/');
    delete req.session.returnTo;
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', message: 'Could not create your account right now.' };
    res.redirect('/register');
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE email=? LIMIT 1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      req.session.flash = { type: 'error', message: 'Incorrect email or password.' };
      return res.redirect('/login');
    }
    const u = rows[0];
    req.session.user = { id: u.id, name: u.name, email: u.email, role: u.role };
    const target = req.session.returnTo || (u.role === 'admin' ? '/admin' : '/');
    delete req.session.returnTo;
    res.redirect(target);
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', message: 'Login failed. Please try again.' };
    res.redirect('/login');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
