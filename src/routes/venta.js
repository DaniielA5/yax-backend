const express = require('express');
const router = express.Router();
const { 
  crearVenta, pagarVenta, registrarGasto, registrarDevolucion,
  obtenerProductos, obtenerCategorias, obtenerMetodosPago,
  crearProducto, actualizarProducto, desactivarProducto, obtenerTiposProducto
} = require('../controllers/ventaController');

// Agrega estas 4 rutas junto a las demás
router.get('/tipos-producto', obtenerTiposProducto);
router.post('/productos', crearProducto);
router.put('/productos/:id', actualizarProducto);
router.delete('/productos/:id', desactivarProducto);
router.get('/categorias-gasto', obtenerCategorias);
router.get('/productos', obtenerProductos);
router.post('/', crearVenta);
router.post('/gasto', registrarGasto);        // estática primero
router.post('/:id/pagar', pagarVenta);        // dinámica después
router.post('/:id/devolucion', registrarDevolucion);
router.get('/metodos-pago', obtenerMetodosPago);
module.exports = router;