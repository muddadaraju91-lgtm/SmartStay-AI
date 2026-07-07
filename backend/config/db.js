const mysql = require('mysql2/promise');
require('dotenv').config();

// Only emit diagnostic output in development or when DEBUG_DB is explicitly set.
// Never log credentials or full connection strings — not even in dev mode.
// In production these lines must be completely silent so that infrastructure
// details (host, user, db name) do not appear in log aggregators or APM tools.
const isDev = process.env.NODE_ENV !== 'production' || process.env.DEBUG_DB === 'true';

if (isDev) {
    console.log('[db] Connecting to MySQL:');
    console.log('   host    :', process.env.DB_HOST || 'localhost');
    console.log('   port    :', process.env.DB_PORT || 3306);
    // DB name is useful for debugging "wrong database" errors; safe to log.
    console.log('   database:', process.env.DB_NAME || 'smartstay_db');
    // NOTE: DB_USER and DB_PASSWORD are intentionally omitted — even in dev,
    // credentials must not appear in process stdout / log files.
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'smartstay_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Immediately verify DB connectivity on startup
pool.getConnection()
    .then(connection => {
        if (isDev) {
            console.log('[db] MySQL connection pool established.');
        }
        connection.release();
    })
    .catch(err => {
        if (isDev) {
            // Full troubleshooting guide is only useful during local development.
            console.error('\n================================================================');
            console.error('[db] FATAL: Could not connect to MySQL:', err.message);
            console.error('----------------------------------------------------------------');
            console.error('Troubleshooting:');
            console.error('1. Check that your MySQL server is running (Workbench / XAMPP).');
            console.error('2. Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in');
            console.error('   backend/.env — do NOT commit that file to version control.');
            console.error('3. Ensure the database exists:');
            console.error('   CREATE DATABASE smartstay_db;');
            console.error('================================================================\n');
        } else {
            // In production: emit one terse line with no infrastructure details.
            // The error code (e.g. ER_ACCESS_DENIED, ECONNREFUSED) is enough for
            // on-call triage without leaking host/user/db names to log aggregators.
            console.error('[db] FATAL: MySQL connection failed. code=%s', err.code || 'UNKNOWN');
        }
    });

module.exports = pool;
