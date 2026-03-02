const express = require('express');
const router = express.Router();
const { abrirSesion, cerrarSesion, resumenSesion } = require('../controllers/sesionController');

router.post('/abrir', abrirSesion);
router.post('/cerrar', cerrarSesion);
router.get('/:id/resumen', resumenSesion);

module.exports = router;