const express = require('express');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
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

router.get('/review/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT media_data AS image_data, mime_type FROM review_media WHERE id=?', [req.params.id]);
    sendBlob(res, rows[0]);
  } catch (e) { res.status(404).send('Media not found'); }
});

router.get('/celebrity/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT media_data AS image_data, mime_type FROM celebrity_media WHERE id=?', [req.params.id]);
    sendBlob(res, rows[0]);
  } catch (e) { res.status(404).send('Media not found'); }
});

router.get('/category/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_data, mime_type, slug FROM categories WHERE id=?', [req.params.id]);
    const row = rows[0];
    if (row?.image_data) return sendBlob(res, row);

    // Deployment-safe fallback for seeded categories. This also covers old databases
    // where category rows were created before their image BLOBs were populated.
    const slug = String(row?.slug || '');
    if (/^[a-z0-9-]+$/.test(slug)) {
      const fallback = path.join(__dirname, '..', 'public', 'seed-images', slug, '01.jpg');
      if (fs.existsSync(fallback)) {
        res.set('Cache-Control', 'public, max-age=86400');
        return res.type('jpg').sendFile(fallback);
      }
    }
    res.status(404).send('Image not found');
  } catch (e) { res.status(404).send('Image not found'); }
});

router.get('/banner/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_data, mime_type FROM banners WHERE id=?', [req.params.id]);
    sendBlob(res, rows[0]);
  } catch (e) { res.status(404).send('Image not found'); }
});

module.exports = router;
