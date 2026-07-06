const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔌 DB Config Diagnostics:');
console.log('   - Host:', process.env.DB_HOST || 'localhost');
console.log('   - Port:', process.env.DB_PORT || 3306);
console.log('   - User:', process.env.DB_USER || 'root');
console.log('   - Password Provided:', process.env.DB_PASSWORD ? 'YES (Length: ' + process.env.DB_PASSWORD.length + ')' : 'NO');
console.log('   - Database:', process.env.DB_NAME || 'smartstay_db');

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

// Immediately verify DB connectivity
pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to MySQL database pool.');
        connection.release();
    })
    .catch(err => {
        console.error('\n================================================================');
        console.error('❌ FATAL DATABASE CONNECTION ERROR:', err.message);
        console.error('----------------------------------------------------------------');
        console.error('Troubleshooting Guide:');
        console.error('1. Check if MySQL Server is running (e.g., MySQL Workbench or XAMPP).');
        console.error('2. Open your backend/.env file and check DB_USER and DB_PASSWORD.');
        console.error('   For MySQL Workbench / MySQL Server Community Installer setups,');
        console.error('   you set a custom password for the \'root\' account during installation.');
        console.error('   Change DB_PASSWORD=your_actual_mysql_root_password in backend/.env.');
        console.error('3. Make sure the database "smartstay_db" is created.');
        console.error('   Log into MySQL Workbench or mysql CLI and execute:');
        console.error('   CREATE DATABASE smartstay_db;');
        console.error('================================================================\n');
    });

module.exports = pool;
