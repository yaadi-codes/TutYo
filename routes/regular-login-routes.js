const routes = require('express').Router();
const { getDb } = require('../databaseFiles/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

//Login or Registration routes
routes.get('/loginOrRegister', (req, res) => {
    res.render('./pages/loginPage', { title: 'Login', stylesheets: ['loginPage.css'] })
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

routes.post('/loginOrRegister', async (req, res) => {
    const db = getDb();
    const collection = db.collection('login_data');

    try {
        const action = req.body.action; //This will be either 'login' or 'register'

        switch (action.toLowerCase()) {
            case 'login':
                return await handleLogin(req, res, collection);

            case 'register':
                return await handleRegistration(req, res, collection);

            default:
                return res.status(400).json({ result: 'fail', message: 'Invalid action type' });
        }
    } catch (err) {
        console.error('Error processing login or registration:', err);
        return res.status(500).json({ result: 'fail', message: 'Internal server error' });
    }
})


// Auto-login route for users who previously selected "Remember Me"
routes.get('/auto-login', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // Extract token from the "Bearer <token>" format

    if (!token) {
        return res.status(401).json({ result: 'fail', message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify JWT token using secret

        return res.status(200).json({
            result: 'success',
            message: 'Auto-login successful',
            user: decoded // Sends full decoded token payload (make sure it's safe)
        });

    } catch (err) {
        console.error('Error during auto-login:', err);
        return res.status(500).json({ result: 'fail', message: 'Internal server error' });
    }
});


/**
 * Handles the login process for users submitting the login form.
 * 
 * This function:
 * - Validates user existence by username or email.
 * - Verifies the password using bcrypt.
 * - Tracks and limits failed login attempts (locks account after max tries).
 * - Resets failed attempt counter on successful login.
 * - Generates and returns a JWT token if login is successful.
 * 
 * @param {Object} req - Express request object containing login credentials in the body.
 * @param {Object} res - Express response object used to return the login result.
 * @param {Object} collection - MongoDB collection instance pointing to `login_data`.
 * 
 * @returns {Object} JSON response with login status, token (if success), and user info.
 */
async function handleLogin(req, res, collection) {
    const identifier = String(req.body.userOrEmail).toLowerCase().trim();
    const identifierType = emailPattern.test(identifier) ? 'email' : 'username';
    const password = req.body.password;
    const MAX_ATTEMPTS = 5;

    const user = await collection.findOne({ [identifierType]: identifier });

    if (!user) {
        return res.status(404).json({ result: 'fail', message: 'User not found' });
    }

    //check to see if user account is locked 
    if (user.isLocked) return res.status(403).json({ result: 'fail', message: 'Account is locked.' });

    let loginAttempt = parseInt(user.failedLoginAttempt || 0);// Track failed attempts

    try {
        const ispasswordValid = await bcrypt.compare(password, user.password);

        // Lock account if max attempts reached
        if (!ispasswordValid) {
            if (loginAttempt >= MAX_ATTEMPTS) {
                await collection.updateOne({ [identifierType]: identifier }, { $set: { isLocked: true } });
                return res.status(403).json({ result: 'fail', message: 'Account is locked.' });
            }
            // Increment failed attempts
            loginAttempt++;
            await collection.updateOne(
                { [identifierType]: identifier },
                { $set: { failedLoginAttempt: loginAttempt } }
            );

            return res.status(401).json({ result: 'fail', message: 'Invalid password' });
        }

        //Else password is valid: reset failed attempt counter
        loginAttempt = 0;

        await collection.updateOne(
            { [identifierType]: identifier },
            { $set: { failedLoginAttempt: loginAttempt } }
        );

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            },
            process.env.JWT_SECRET,
        )

        return res.status(200).json({
            result: 'success',
            message: 'Login Successful',
            token: token,
            user: {
                id: user._id,
                username: user.username,
            }
        });
    } catch (err) {
        console.error('Error comparing passwords:', err);
        return res.status(500).json({ result: 'fail', message: 'Internal server error' });
    }
};

/**
 * Handles user registration for new accounts.
 * 
 * This function:
 * - Validates if the user already exists by email.
 * - Hashes the password securely using bcrypt before storing.
 * - Initializes the user's login metadata (e.g., failed attempts, login type).
 * - Inserts the new user into the database.
 * 
 * @param {Object} req - Express request object containing registration fields in the body.
 * @param {Object} res - Express response object used to return the registration result.
 * @param {Object} collection - MongoDB collection instance pointing to `login_data`.
 * 
 * @returns {Object} JSON response with registration status and the created user ID.
 */
async function handleRegistration(req, res, collection) {
    const data = req.body;
    let registeredPassword = data.setPassword;

    // Clean up fields that shouldn't be stored
    ['setPassword', 'confirmPassword', 'action']
        .forEach(key => delete data[key]);

    const userExists = await collection
        .findOne({ email: data.email.toLowerCase().trim() });
    if (userExists) {
        return res.status(409).json(
            { result: 'fail', message: 'User already exists' }
        );
    }

    data.loginType = 'regular'; // This is helpful for tracking login method

    try {
        const hashedPassword = await bcrypt.hash(registeredPassword, 12);
        data.password = hashedPassword; //Store the hashed password
        data.failedLoginAttempt = 0;
    } catch (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({ result: 'fail', message: 'Internal server error' });
    };

    try {
        const result = await collection.insertOne(data);
        return res.status(201).json({
            result: 'success',
            message: 'User registered successfully',
            user: {
                name: data.name,
                email: data.email,
                id: result.insertedId
            }
        });
    } catch (err) {
        console.error('Error inserting user into database:', err);
        return res.status(500).json({ result: 'fail', message: 'Internal server error' });
    }
};
module.exports = routes;