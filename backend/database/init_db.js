const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initDatabase() {
    console.log('🔄 Initializing SmartStay AI Database Setup...');

    // Connection parameters (without database first)
    const connectionConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true // Allow executing entire files in one query
    };

    let connection;
    try {
        // Connect to MySQL server
        connection = await mysql.createConnection(connectionConfig);
        console.log('✅ Connected to MySQL server successfully.');

        const dbName = process.env.DB_NAME || 'smartstay_db';

        // Create Database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`✅ Database "${dbName}" checked/created.`);

        // Switch to the database
        await connection.query(`USE \`${dbName}\`;`);

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`schema.sql not found at path: ${schemaPath}`);
        }

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Execute the entire schema file contents
        await connection.query(schemaSql);
        console.log('✅ All MySQL database tables and indexes initialized successfully.');

        // Safely add the college_id column to users if it doesn't exist (for existing databases)
        const [colCheck] = await connection.query(`
            SELECT NULL FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'college_id'
        `, [dbName]);

        if (colCheck.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN college_id INT DEFAULT NULL`);
            console.log('✅ Added college_id column to users table.');
        }

        // Safely add the foreign key for colleges if it doesn't exist
        const [fkCheck] = await connection.query(`
            SELECT NULL FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = 'fk_users_college' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        `, [dbName]);

        if (fkCheck.length === 0) {
            await connection.query(`
                ALTER TABLE users ADD CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL;
            `);
            console.log('✅ Added foreign key fk_users_college.');
        }

        // Insert a default admin and test student account for easy testing

        const bcrypt = require('bcryptjs');

        const [users] = await connection.query(
            'SELECT COUNT(*) AS total FROM users'
        );

        if (users[0].total === 0) {

            console.log('📝 Seeding initial user accounts...');

            const salt = await bcrypt.genSalt(10);

            const adminPass = await bcrypt.hash('admin123', salt);

            const studentPass = await bcrypt.hash('rahul123', salt);

            const ownerPass = await bcrypt.hash('owner123', salt);

            await connection.query(

                `INSERT INTO users

        (name, email, password, role, phone)

        VALUES

        ('System Admin', 'admin@smartstay.com', ?, 'admin', '9999999999'),

        ('Rahul Kumar', 'rahul@christuniversity.com', ?, 'student', '8888888888'),

        ('Hostel Owner', 'owner@smartstay.com', ?, 'owner', '7777777777')`,

                [adminPass, studentPass, ownerPass]

            );

            console.log('✅ Seeded default accounts:');

            console.log('   - Admin: admin@smartstay.com (password: admin123)');

            console.log('   - Student: rahul@christuniversity.com (password: rahul123)');

            console.log('   - Owner: owner@smartstay.com (password: owner123)');

        }

    } catch (err) {
        console.error('\n================================================================');
        console.error('❌ DATABASE SETUP ERROR:', err.message);
        console.error('----------------------------------------------------------------');
        console.error('Troubleshooting Tips:');
        console.error('1. Check if MySQL server is running.');
        console.error('2. Check DB_USER and DB_PASSWORD credentials in backend/.env.');
        console.error('3. Make sure the root user has rights to create databases.');
        console.error('================================================================\n');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed.');
        }
    }
}

initDatabase();
