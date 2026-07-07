-- Create Database

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'owner', 'admin') NOT NULL,
    phone VARCHAR(15) NOT NULL,
    -- college_id links student accounts to their enrolled institution.
    -- Populated during registration or profile update; used by the recommendations
    -- endpoint to derive a geographic origin when no lat/lng is supplied by the client.
    -- NULL for owner/admin accounts and students who have not set their college yet.
    college_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Hostels Table
CREATE TABLE IF NOT EXISTS hostels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    description TEXT,
    amenities VARCHAR(500) DEFAULT '[]', -- JSON string containing amenities array
    is_verified BOOLEAN DEFAULT FALSE,
    trust_score DECIMAL(5, 2) DEFAULT 60.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_hostel_coords (latitude, longitude),
    INDEX idx_hostel_verified_score (is_verified, trust_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hostel_id INT NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,
    total_rooms INT NOT NULL,
    vacant_rooms INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
    INDEX idx_room_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    room_id INT NOT NULL,
    check_in_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'paid', 'cancelled') DEFAULT 'pending',
    payment_mode ENUM('online', 'offline') NOT NULL,
    razorpay_order_id VARCHAR(100) UNIQUE DEFAULT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_booking_student (student_id),
    INDEX idx_booking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    razorpay_payment_id VARCHAR(100) UNIQUE DEFAULT NULL,
    razorpay_signature VARCHAR(255) DEFAULT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX idx_payment_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    hostel_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified_booking BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
    INDEX idx_review_hostel (hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message VARCHAR(255) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Colleges Table
CREATE TABLE IF NOT EXISTS colleges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_college_coords (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    hostel_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
    UNIQUE KEY uq_student_hostel (student_id, hostel_id),
    INDEX idx_wishlist_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO colleges (name, city, state, latitude, longitude)
VALUES
('Andhra University','Visakhapatnam','Andhra Pradesh',17.7289,83.3165),
('GITAM University','Visakhapatnam','Andhra Pradesh',17.7816,83.3769),
('Gayatri Vidya Parishad College of Engineering','Visakhapatnam','Andhra Pradesh',17.8200,83.3400),
('ANITS','Visakhapatnam','Andhra Pradesh',17.8208,83.3427),
('Raghu Engineering College','Visakhapatnam','Andhra Pradesh',17.9230,83.4250),
('Raghu Institute of Technology','Visakhapatnam','Andhra Pradesh',17.9210,83.4220),
('Vignan Institute of Information Technology','Visakhapatnam','Andhra Pradesh',17.8840,83.4290),
('Vignan Institute of Engineering for Women','Visakhapatnam','Andhra Pradesh',17.8830,83.4280),
('Avanthi Institute of Engineering and Technology','Visakhapatnam','Andhra Pradesh',17.9050,83.4380),
('BABA Institute of Technology and Sciences','Visakhapatnam','Andhra Pradesh',17.9000,83.4100),
('VITS','Visakhapatnam','Andhra Pradesh',17.8950,83.4120),
('St Josephs College for Women','Visakhapatnam','Andhra Pradesh',17.7220,83.3010),
('Mrs AVN College','Visakhapatnam','Andhra Pradesh',17.7110,83.2980),
('Dr Lankapalli Bullayya College','Visakhapatnam','Andhra Pradesh',17.7420,83.3380),
('Dadi Institute of Engineering and Technology','Visakhapatnam','Andhra Pradesh',17.9300,83.4320),
('Sanketika Vidya Parishad','Visakhapatnam','Andhra Pradesh',17.7550,83.3370),
('AQJ Centre for PG Studies','Visakhapatnam','Andhra Pradesh',17.7420,83.3360),
('Samata College','Visakhapatnam','Andhra Pradesh',17.7700,83.3150),
('TSR and TBK Degree College','Visakhapatnam','Andhra Pradesh',17.7450,83.3120),
('Chaitanya Engineering College','Visakhapatnam','Andhra Pradesh',17.9150,83.4300),
('Pydah College','Visakhapatnam','Andhra Pradesh',17.8900,83.4250),
('Gonna Institute of Information Technology','Visakhapatnam','Andhra Pradesh',17.8800,83.4200),
('GVP Degree College','Visakhapatnam','Andhra Pradesh',17.7480,83.3370),
('Andhra University College of Engineering','Visakhapatnam','Andhra Pradesh',17.7290,83.3170),
('SIMS College','Visakhapatnam','Andhra Pradesh',17.7600,83.3200);

-- Foreign-key constraint is handled in init_db.js safely.
