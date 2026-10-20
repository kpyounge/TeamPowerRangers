CREATE TABLE `user` (
    email VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    birthday DATE,
    theme VARCHAR(10) DEFAULT 'dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);