const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function getUserId(username) {
    if (!username) return null;
    try {
        const result = await pool.query(
            'SELECT user_id FROM users WHERE username = $1',
            [username]
        );
        return result.rows.length > 0 ? result.rows[0].user_id : null;
    } catch (err) {
        console.error('Error fetching user ID:', err);
        return null;
    }
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    getUserId,
};
