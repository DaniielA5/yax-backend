const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
async function verificarSesionAbierta(conn, id_sesion) {
  const [[sesion]] = await conn.execute(
    `SELECT estado FROM sesion_caja WHERE id_sesion = ?`,
    [id_sesion]
  );

  if (!sesion) throw new Error('Sesión no encontrada');
  if (sesion.estado !== 'ABIERTA') throw new Error('La sesión ya está cerrada');
}

module.exports = { pool, verificarSesionAbierta };
 // un pool maneja multiples requests simul_automati_te