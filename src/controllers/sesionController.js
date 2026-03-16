const { pool, verificarSesionAbierta } = require('../db/connection');

const abrirSesion = async (req, res) => {
  const { usuario, monto_inicial } = req.body;

  if (!usuario || monto_inicial === undefined) {
    return res.status(400).json({ error: 'usuario y monto_inicial son requeridos' });
  }
  if (monto_inicial < 0) {
    return res.status(400).json({ error: 'monto_inicial no puede ser negativo' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO sesion_caja (usuario, monto_inicial, estado) VALUES (?, ?, 'ABIERTA')`,
      [usuario, monto_inicial]
    );
    res.status(201).json({ mensaje: 'Sesión abierta', id_sesion: result.insertId });
  } catch (error) {
    next(error);
  }
};

const cerrarSesion = async (req, res, next) => {
  const { id_sesion, monto_final_real } = req.body;

  if (!id_sesion || monto_final_real === undefined) {
    return res.status(400).json({ error: 'id_sesion y monto_final_real son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await verificarSesionAbierta(conn, id_sesion);

    const [result] = await conn.execute(
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
    next(error);
  } finally {
    conn.release();
  }
};

const resumenSesion = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [[resultado]] = await pool.execute(
      `SELECT 
        s.usuario,
        s.estado,
        s.monto_inicial,
        s.fecha_inicio,
        s.fecha_fin,
        COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.monto END), 0) AS total_ingresos,
        COALESCE(SUM(CASE WHEN m.tipo = 'EGRESO'  THEN m.monto END), 0) AS total_egresos,
        s.monto_inicial
        + COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.monto END), 0)
        - COALESCE(SUM(CASE WHEN m.tipo = 'EGRESO'  THEN m.monto END), 0) AS debe_haber_en_caja
      FROM sesion_caja s
      LEFT JOIN movimiento_caja m ON m.id_sesion = s.id_sesion
      WHERE s.id_sesion = ?
      GROUP BY s.id_sesion, s.usuario, s.estado, s.monto_inicial, s.fecha_inicio, s.fecha_fin`,
      [id]
    );

    if (!resultado) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

const historialVentas = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [ventas] = await pool.execute(
      `SELECT 
        v.id_venta,
        v.fecha,
        v.estado,
        v.nota,
        SUM(dv.subtotal) AS total
       FROM venta v
       JOIN detalle_venta dv ON dv.id_venta = v.id_venta
       WHERE v.id_sesion = ?
       GROUP BY v.id_venta
       ORDER BY v.fecha DESC`,
      [id]
    );
    res.json(ventas);
  } catch (error) {
    next(error);
  }
};

module.exports = { abrirSesion, cerrarSesion, resumenSesion, historialVentas };