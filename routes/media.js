const express = require('express');
const pool = require('../config/db');
const router = express.Router();

function sendBlob(res, row) {
  if (!row || !row.image_data) return res.status(404).send('Image not found');
  res.set('Content-Type', row.mime_type || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(row.image_data);
}

router.get('/product/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_data, mime_type FROM product_images WHERE id=?', [req.params.id]);
    sendBlob(res, rows[0]);
  } catch (e) { res.status(404).send('Image not found'); }
});

router.get('/category/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_data, mime_type FROM categories WHERE id=?', [req.params.id]);
    sendBlob(res, rows[0]);
  } catch (e) { res.status(404).send('Image not found'); }
});

router.get('/banner/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_data, mime_type FROM banners WHERE id=?', [req.params.id]);
    sendBlob(res, rows[0]);
  } catch (e) { res.status(404).send('Image not found'); }
});

module.exports = router;
