const { pool, verificarSesionAbierta } = require('../db/connection');

const crearVenta = async (req, res, next) => {
  const { id_sesion, nota, productos } = req.body;

  if (!id_sesion || !productos || productos.length === 0) {
    return res.status(400).json({ error: 'id_sesion y productos son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await verificarSesionAbierta(conn, id_sesion);

    const [venta] = await conn.execute(
      `INSERT INTO venta (estado, id_sesion, nota) VALUES ('ABIERTA', ?, ?)`,
      [id_sesion, nota || null]
    );
    const id_venta = venta.insertId;

    let total = 0;
    for (const item of productos) {
      if (!item.id_producto || !item.cantidad || !item.precio_unitario) {
        throw new Error('Cada producto requiere id_producto, cantidad y precio_unitario');
      }
      if (item.cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero');
      if (item.precio_unitario <= 0) throw new Error('El precio debe ser mayor a cero');

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
    next(error);
  } finally {
    conn.release();
  }
};

const pagarVenta = async (req, res, next) => {
  const { id } = req.params;
  const { id_sesion, id_metodo_pago, monto } = req.body;

  if (!id_sesion || !id_metodo_pago || !monto) {
    return res.status(400).json({ error: 'id_sesion, id_metodo_pago y monto son requeridos' });
  }
  if (monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await verificarSesionAbierta(conn, id_sesion);

    const [[venta]] = await conn.execute(
      `SELECT * FROM venta WHERE id_venta = ? AND estado = 'ABIERTA'`,
      [id]
    );
    if (!venta) {
      throw new Error('Venta no encontrada o ya procesada');
    }

    await conn.execute(
      `UPDATE venta SET estado = 'PAGADA' WHERE id_venta = ?`,
      [id]
    );
    await conn.execute(
      `INSERT INTO movimiento_caja (tipo, monto, id_metodo_pago, id_sesion, id_venta)
       VALUES ('INGRESO', ?, ?, ?, ?)`,
      [monto, id_metodo_pago, id_sesion, id]
    );

    await conn.commit();
    res.json({ mensaje: 'Venta pagada', id_venta: id });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

const registrarGasto = async (req, res, next) => {
  const { id_sesion, id_categoria_gasto, monto, descripcion, id_metodo_pago } = req.body;

  if (!id_sesion || !id_categoria_gasto || !monto || !id_metodo_pago) {
    return res.status(400).json({ error: 'id_sesion, id_categoria_gasto, monto y id_metodo_pago son requeridos' });
  }
  if (monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await verificarSesionAbierta(conn, id_sesion);

    const [gasto] = await conn.execute(
      `INSERT INTO gastos (id_categoria_gasto, monto, descripcion, id_sesion)
       VALUES (?, ?, ?, ?)`,
      [id_categoria_gasto, monto, descripcion || null, id_sesion]
    );
    const id_gasto = gasto.insertId;

    await conn.execute(
      `INSERT INTO movimiento_caja (tipo, monto, id_metodo_pago, id_sesion, id_gasto)
       VALUES ('EGRESO', ?, ?, ?, ?)`,
      [monto, id_metodo_pago, id_sesion, id_gasto]
    );

    await conn.commit();
    res.status(201).json({ mensaje: 'Gasto registrado', id_gasto });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

const registrarDevolucion = async (req, res, next) => {
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
      throw new Error('Venta no encontrada o no está pagada');
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

    for (const item of productos) {
      const subtotal = item.cantidad * item.precio_unitario;
      await conn.execute(
        `INSERT INTO detalle_devolucion (id_devolucion, id_producto, cantidad, precio_unitario_historico, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [id_devolucion, item.id_producto, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    await conn.execute(
      `INSERT INTO movimiento_caja (tipo, monto, id_metodo_pago, id_sesion, id_devolucion)
       VALUES ('EGRESO', ?, ?, ?, ?)`,
      [total_devuelto, id_metodo_pago, id_sesion, id_devolucion]
    );

    await conn.commit();
    res.status(201).json({ mensaje: 'Devolución registrada', id_devolucion, total_devuelto });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

module.exports = { crearVenta, pagarVenta, registrarGasto, registrarDevolucion };