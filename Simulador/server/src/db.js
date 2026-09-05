import mysql from 'mysql2/promise';

// ============================================================
// Pool de conexiones a MySQL (contenedor simulacion_2D_db).
// Las credenciales llegan por variables de entorno.
// ============================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'sugoi',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'simulacion_2D',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

/**
 * Reintenta la conexión inicial hasta que MySQL esté listo.
 * (El healthcheck del compose debería evitarlo, pero es un seguro.)
 */
export async function connectWithRetry(retries = 15, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] Conexión a MySQL establecida.');
      return pool;
    } catch (err) {
      console.warn(`[db] Reintento ${i + 1}/${retries}... ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('No se pudo conectar a MySQL tras varios intentos.');
}

export default pool;
