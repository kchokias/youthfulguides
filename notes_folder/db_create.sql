
-- current version of create table
CREATE TABLE user (
    id INT AUTO_INCREMENT PRIMARY KEY, -- Auto-increment ID for unique identification
    username VARCHAR(50) NOT NULL,    -- Username of the user
    email VARCHAR(100) NOT NULL UNIQUE, -- Email address, unique for each user
    password VARCHAR(255) NOT NULL,   -- Password (hashed for security)
    role ENUM('guide', 'visitor') DEFAULT 'visitor', -- Role (guide or visitor), default to 'visitor'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp of user creation
);

-- first insert on the table
INSERT INTO user (username, email, password, role)
VALUES
('guide_user', 'guide@example.com', 'hashed_password_1', 'guide'),
('visitor_user', 'visitor@example.com', 'hashed_password_2', 'visitor');