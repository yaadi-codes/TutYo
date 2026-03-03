const routes = require('express').Router();
const { getDb } = require('../databaseFiles/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendResetEmail } = require('../utils/email');

//Login or Registration routes
routes.get('/loginOrRegister', (req, res) => {
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


// ==========================================
//  Forgot Password Routes
// ==========================================

/**
 * GET /loginOrRegister/forgot_password
 * Renders the forgot password form.
 */
routes.get('/loginOrRegister/forgot_password', (req, res) => {
    res.render('./pages/forgotPassword', {
        title: 'Forgot Password',
        stylesheets: ['loginPage.css']
    });
});

/**
 * POST /loginOrRegister/forgot_password
 * Validates email, generates a JWT reset token, and sends a reset email.
 */
routes.post('/loginOrRegister/forgot_password', async (req, res) => {
    const db = getDb();
    const collection = db.collection('login_data');

    try {
        const email = req.body.email?.toLowerCase().trim();

        if (!email || !emailPattern.test(email)) {
            return res.status(400).json({ result: 'fail', message: 'Please enter a valid email address.' });
        }

        const user = await collection.findOne({ email });

        // Always respond with success to prevent email enumeration attacks
        if (!user) {
            return res.status(200).json({
                result: 'success',
                message: 'If an account with that email exists, a reset link has been sent.'
            });
        }

        // Generate a reset token (expires in 15 minutes)
        const resetToken = jwt.sign(
            { email: user.email, purpose: 'password-reset' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Build the reset link using the request's host
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const resetLink = `${protocol}://${host}/loginOrRegister/reset_password/${resetToken}`;

        await sendResetEmail(user.email, resetLink);

        return res.status(200).json({
            result: 'success',
            message: 'If an account with that email exists, a reset link has been sent.'
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ result: 'fail', message: 'Something went wrong. Please try again later.' });
    }
});

/**
 * GET /loginOrRegister/reset_password/:token
 * Validates the JWT token and renders the reset password form.
 */
routes.get('/loginOrRegister/reset_password/:token', (req, res) => {
    const { token } = req.params;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.purpose !== 'password-reset') {
            return res.status(400).send('Invalid reset link.');
        }

        res.render('./pages/resetPassword', {
            title: 'Reset Password',
            stylesheets: ['loginPage.css'],
            token
        });

    } catch (err) {
        console.error('Invalid or expired reset token:', err.message);
        return res.status(400).send('This reset link is invalid or has expired. Please request a new one.');
    }
});

/**
 * POST /loginOrRegister/reset_password
 * Validates the token and new password, then updates the user's password in the database.
 */
routes.post('/loginOrRegister/reset_password', async (req, res) => {
    const db = getDb();
    const collection = db.collection('login_data');

    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ result: 'fail', message: 'Missing token or new password.' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ result: 'fail', message: 'Reset link is invalid or has expired.' });
        }

        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({ result: 'fail', message: 'Invalid reset token.' });
        }

        // Validate password strength
        const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&?*]).{8,}$/;
        if (!strongPasswordPattern.test(newPassword)) {
            return res.status(400).json({
                result: 'fail',
                message: 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol.'
            });
        }

        // Hash and update
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const result = await collection.updateOne(
            { email: decoded.email },
            {
                $set: {
                    password: hashedPassword,
                    failedLoginAttempt: 0, // Reset failed attempts
                    isLocked: false         // Unlock if previously locked
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ result: 'fail', message: 'Account not found.' });
        }

        return res.status(200).json({
            result: 'success',
            message: 'Password has been reset successfully!'
        });

    } catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ result: 'fail', message: 'Something went wrong. Please try again.' });
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

