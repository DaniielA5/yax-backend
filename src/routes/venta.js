const express = require('express');
const router = express.Router();
const { pool, verificarSesionAbierta } = require('../db/connection');

// POST /venta
router.post('/', async (req, res) => {
  const { id_sesion, nota, productos } = req.body;

  if (!id_sesion || !productos || productos.length === 0) {
    return res.status(400).json({ error: 'id_sesion y productos son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Crear la venta
    const [venta] = await conn.execute(
      `INSERT INTO venta (estado, id_sesion, nota) VALUES ('ABIERTA', ?, ?)`,
      [id_sesion, nota || null]
    );
    const id_venta = venta.insertId;

    // Insertar cada producto en detalle_venta
    let total = 0;
    for (const item of productos) {
      const subtotal = item.cantidad * item.precio_unitario;
      total += subtotal;
      await conn.execute(
        `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario_historico, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [id_venta, item.id_producto, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    await conn.commit();
    res.status(201).json({ mensaje: 'Venta creada', id_venta, total });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

// POST /venta/:id/pagar
router.post('/:id/pagar', async (req, res) => {
  const { id } = req.params;
  const { id_sesion, id_metodo_pago, monto } = req.body;

  if (!id_sesion || !id_metodo_pago || !monto) {
    return res.status(400).json({ error: 'id_sesion, id_metodo_pago y monto son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await verificarSesionAbierta(conn, id_sesion);
    // Verificar que la venta existe y está ABIERTA
    const [[venta]] = await conn.execute(
      `SELECT * FROM venta WHERE id_venta = ? AND estado = 'ABIERTA'`,
      [id]
    );
    if (!venta) {
      await conn.rollback();
      return res.status(400).json({ error: 'Venta no encontrada o ya procesada' });
    }

    // Marcar como PAGADA
    await conn.execute(
      `UPDATE venta SET estado = 'PAGADA' WHERE id_venta = ?`,
      [id]
    );

    // Registrar movimiento de caja
    await conn.execute(
      `INSERT INTO movimiento_caja (tipo, monto, id_metodo_pago, id_sesion, id_venta)
       VALUES ('INGRESO', ?, ?, ?, ?)`,
      [monto, id_metodo_pago, id_sesion, id]
    );

    await conn.commit();
    res.json({ mensaje: 'Venta pagada', id_venta: id });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});
// venta /  gastos || nuevos edspoints  

router.post('/gasto', async (req, res) => {
    const { id_sesion, id_categoria_gasto, monto, descripcion, id_metodo_pago} = req.body;

    if (!id_sesion ||  !id_categoria_gasto || !monto || !id_metodo_pago){
        return res.status(400).json({error: 'id_sesion, id_categoria_gasto, monto y id_metodo_pago son requeridos'});

    }
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        await verificarSesionAbierta(conn, id_sesion);

        const [gasto] = await conn.execute(
      `INSERT INTO gastos (id_categoria_gasto, monto, descripcion, id_sesion)
       VALUES (?, ?, ?, ?)`,
      [id_categoria_gasto, monto, descripcion || null, id_sesion]
    );
    const id_gasto = gasto.insertId;

    // registraremos el mov de caja 

    await conn.execute(
      `INSERT INTO movimiento_caja (tipo, monto, id_metodo_pago, id_sesion, id_gasto)
       VALUES ('EGRESO', ?, ?, ?, ?)`,
      [monto, id_metodo_pago, id_sesion, id_gasto]
    );

    await conn.commit();
    res.status(201).json({ mensaje: 'Gasto registrado', id_gasto });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});
// --------------  venta

router.post('/:id/devolucion', async (req, res) => {
  const { id } = req.params;
  const { id_sesion, motivo, productos, id_metodo_pago } = req.body;

  if (!id_sesion || !productos || productos.length === 0 || !id_metodo_pago) {
    return res.status(400).json({ error: 'id_sesion, productos y id_metodo_pago son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await verificarSesionAbierta(conn, id_sesion);

    const [[venta]] = await conn.execute(
      `SELECT * FROM venta WHERE id_venta = ? AND estado = 'PAGADA'`,
      [id]
    );
    if (!venta) {
      await conn.rollback();
      return res.status(400).json({ error: 'Venta no encontrada o no está pagada' });
    }

    let total_devuelto = 0;
        for (const item of productos) {
        total_devuelto += item.cantidad * item.precio_unitario;
        }

    const [devolucion] = await conn.execute(
      `INSERT INTO devoluciones (id_venta, motivo, total_devuelto, id_sesion)
       VALUES (?, ?, ?, ?)`,
      [id, motivo || null, total_devuelto, id_sesion]
    );
    const id_devolucion = devolucion.insertId;

    // Insertar detalle de devolución
    for (const item of productos) {
      const subtotal = item.cantidad * item.precio_unitario;
      await conn.execute(
        `INSERT INTO detalle_devolucion (id_devolucion, id_producto, cantidad, precio_unitario_historico, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [id_devolucion, item.id_producto, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    // Registrar el movimiento de caja
    await conn.execute(
      `INSERT INTO movimiento_caja (tipo, monto, id_metodo_pago, id_sesion, id_devolucion)
       VALUES ('EGRESO', ?, ?, ?, ?)`,
      [total_devuelto, id_metodo_pago, id_sesion, id_devolucion]
    );

    await conn.commit();
    res.status(201).json({ mensaje: 'Devolución registrada', id_devolucion, total_devuelto });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});


module.exports = router;


