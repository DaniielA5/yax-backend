const express = require('express');
const router = express.Router();
const { crearVenta, pagarVenta, registrarGasto, registrarDevolucion } = require('../controllers/ventaController');

router.post('/', crearVenta);
router.post('/gasto', registrarGasto);        // estática primero
router.post('/:id/pagar', pagarVenta);        // dinámica después
router.post('/:id/devolucion', registrarDevolucion);

module.exports = router;