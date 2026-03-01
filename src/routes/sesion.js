const express = require('express');
const router = express.Router();
const { pool, verificarSesionAbierta } = require('../db/connection');
// POST /sesion/abrir
router.post('/abrir', async (req, res) => {
  const { usuario, monto_inicial } = req.body;

  if (!usuario || monto_inicial === undefined) {
    return res.status(400).json({ error: 'usuario y monto_inicial son requeridos' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO sesion_caja (usuario, monto_inicial, estado) VALUES (?, ?, 'ABIERTA')`,
      [usuario, monto_inicial]
    );

    res.status(201).json({
      mensaje: 'Sesión abierta',
      id_sesion: result.insertId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /sesion cerrrar 
router.post('/cerrar', async (req, res) => {
  const { id_sesion, monto_final_real } = req.body;

  if (!id_sesion || monto_final_real === undefined) {
    return res.status(400).json({ error: 'id_sesion y monto_final_real son requeridos' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE sesion_caja 
       SET estado = 'CERRADA', fecha_fin = NOW(), monto_final_real = ?
       WHERE id_sesion = ? AND estado = 'ABIERTA'`,
      [monto_final_real, id_sesion]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Sesión no encontrada o ya cerrada' });
    }

    res.json({ mensaje: 'Sesión cerrada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;