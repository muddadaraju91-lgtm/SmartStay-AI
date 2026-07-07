const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedMoreHostels() {
    console.log('Seeding more hostels for real-time usage...');
    
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
            database: process.env.DB_NAME || 'smartstay_db'
        });

        // Ensure owner exists
        const [owners] = await connection.query("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
        if (owners.length === 0) {
            console.log("No owner found. Please run init_db.js first.");
            return;
        }
        const ownerId = owners[0].id;

        // Get all colleges
        const [colleges] = await connection.query("SELECT id, name, city, latitude, longitude FROM colleges");
        
        let hostelsInserted = 0;
        let roomsInserted = 0;

        for (const college of colleges) {
            // Generate 3 hostels near each college
            for (let i = 1; i <= 3; i++) {
                // Random offset between -0.015 and +0.015 (roughly up to 1.5 km)
                const latOffset = (Math.random() * 0.03) - 0.015;
                const lngOffset = (Math.random() * 0.03) - 0.015;
                
                const lat = parseFloat(college.latitude) + latOffset;
                const lng = parseFloat(college.longitude) + lngOffset;
                
                const hostelNames = ['Premium Stay', 'Comfort PG', 'Student Hub', 'Scholar Residence', 'Campus View Hostel', 'Royal Stay', 'Elite PG', 'Green Woods PG'];
                const randomName = hostelNames[Math.floor(Math.random() * hostelNames.length)] + ` near ${college.name.substring(0, 15)}`;
                
                const amenitiesLists = [
                    '["WiFi", "Food", "AC", "Laundry"]',
                    '["WiFi", "Food", "Parking"]',
                    '["WiFi", "Gym", "Security"]',
                    '["Food", "Laundry", "Parking", "AC"]',
                    '["WiFi", "Food"]'
                ];
                const amenities = amenitiesLists[Math.floor(Math.random() * amenitiesLists.length)];
                
                const score = (75 + Math.random() * 25).toFixed(2); // 75 to 100

                const [result] = await connection.query(
                    `INSERT INTO hostels (owner_id, name, address, latitude, longitude, description, amenities, is_verified, trust_score) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [
                        ownerId, 
                        randomName, 
                        `Near ${college.name}, ${college.city}`, 
                        lat.toFixed(6), 
                        lng.toFixed(6), 
                        `A comfortable and safe stay right next to ${college.name}. Ideal for students looking for quick campus access.`, 
                        amenities,
                        score
                    ]
                );
                
                const hostelId = result.insertId;
                hostelsInserted++;

                // Add 2-3 room types for this hostel
                const numRooms = Math.floor(Math.random() * 2) + 2; // 2 or 3
                for (let r = 1; r <= numRooms; r++) {
                    const capacities = [1, 2, 3, 4];
                    const capacity = capacities[r - 1] || 2;
                    
                    // Price based on capacity (single is more expensive)
                    const basePrice = 10000 - (capacity * 1500) + (Math.floor(Math.random() * 1000));
                    
                    const totalRooms = 10 + Math.floor(Math.random() * 30);
                    const vacantRooms = Math.floor(Math.random() * 15);
                    
                    await connection.query(
                        `INSERT INTO rooms (hostel_id, type_name, capacity, price, total_rooms, vacant_rooms) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            hostelId, 
                            capacity === 1 ? 'Single Sharing' : capacity === 2 ? 'Double Sharing' : capacity === 3 ? 'Triple Sharing' : 'Four Sharing', 
                            capacity, 
                            basePrice, 
                            totalRooms, 
                            vacantRooms
                        ]
                    );
                    roomsInserted++;
                }
            }
        }
        
        console.log(`✅ Successfully seeded ${hostelsInserted} new hostels and ${roomsInserted} rooms!`);

    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        if (connection) await connection.end();
    }
}

seedMoreHostels();
