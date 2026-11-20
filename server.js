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

function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({
            message: 'Access denied. No token provided.'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                message: 'Invalid token.'
            });
        }

        req.user = {
            user_id: decoded.user_id,
            username: decoded.username
        };

        next();
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

        const userId = result.insertId;

    const defaultStacks = [
        ['Morning', 1],
        ['Afternoon', 2],
        ['Evening', 3],
        ['Night', 4]
    ];

for (const [stackName, sortOrder] of defaultStacks) {
    await connection.execute(
        `INSERT INTO habit_stack
         (user_id, stack_name, sort_order)
         VALUES (?, ?, ?)`,
        [userId, stackName, sortOrder]
    );
}

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
            { user_id: user.user_id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Forgot Password (verify identity, then set a new hashed password)
app.post('/api/forgot-password', async (req, res) => {
    const { username, firstname, lastname, birthday, newPassword, confirmPassword } = req.body;

    if (!username || !firstname || !lastname || !birthday || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
    }

    try {
        const connection = await createConnection();

        // All four details must match the same account
        const [rows] = await connection.execute(
            'SELECT username FROM user WHERE username = ? AND firstname = ? AND lastname = ? AND birthday = ?',
            [username, firstname, lastname, birthday]
        );

        if (rows.length === 0) {
            await connection.end();
            return res.status(401).json({ message: 'The information you entered does not match an existing account.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE user SET password = ? WHERE username = ?',
            [hashedPassword, rows[0].username]
        );

        await connection.end();

        res.status(200).json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error resetting password.' });
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
            'SELECT username, firstname, lastname, birthday, theme, created_at, profile_picture, tutorial_status, graduation_days FROM user WHERE username = ?',
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
            'UPDATE user SET username = ?, firstname = ?, lastname = ?, profile_picture = COALESCE(?, profile_picture) WHERE user_id = ?',
            [newUsername, firstname.trim(), lastname.trim(), profile_picture ?? null, req.user.user_id]
        );

  

        const [rows] = await connection.execute(
            'SELECT username, firstname, lastname, birthday, theme, created_at, profile_picture, tutorial_status, graduation_days FROM user WHERE username = ?',
            [newUsername]
        );

        await connection.end();

        // The token contains the username, so issue a new one
        // if it changed; otherwise the old token would stop working.
        const token = jwt.sign(
            { user_id: req.user.user_id, username: newUsername },
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

// Route: Save how far the user is through the first-time tutorial.
// The status can only move forward: new -> first_habit -> complete.
const TUTORIAL_STATUSES = ['new', 'first_habit', 'complete'];

app.patch('/api/users/me/tutorial', authenticateToken, async (req, res) => {
    const { status } = req.body || {};
    if (!TUTORIAL_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid tutorial status.' });
    }

    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT tutorial_status FROM user WHERE user_id = ?',
            [req.user.user_id]
        );

        if (rows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'User not found.' });
        }

        let current = rows[0].tutorial_status;
        if (TUTORIAL_STATUSES.indexOf(status) > TUTORIAL_STATUSES.indexOf(current)) {
            await connection.execute(
                'UPDATE user SET tutorial_status = ? WHERE user_id = ?',
                [status, req.user.user_id]
            );
            current = status;
        }

        await connection.end();
        res.status(200).json({ tutorial_status: current });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error saving tutorial progress.' });
    }
});

// Route: Save the user's preferences. For now that is the graduation
// length: how many days of streak an in-progress habit needs before it
// becomes an existing habit. 0 means "no graduation".
const GRADUATION_OPTIONS = [0, 10, 20, 30, 60, 90];

app.patch('/api/users/me/preferences', authenticateToken, async (req, res) => {
    const { graduation_days } = req.body || {};
    if (!GRADUATION_OPTIONS.includes(graduation_days)) {
        return res.status(400).json({ message: 'Please choose a valid graduation length.' });
    }

    try {
        const connection = await createConnection();
        await connection.execute(
            'UPDATE user SET graduation_days = ? WHERE user_id = ?',
            [graduation_days, req.user.user_id]
        );
        await connection.end();

        res.status(200).json({ graduation_days });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error saving preferences.' });
    }
});

// Makes sure every user has the four original stacks and moves
// older habits into the correct stack based on time of day.
async function ensureDefaultStacks(connection, userId) {
    const [existingStacks] = await connection.execute(
        `SELECT stack_id, stack_name
         FROM habit_stack
         WHERE user_id = ?`,
        [userId]
    );

    // If the user has no stacks yet, create the original four.
    if (existingStacks.length === 0) {
        const defaultStacks = [
            ['Morning', 1],
            ['Afternoon', 2],
            ['Evening', 3],
            ['Night', 4]
        ];

        for (const [name, order] of defaultStacks) {
            await connection.execute(
                `INSERT INTO habit_stack
                 (user_id, stack_name, sort_order)
                 VALUES (?, ?, ?)`,
                [userId, name, order]
            );
        }
    }

    // Get the user's stacks again so we have their stack IDs.
    const [stacks] = await connection.execute(
        `SELECT stack_id, stack_name
         FROM habit_stack
         WHERE user_id = ?`,
        [userId]
    );

    const stackByName = {};

    stacks.forEach(stack => {
        stackByName[stack.stack_name.toLowerCase()] = stack.stack_id;
    });

    // Move old habits with no stack into their matching original stack.
    for (const time of ['morning', 'afternoon', 'evening', 'night']) {
        const stackId = stackByName[time];

        if (stackId) {
            await connection.execute(
                `UPDATE habit
                 SET stack_id = ?
                 WHERE user_id = ?
                   AND stack_id IS NULL
                   AND time_of_day = ?`,
                [stackId, userId, time]
            );
        }
    }
}


// ---------- HABIT STACKS ----------

// Get all stacks for the logged-in user
app.get('/api/stacks', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        
        const [rows] = await connection.execute(
            `SELECT stack_id, stack_name, sort_order,color
             FROM habit_stack
             WHERE user_id = ?
             ORDER BY sort_order, stack_id`,
            [req.user.user_id]
        );

        await connection.end();
        res.status(200).json({ stacks: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving stacks.' });
    }
});

// Create a new stack
app.post('/api/stacks', authenticateToken, async (req, res) => {
    const stackName = String(req.body?.stack_name || '').trim();
    const color = String(req.body?.color || 'green').toLowerCase();

    const validColors = [
        'cyan',
        'pink',
        'purple',
        'orange',
        'green'
    ];

    if (!stackName) {
        return res.status(400).json({
            message: 'Stack name is required.'
        });
    }

    if (stackName.length > 100) {
        return res.status(400).json({
            message: 'Stack name is too long.'
        });
    }

    if (!validColors.includes(color)) {
        return res.status(400).json({
            message: 'Please choose a valid stack color.'
        });
    }

    try {
        const connection = await createConnection();

        const [[max]] = await connection.execute(
            `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
             FROM habit_stack
             WHERE user_id = ?`,
            [req.user.user_id]
        );

        const [result] = await connection.execute(
            `INSERT INTO habit_stack
             (user_id, stack_name, sort_order, color)
             VALUES (?, ?, ?, ?)`,
            [
                req.user.user_id,
                stackName,
                max.maxOrder + 1,
                color
            ]
        );

        const [rows] = await connection.execute(
            `SELECT stack_id, stack_name, sort_order, color
             FROM habit_stack
             WHERE stack_id = ?`,
            [result.insertId]
        );

        await connection.end();

        res.status(201).json({
            stack: rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Error creating stack.'
        });
    }
});


// Rename a stack
app.patch('/api/stacks/:id', authenticateToken, async (req, res) => {
    const stackId = Number(req.params.id);
    const stackName = String(req.body?.stack_name || '').trim();

    if (!Number.isInteger(stackId)) {
        return res.status(400).json({ message: 'Invalid stack id.' });
    }

    if (!stackName) {
        return res.status(400).json({ message: 'Stack name is required.' });
    }

    if (stackName.length > 100) {
        return res.status(400).json({ message: 'Stack name is too long.' });
    }

    try {
        const connection = await createConnection();

        const [result] = await connection.execute(
            'UPDATE habit_stack SET stack_name = ? WHERE stack_id = ? AND user_id = ?',
            [stackName, stackId, req.user.user_id]
        );

        if (result.affectedRows === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Stack not found.' });
        }

        await connection.end();

        res.status(200).json({
            stack: {
                stack_id: stackId,
                stack_name: stackName
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error renaming stack.' });
    }
});

// Change a stack's color
app.patch('/api/stacks/:stackId/color', authenticateToken, async (req, res) => {
    const stackId = Number(req.params.stackId);
    const color = String(req.body?.color || '').toLowerCase();

    const validColors = [
        'cyan',
        'pink',
        'purple',
        'orange',
        'green'
    ];

    if (!Number.isInteger(stackId) || stackId <= 0) {
        return res.status(400).json({
            message: 'Invalid stack.'
        });
    }

    if (!validColors.includes(color)) {
        return res.status(400).json({
            message: 'Please choose a valid stack color.'
        });
    }

    try {
        const connection = await createConnection();

        const [result] = await connection.execute(
            `UPDATE habit_stack
             SET color = ?
             WHERE stack_id = ? AND user_id = ?`,
            [
                color,
                stackId,
                req.user.user_id
            ]
        );

        if (result.affectedRows === 0) {
            await connection.end();

            return res.status(404).json({
                message: 'Stack not found.'
            });
        }

        const [rows] = await connection.execute(
            `SELECT stack_id, stack_name, sort_order, color
             FROM habit_stack
             WHERE stack_id = ? AND user_id = ?`,
            [
                stackId,
                req.user.user_id
            ]
        );

        await connection.end();

        res.json({
            stack: rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Error changing stack color.'
        });
    }
});


// Reorder stacks
app.put('/api/stacks/reorder', authenticateToken, async (req, res) => {
    const { ids } = req.body || {};

    if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        !ids.every(Number.isInteger) ||
        new Set(ids).size !== ids.length
    ) {
        return res.status(400).json({
            message: 'A list of stack ids is required.'
        });
    }

    let connection;

    try {
        connection = await createConnection();

        // Make sure every stack belongs to the logged-in user
        const [rows] = await connection.execute(
            `SELECT stack_id
             FROM habit_stack
             WHERE user_id = ?
             ORDER BY sort_order, stack_id`,
            [req.user.user_id]
        );

        if (rows.length !== ids.length) {
            return res.status(400).json({
                message: 'Send every stack in the new order.'
            });
        }

        const ownedIds = new Set(
            rows.map(row => row.stack_id)
        );

        if (ids.some(id => !ownedIds.has(id))) {
            return res.status(403).json({
                message: 'Invalid stack.'
            });
        }

        await connection.beginTransaction();

        // Give each stack its new position
        for (let i = 0; i < ids.length; i++) {
            await connection.execute(
                `UPDATE habit_stack
                 SET sort_order = ?
                 WHERE stack_id = ? AND user_id = ?`,
                [i + 1, ids[i], req.user.user_id]
            );
        }

        await connection.commit();

        res.status(200).json({
            message: 'Stack order saved.'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback().catch(() => {});
        }

        console.error(error);

        res.status(500).json({
            message: 'Error saving stack order.'
        });

    } finally {
        if (connection) {
            await connection.end().catch(() => {});
        }
    }
});
// Delete a stack and all habits inside it
app.delete('/api/stacks/:id', authenticateToken, async (req, res) => {
    const stackId = Number(req.params.id);

    if (!Number.isInteger(stackId)) {
        return res.status(400).json({ message: 'Invalid stack id.' });
    }

    let connection;

    try {
        connection = await createConnection();

        // Make sure this stack belongs to the logged-in user
        const [stackRows] = await connection.execute(
            'SELECT stack_id FROM habit_stack WHERE stack_id = ? AND user_id = ?',
            [stackId, req.user.user_id]
        );

        if (stackRows.length === 0) {
            return res.status(404).json({ message: 'Stack not found.' });
        }

        await connection.beginTransaction();

        // Delete check history for habits inside this stack
        await connection.execute(
            `DELETE hc
             FROM habit_check hc
             JOIN habit h ON hc.habit_id = h.habit_id
             WHERE h.stack_id = ?
               AND h.user_id = ?`,
            [stackId, req.user.user_id]
        );

        // Delete all habits inside the stack
        const [habitResult] = await connection.execute(
            'DELETE FROM habit WHERE stack_id = ? AND user_id = ?',
            [stackId, req.user.user_id]
        );

        // Delete the stack itself
        await connection.execute(
            'DELETE FROM habit_stack WHERE stack_id = ? AND user_id = ?',
            [stackId, req.user.user_id]
        );

        await connection.commit();

        res.status(200).json({
            message: 'Stack and habits deleted.',
            deletedHabits: habitResult.affectedRows
        });

    } catch (error) {
        if (connection) {
            await connection.rollback().catch(() => {});
        }

        console.error(error);
        res.status(500).json({
            message: 'Error deleting stack.'
        });

    } finally {
        if (connection) {
            await connection.end().catch(() => {});
        }
    }
});

// ---------- HABITS ----------
const HABIT_STATUSES = ['working_on', 'current'];
const HABIT_COLUMNS = 'habit_id AS id, habit_name AS name, status, streak, sort_order, stack_id';
// ---------- STREAKS ----------
function isValidDate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return false;
    }
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function shiftDate(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Counts the checks in a row going back from yesterday, then adds
// today if it is checked. One missed day resets it to 0.
function calculateStreak(checkedDates, today) {
    const checked = new Set(checkedDates);
    let streak = 0;
    let day = shiftDate(today, -1);
    while (checked.has(day)) {
        streak++;
        day = shiftDate(day, -1);
    }
    if (checked.has(today)) {
        streak++;
    }
    return streak;
}
// Checks the habit information sent from the add and edit forms.
function validateHabit(body) {
    const { name, status, stack_id } = body || {};

    if (typeof name !== 'string' || name.trim().length === 0) {
        return { error: 'Habit name is required.' };
    }

    if (name.trim().length > 255) {
        return { error: 'Habit name is too long.' };
    }

    if (!HABIT_STATUSES.includes(status)) {
        return { error: 'Please choose a valid status.' };
    }

    const stackId = Number(stack_id);

    if (!Number.isInteger(stackId)) {
        return { error: 'Please choose a stack.' };
    }

    return {
        name: name.trim(),
        status,
        stack_id: stackId
    };
}
// Returns the other unchecked habits in the same custom stack.
async function getUncheckedStackHabitIds(connection, userId, stackId, checkedHabitId, date) {
    const [rows] = await connection.execute(
        `SELECT h.habit_id
         FROM habit h
         LEFT JOIN habit_check c
           ON c.habit_id = h.habit_id
          AND c.check_date = ?
         WHERE h.user_id = ?
           AND h.stack_id = ?
           AND h.habit_id <> ?
           AND c.habit_id IS NULL
         ORDER BY h.sort_order, h.habit_id`,
        [date, userId, stackId, checkedHabitId]
    );

    return rows.map(row => row.habit_id);
}

// Route: Get the logged-in user's habits (in stack order).
// The page sends today's date as ?today=YYYY-MM-DD (the user's own date).
app.get('/api/habits', authenticateToken, async (req, res) => {
    const today = req.query.today;
    if (!isValidDate(today)) {
        return res.status(400).json({ message: 'A valid date is required.' });
    }

    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT ${HABIT_COLUMNS} FROM habit WHERE user_id = ? ORDER BY sort_order, habit_id`,
            [req.user.user_id]
        );

        const [checks] = await connection.execute(
            `SELECT c.habit_id, DATE_FORMAT(c.check_date, '%Y-%m-%d') AS check_date
             FROM habit_check c
             JOIN habit h ON h.habit_id = c.habit_id
             WHERE h.user_id = ?`,
            [req.user.user_id]
        );

        const datesByHabit = {};
        checks.forEach(c => {
            (datesByHabit[c.habit_id] = datesByHabit[c.habit_id] || []).push(c.check_date);
        });

        for (const habit of rows) {
            const dates = datesByHabit[habit.id] || [];
            const streak = calculateStreak(dates, today);
            habit.completed = dates.includes(today);

            // Save the streak if it changed (this is where a lost streak resets to 0)
            if (streak !== habit.streak) {
                await connection.execute(
                    'UPDATE habit SET streak = ? WHERE habit_id = ?',
                    [streak, habit.id]
                );
                habit.streak = streak;
            }
        }

        await connection.end();
        res.status(200).json({ habits: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving habits.' });
    }
});

// Route: Check or uncheck a habit for a day. Body: { date: 'YYYY-MM-DD', checked: true/false }
app.put('/api/habits/:id/check', authenticateToken, async (req, res) => {
    const habitId = Number(req.params.id);
    const { date, checked } = req.body || {};

    if (!Number.isInteger(habitId)) {
        return res.status(400).json({ message: 'Invalid habit id.' });
    }
    if (!isValidDate(date) || typeof checked !== 'boolean') {
        return res.status(400).json({ message: 'A valid date and checked value are required.' });
    }

    try {
        const connection = await createConnection();

        // Only the owner can check a habit
        const [existing] = await connection.execute(
            'SELECT habit_id, status, streak, time_of_day, sort_order, stack_id FROM habit WHERE habit_id = ? AND user_id = ?',
            [habitId, req.user.user_id]
        );
        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Habit not found.' });
        }

        if (checked) {
            await connection.execute(
                'INSERT IGNORE INTO habit_check (habit_id, check_date) VALUES (?, ?)',
                [habitId, date]
            );
        } else {
            await connection.execute(
                'DELETE FROM habit_check WHERE habit_id = ? AND check_date = ?',
                [habitId, date]
            );
        }

        const [checks] = await connection.execute(
            "SELECT DATE_FORMAT(check_date, '%Y-%m-%d') AS check_date FROM habit_check WHERE habit_id = ?",
            [habitId]
        );
        const streak = calculateStreak(checks.map(c => c.check_date), date);

        // Graduation: when an in-progress habit's streak REACHES the user's
        // graduation length, it becomes an existing habit for good. Only the
        // moment the streak crosses the line counts, so a habit the user later
        // sets back to "working on" by hand isn't graduated again right away.
        let status = existing[0].status;
        let graduated = false;
        if (checked && status === 'working_on') {
            const [[prefs]] = await connection.execute(
                'SELECT graduation_days FROM user WHERE user_id = ?',
                [req.user.user_id]
            );
            const graduationDays = prefs.graduation_days;
            if (graduationDays > 0 && existing[0].streak < graduationDays && streak >= graduationDays) {
                status = 'current';
                graduated = true;
            }
        }

        await connection.execute(
            'UPDATE habit SET streak = ?, status = ? WHERE habit_id = ?',
            [streak, status, habitId]
        );


     let skippedIds = [];

if (checked && existing[0].stack_id) {
    skippedIds = await getUncheckedStackHabitIds(
        connection,
        req.user.user_id,
        existing[0].stack_id,
        habitId,
        date
    );
}

await connection.end();

res.status(200).json({
    completed: checked,
    streak,
    status,
    graduated,
    skippedIds
}); 
        

   } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving check.' });
    }
    });


// Route: Edit a habit. If it is moved to a different stack, it is put
// at the end of the list so it lands at the bottom of its new stack.
app.patch('/api/habits/:id', authenticateToken, async (req, res) => {
    const habitId = Number(req.params.id);

    if (!Number.isInteger(habitId)) {
        return res.status(400).json({
            message: 'Invalid habit id.'
        });
    }

    const habit = validateHabit(req.body);

    if (habit.error) {
        return res.status(400).json({
            message: habit.error
        });
    }

    try {
        const connection = await createConnection();

        // Make sure the habit belongs to this user
        const [existing] = await connection.execute(
            `SELECT stack_id, sort_order
             FROM habit
             WHERE habit_id = ? AND user_id = ?`,
            [habitId, req.user.user_id]
        );

        if (existing.length === 0) {
            await connection.end();

            return res.status(404).json({
                message: 'Habit not found.'
            });
        }

        // Make sure the selected stack belongs to this user
        const [stackRows] = await connection.execute(
            `SELECT stack_id
             FROM habit_stack
             WHERE stack_id = ? AND user_id = ?`,
            [habit.stack_id, req.user.user_id]
        );

        if (stackRows.length === 0) {
            await connection.end();

            return res.status(400).json({
                message: 'Invalid stack.'
            });
        }

        let sortOrder = existing[0].sort_order;

        // If the habit moves stacks, place it at the end
        if (existing[0].stack_id !== habit.stack_id) {
            const [[max]] = await connection.execute(
                `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
                 FROM habit
                 WHERE user_id = ?`,
                [req.user.user_id]
            );

            sortOrder = max.maxOrder + 1;
        }

        await connection.execute(
            `UPDATE habit
             SET habit_name = ?,
                 status = ?,
                 sort_order = ?,
                 stack_id = ?
             WHERE habit_id = ? AND user_id = ?`,
            [
                habit.name,
                habit.status,
                sortOrder,
                habit.stack_id,
                habitId,
                req.user.user_id
            ]
        );

        const [rows] = await connection.execute(
            `SELECT ${HABIT_COLUMNS}
             FROM habit
             WHERE habit_id = ?`,
            [habitId]
        );

        await connection.end();

        res.status(200).json({
            habit: rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Error updating habit.'
        });
    }
});

// Route: Add a habit (goes to the end of its stack)
app.post('/api/habits', authenticateToken, async (req, res) => {
    const habit = validateHabit(req.body);

    if (habit.error) {
        return res.status(400).json({ message: habit.error });
    }

    try {
        const connection = await createConnection();

        // Make sure the selected stack belongs to this user
        const [stackRows] = await connection.execute(
            'SELECT stack_id FROM habit_stack WHERE stack_id = ? AND user_id = ?',
            [habit.stack_id, req.user.user_id]
        );

        if (stackRows.length === 0) {
            await connection.end();
            return res.status(400).json({
                message: 'Invalid stack.'
            });
        }

        // Put the new habit at the end
        const [[max]] = await connection.execute(
            'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM habit WHERE user_id = ?',
            [req.user.user_id]
        );

        const [result] = await connection.execute(
            `INSERT INTO habit
             (user_id, habit_name, status, sort_order, stack_id)
             VALUES (?, ?, ?, ?, ?)`,
            [
                req.user.user_id,
                habit.name,
                habit.status,
                max.maxOrder + 1,
                habit.stack_id
            ]
        );

        const [rows] = await connection.execute(
            `SELECT ${HABIT_COLUMNS}
             FROM habit
             WHERE habit_id = ?`,
            [result.insertId]
        );

        await connection.end();

        res.status(201).json({
            habit: rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Error adding habit.'
        });
    }
});


// Route: Edit a habit. If it is moved to a different stack, it is put
// at the end of the list so it lands at the bottom of its new stack.
app.patch('/api/habits/:id', authenticateToken, async (req, res) => {
    const habitId = Number(req.params.id);
    if (!Number.isInteger(habitId)) {
        return res.status(400).json({ message: 'Invalid habit id.' });
    }

    const habit = validateHabit(req.body);
    if (habit.error) {
        return res.status(400).json({ message: habit.error });
    }

    try {
        const connection = await createConnection();

        // Only the owner can edit a habit
        const [existing] = await connection.execute(
            'SELECT stack_id, sort_order FROM habit WHERE habit_id = ? AND user_id = ?',
            [habitId, req.user.user_id]
        );
        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Habit not found.' });
        }
        const [stackRows] = await connection.execute(
            'SELECT stack_id FROM habit_stack WHERE stack_id = ? AND user_id = ?',
         [habit.stack_id, req.user.user_id]
            );

        if (stackRows.length === 0) {
         await connection.end();
         return res.status(400).json({ message: 'Invalid stack.' });
        }
        let sortOrder = existing[0].sort_order;
        if (existing[0].stack_id !== habit.stack_id) {
            const [[max]] = await connection.execute(
                'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM habit WHERE user_id = ?',
                [req.user.user_id]
            );
            sortOrder = max.maxOrder + 1;
        }

        await connection.execute(
            'UPDATE habit SET habit_name = ?, time_of_day = ?, status = ?, sort_order = ?, stack_id = ? WHERE habit_id = ? AND user_id = ?',
            [habit.name, habit.time, habit.status, sortOrder, habit.stack_id, habitId, req.user.user_id]
        );

        const [rows] = await connection.execute(
            `SELECT ${HABIT_COLUMNS} FROM habit WHERE habit_id = ?`,
            [habitId]
        );
        await connection.end();

        res.status(200).json({ habit: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating habit.' });
    }
});

// Route: Save a new order for one stack. The body is { ids: [...] }:
// every habit id in that stack, in the new top-to-bottom order.
// The stack's existing sort_order numbers are handed back out in the
// new order, so the other stacks are never touched.
app.put('/api/habits/reorder', authenticateToken, async (req, res) => {
    const { ids } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0 ||
        !ids.every(Number.isInteger) || new Set(ids).size !== ids.length) {
        return res.status(400).json({ message: 'A list of habit ids is required.' });
    }

    let connection;
    try {
        connection = await createConnection();

        // Every id must belong to this user
        const [rows] = await connection.execute(
            `SELECT habit_id, stack_id, sort_order FROM habit
             WHERE user_id = ? AND habit_id IN (${ids.map(() => '?').join(',')})`,
            [req.user.user_id, ...ids]
        );
        if (rows.length !== ids.length) {
            return res.status(404).json({ message: 'Habit not found.' });
        }

        // ...and all be in the same stack
        const stack = rows[0].stack_id;
        if (rows.some(r => r.stack_id !== stack)) {
            return res.status(400).json({ message: 'Habits must all be in the same stack.' });
        }

        // ...and be the whole stack, so every habit in it gets a new order
        const [[count]] = await connection.execute(
            'SELECT COUNT(*) AS total FROM habit WHERE user_id = ? AND stack_id = ?',
            [req.user.user_id, stack]
        );
        if (Number(count.total) !== ids.length) {
            return res.status(400).json({ message: 'Send every habit in the stack.' });
        }

        // Reuse the stack's own sort_order numbers, smallest first
        const slots = rows.map(r => r.sort_order).sort((a, b) => a - b);

        await connection.beginTransaction();
        for (let i = 0; i < ids.length; i++) {
            await connection.execute(
                'UPDATE habit SET sort_order = ? WHERE habit_id = ? AND user_id = ?',
                [slots[i], ids[i], req.user.user_id]
            );
        }
        await connection.commit();

        res.status(200).json({ message: 'Order saved.' });
    } catch (error) {
        if (connection) {
            await connection.rollback().catch(() => {});
        }
        console.error(error);
        res.status(500).json({ message: 'Error saving order.' });
    } finally {
        if (connection) {
            await connection.end().catch(() => {});
        }
    }
});

// Route: Delete a habit
app.delete('/api/habits/:id', authenticateToken, async (req, res) => {
    const habitId = Number(req.params.id);
    if (!Number.isInteger(habitId)) {
        return res.status(400).json({ message: 'Invalid habit id.' });
    }

    try {
        const connection = await createConnection();
        const [result] = await connection.execute(
            'DELETE FROM habit WHERE habit_id = ? AND user_id = ?',
            [habitId, req.user.user_id]
        );
        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Habit not found.' });
        }
        res.status(200).json({ message: 'Habit deleted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting habit.' });
    }
});

//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});