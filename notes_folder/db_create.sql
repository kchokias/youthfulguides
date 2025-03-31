
-- current version of create table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY, -- Auto-increment ID as primary key
    name VARCHAR(50) NOT NULL, -- First name of the user
    surname VARCHAR(50) NOT NULL, -- Surname (last name) of the user
    username VARCHAR(50) NOT NULL, -- Username of the user
    email VARCHAR(100) NOT NULL UNIQUE, -- Email address, unique but not primary key
    password VARCHAR(255) NOT NULL, -- Password (hashed for security)
    role ENUM('guide', 'visitor', 'admin') DEFAULT 'visitor', -- Role (guide, visitor, or admin), default to 'visitor'
    region VARCHAR(100), -- Region of the user
    country VARCHAR(100), -- Country of the user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp for record creation
);
-- first insert on the table
INSERT INTO user (name, surname, username, email, password, role, region, country, created_at) 
VALUES 
('John', 'Doe', 'johndoe', 'john.doe@example.com', 'hashedpassword123', 'admin', 'Crete', 'Greece', NOW()),
('Maria', 'Smith', 'mariasmith', 'maria.smith@example.com', 'hashedpassword456', 'guide', 'Athens', 'Greece', NOW()),
('Alex', 'Johnson', 'alexjohnson', 'alex.johnson@example.com', 'hashedpassword789', 'visitor', 'Thessaloniki', 'Greece', NOW());


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

CREATE TABLE media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guide_id INT NOT NULL,
    media_data TEXT NOT NULL, -- Stores Base64-encoded images
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guide_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE profile_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE, -- Each user has only one profile photo
    photo_data TEXT NOT NULL, -- Stores Base64-encoded profile photo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE guide_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guide_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('available', 'unavailable', 'booked') NOT NULL DEFAULT 'available',
    FOREIGN KEY (guide_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE (guide_id, date)
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



LOGIN
	Request Type: POST
	2.	Endpoint: https://youthfulguides.app/api/User/Login
	3.	Headers:
	•	Content-Type: application/json
	4.	Body (JSON):
        {
        "email": "admin@example.com",
        "password": "securepassword"
        }

    Test the GetAllUsers API
	1.	Request Type: GET
	2.	Endpoint: https://youthfulguides.app/api/User/GetAllUsers
	3.	Headers:
	•	Authorization: Bearer <your_token> (replace <your_token> with the token you copied from the login response).
	•	Content-Type: application/json
	4.	Send the Request in Postman.



