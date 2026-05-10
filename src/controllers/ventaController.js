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
    // En pagarVenta, DESPUÉS de confirmar que venta existe
    const [[{ total_real }]] = await conn.execute(
      `SELECT SUM(subtotal) AS total_real FROM detalle_venta WHERE id_venta = ?`,
      [id]
    );

if (Math.abs(parseFloat(monto) - parseFloat(total_real)) > 0.01) {
      throw new Error(`Monto incorrecto. El total real de la venta es $${total_real}`);
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

    for(const item of productos){
      const [[vendido]] = await conn.execute(
        `SELECT cantidad FROM detalle_venta 
     WHERE id_venta = ? AND id_producto = ?`,
     [id, item.id_producto]
      );

      if(!vendido) {
        throw new Error(`El producto ${item.id_producto} no pertenece a esta venta`);
      }
      if (item.cantidad > vendido.cantidad) {
        throw new Error(
          `No puedes devolver ${item.cantidad} unidades del producto  ${item.id_producto},
          solo se vendieron ${vendido.cantidad}`
        );
      }
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


const obtenerProductos = async (req, res, next) => {
  try {
    const todos = req.query.todos === '1';
    const [productos] = await pool.execute(
      todos
        ? `SELECT id_producto, nombre, costo_produccion, precio_venta, activo, id_tipo_producto FROM productos`
        : `SELECT id_producto, nombre, precio_venta FROM productos WHERE activo = 1`
    );
    res.json(productos);
  } catch (error) {
    next(error);
  }
};
const obtenerCategorias = async (req, res, next) => {
  try {
    const [categorias] = await pool.execute(
      `SELECT id_categoria_gasto, nombre FROM cat_categoria_gasto WHERE activo = 1`
    );
    res.json(categorias);
  } catch (error) {
    next(error);
  }
};

const obtenerMetodosPago = async (req, res, next) => { 
  try {
    const [metodos] = await pool.execute(
      `SELECT id_metodo_pago, nombre FROM cat_metodo_pago`
    );
    res.json(metodos);

  }catch(error){
    next(error) ; 
  }
};

const crearProducto = async (req, res, next) => {
  const { id_tipo_producto, nombre, costo_produccion, precio_venta } = req.body;

  if (!nombre || !precio_venta || !id_tipo_producto) {
    return res.status(400).json({ error: 'nombre, precio_venta e id_tipo_producto son requeridos' });
  }
  if (precio_venta <= 0) {
    return res.status(400).json({ error: 'El precio debe ser mayor a cero' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO productos (id_tipo_producto, nombre, costo_produccion, precio_venta)
       VALUES (?, ?, ?, ?)`,
      [id_tipo_producto, nombre, costo_produccion || 0, precio_venta]
    );
    res.status(201).json({ mensaje: 'Producto creado', id_producto: result.insertId });
  } catch (error) {
    next(error);
  }
};

const actualizarProducto = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, costo_produccion, precio_venta } = req.body;

  if (!nombre || !precio_venta) {
    return res.status(400).json({ error: 'nombre y precio_venta son requeridos' });
  }
  if (precio_venta <= 0) {
    return res.status(400).json({ error: 'El precio debe ser mayor a cero' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE productos SET nombre = ?, costo_produccion = ?, precio_venta = ?
       WHERE id_producto = ?`,
      [nombre, costo_produccion || 0, precio_venta, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto actualizado' });
  } catch (error) {
    next(error);
  }
};

const desactivarProducto = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      `UPDATE productos SET activo = 0 WHERE id_producto = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto desactivado' });
  } catch (error) {
    next(error);
  }
};

const obtenerTiposProducto = async (req, res, next) => {
  try {
    const [tipos] = await pool.execute(`SELECT * FROM cat_tipo_producto`);
    res.json(tipos);
  } catch (error) {
    next(error);
  }
};
module.exports = { 
  crearVenta, pagarVenta, registrarGasto, registrarDevolucion, 
  obtenerProductos, obtenerCategorias, obtenerMetodosPago,
  crearProducto, actualizarProducto, desactivarProducto, obtenerTiposProducto
};