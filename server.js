require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the "public" folder
app.use(express.static('public'));

//////////////////////////////////////
//ROUTES TO SERVE HTML FILES
//////////////////////////////////////
// Default route to serve logon.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/logon.html');
});

// Route to serve dashboard.html
app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});
//////////////////////////////////////
//END ROUTES TO SERVE HTML FILES
//////////////////////////////////////


/////////////////////////////////////////////////
//HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////
// Helper function to create a MySQL connection
async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

// **Authorization Middleware: Verify JWT Token and Check User in Database**
async function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        try {
            const connection = await createConnection();

            // Query the database to verify that the username is associated with an active account
            const [rows] = await connection.execute(
                'SELECT username FROM user WHERE username = ?',
                [decoded.username]
            );

            await connection.end();  // Close connection

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;  // Save the decoded username for use in the route
            next();  // Proceed to the next middleware or route handler
        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });
}
/////////////////////////////////////////////////
//END HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////


//////////////////////////////////////
//ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////
// Route: Create Account
app.post('/api/create-account', async (req, res) => {
    const { firstname, lastname, username, birthday, password } = req.body;

    if (!firstname || !lastname || !username || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const connection = await createConnection();
        const hashedPassword = await bcrypt.hash(password, 10);  // Hash password

        const [result] = await connection.execute(
            'INSERT INTO user (username, password, firstname, lastname, birthday) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, firstname, lastname, birthday || null]
        );

        await connection.end();  // Close connection

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'An account with this username already exists.' });
        } else {
            console.error(error);
            res.status(500).json({ message: 'Error creating account.' });
        }
    }
});

// Route: Logon
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM user WHERE username = ?',
            [username]
        );

        await connection.end();  // Close connection

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Get All username Addresses
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute('SELECT username FROM user');

        await connection.end();  // Close connection

        const usernameList = rows.map((row) => row.username);
        res.status(200).json({ usernames: usernameList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving usernames.' });
    }
});

// Route: Get the logged-in user's profile (never returns the password)
app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT username, firstname, lastname, birthday, theme, created_at, profile_picture FROM user WHERE username = ?',
            [req.user.username]
        );

        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ currentUser: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving profile.' });
    }
});

// Route: Update the logged-in user's username, first name and last name
app.patch('/api/users/me', authenticateToken, async (req, res) => {
    const { username, firstname, lastname, profile_picture } = req.body;

    const valid = [username, firstname, lastname].every(
        (v) => typeof v === 'string' && v.trim().length > 0
    );
    if (!valid) {
        return res.status(400).json({
            message: 'Username, first name, and last name are required.'
        });
    }

    const newUsername = username.trim();

    try {
        const connection = await createConnection();

        await connection.execute(
            'UPDATE user SET username = ?, firstname = ?, lastname = ?, profile_picture = COALESCE(?, profile_picture) WHERE username = ?',
            [newUsername, firstname.trim(), lastname.trim(), profile_picture ?? null, req.user.username]
        );

        const [rows] = await connection.execute(
            'SELECT username, firstname, lastname, birthday, theme, created_at, profile_picture FROM user WHERE username = ?',
            [newUsername]
        );

        await connection.end();

        // The token contains the username, so issue a new one
        // if it changed; otherwise the old token would stop working.
        const token = jwt.sign(
            { username: newUsername },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ currentUser: rows[0], token });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'That username is already taken.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Error updating profile.' });
    }
});
//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});