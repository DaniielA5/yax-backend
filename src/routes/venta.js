const express = require('express');
const router = express.Router();
const { crearVenta, pagarVenta, registrarGasto, registrarDevolucion, obtenerProductos, obtenerCategorias, obtenerMetodosPago } = require('../controllers/ventaController');

router.get('/categorias-gasto', obtenerCategorias);
router.get('/productos', obtenerProductos);
router.post('/', crearVenta);
router.post('/gasto', registrarGasto);        // estática primero
router.post('/:id/pagar', pagarVenta);        // dinámica después
router.post('/:id/devolucion', registrarDevolucion);
router.get('/metodos-pago', obtenerMetodosPago);
module.exports = router;