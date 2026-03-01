const express = require('express');
require('dotenv').config();

const sesionRoutes = require('./routes/sesion');
const ventaRoutes = require('./routes/venta');

const app = express();
app.use(express.json());

app.use('/sesion', sesionRoutes);
app.use('/venta', ventaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});




