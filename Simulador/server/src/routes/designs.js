import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import pool from '../db.js';

// ============================================================
// CRUD de diseños (tabla `designs` de MySQL).
// pinout_json y bom_json son columnas de tipo JSON.
// ============================================================
const router = Router();

// Helper interno: lista resumida (id, nombre, autor, created_at).
// Usado por GET /api/designs para evitar enviar megabytes de datos.
// Inspirado en businessLogic.getDesignList (public/js/businessLogic.js).
const getDesignList = (rows) =>
  rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    autor: r.autor,
    created_at: r.created_at,
  }));

// Helper interno: diseño completo con pinout_json y bom_json.
// Usado por GET /api/designs/:id (consulta individual).
// Inspirado en businessLogic.getDesignDetail (public/js/businessLogic.js).
const getDesignDetail = (row, pinoutJson, bomJson) => ({
  id: row.id,
  nombre: row.nombre,
  autor: row.autor,
  created_at: row.created_at,
  pinout_json: pinoutJson,
  bom_json: bomJson,
});

// GET /api/designs - LISTA RESUMEN (solo metadatos)
// SELECT id, nombre, autor, created_at FROM designs
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, autor, created_at FROM designs ORDER BY created_at DESC`
    );
    res.json({ ok: true, data: getDesignList(rows) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/designs/:id - DISEÑO COMPLETO
// pinout_json y bom_json solo aquí (consulta individual)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, autor, pinout_json, bom_json, created_at FROM designs WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Diseño no encontrado' });
    }
    const row = rows[0];
    // MySQL2 devuelve JSON como string; parseamos a objeto.
    const pinout = typeof row.pinout_json === 'string' ? JSON.parse(row.pinout_json) : row.pinout_json;
    const bom = typeof row.bom_json === 'string' ? JSON.parse(row.bom_json) : row.bom_json;
    res.json({ ok: true, data: getDesignDetail(row, pinout, bom) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, nombre, autor, pinout, bom } = req.body || {};
    if (!pinout || !bom) {
      return res.status(400).json({ ok: false, error: 'Se requieren pinout y bom' });
    }

    const designId = id || randomUUID();
    const designName = (nombre || 'Sin nombre').slice(0, 255);
    const designAutor = (autor || 'anonimo').slice(0, 100);

    // Upsert: INSERT ... ON DUPLICATE KEY UPDATE
    await pool.query(
      `INSERT INTO designs (id, nombre, autor, pinout_json, bom_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nombre      = VALUES(nombre),
         autor       = VALUES(autor),
         pinout_json = VALUES(pinout_json),
         bom_json    = VALUES(bom_json)`,
      [designId, designName, designAutor, JSON.stringify(pinout), JSON.stringify(bom)]
    );

    res.json({ ok: true, data: { id: designId } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM designs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Diseño no encontrado' });
    }
    res.json({ ok: true, data: { id: req.params.id } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;