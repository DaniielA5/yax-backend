const express = require('express');
const router = express.Router();
const { abrirSesion, cerrarSesion, resumenSesion, historialVentas } = require('../controllers/sesionController');

router.post('/abrir', abrirSesion);
router.get('/:id/historial', historialVentas);
router.post('/cerrar', cerrarSesion);
router.get('/:id/resumen', resumenSesion);

module.exports = router;