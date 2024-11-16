
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


-- booking table create and relations
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,                  -- Auto-increment ID for each booking
    guide_id INT NOT NULL,                              -- Foreign key connected to users table (guide)
    visitor_id INT NOT NULL,                            -- Foreign key connected to users table (visitor)
    rate TINYINT CHECK (rate BETWEEN 1 AND 10),         -- Rating between 1 and 10
    review TEXT,                                        -- Optional review text
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- Timestamp of booking creation
    FOREIGN KEY (guide_id) REFERENCES user(id)          -- Connect guide_id to user(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (visitor_id) REFERENCES user(id)        -- Connect visitor_id to user(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

--first booking
INSERT INTO bookings (guide_id, visitor_id, rate, review)
VALUES (1, 2, 8, 'Great tour! Very knowledgeable guide.');

--tests
GET https://youthfulguides.app/api/User/GetUserByUserId/1
POST https://youthfulguides.app/api/User/CreateNewUser
        {
    "username": "john_doe",
    "email": "john.doe@example.com",
    "password": "securepassword123",
    "role": "visitor"
    }
PUT https://youthfulguides.app/api/User/UpdateUser/2
        {
    "username": "john_doe_updated",
    "email": "john.doe@exampl2e.com",
    "password": "newsecurepassword123",
    "role": "visitor"
    }
DELETE https://youthfulguides.app/api/User/DeleteUserById/3
GET https://youthfulguides.app/api/User/GetAllBookings



POST https://youthfulguides.app/api/User/CreateNewBooking
{
  "guide_id": 1,
  "visitor_id": 2,
  "rate": 10,
  "review": "Amazing experience!"
}

https://youthfulguides.app/api/User/UpdateBooking/1

{
  "rate": 8,
  "review": "Updated review: Great guide, but a bit rushed."
}