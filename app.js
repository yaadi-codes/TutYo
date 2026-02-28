const express = require('express');
const path = require('path');
const app = express();

require('dotenv').config(); // Load environment variables FIRST

const passportSetup = require('./config/passport-setup'); // Loads Passport strategies
const authRoutes = require('./routes/auth-routes');
const loginAndRegisterRoutes = require('./routes/regular-login-routes');
const session = require('express-session');
const { connectToDb, getDb, closeConnection } = require('./databaseFiles/db');
const passport = require('passport');

// Set the views directory explicitly (needed for Vercel serverless)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs'); // EJS template engine

// Middleware setup
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware (required for passport session handling)
app.use(session({
    secret: process.env.COOKIE_KEY || 'fallback-secret-key', // Fallback prevents crash if env var missing
    resave: false,                  // Don't save session if unmodified
    saveUninitialized: false,       // Don't create session until something is stored
    cookie: {
        maxAge: 24 * 3600 * 1000,   // 1 day
        secure: false               // ! Set to true if it goes to production with HTTPS
    }
}));

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// DB connection middleware — ensures DB is connected for each request (serverless-safe)
let db;
app.use(async (req, res, next) => {
    try {
        if (!db) {
            await connectToDb();
            db = getDb();
        }
        next();
    } catch (err) {
        console.error('DB connection error in middleware:', err);
        res.status(500).send('Database connection failed: ' + err.message);
    }
});

// Route handlers
app.use('/auth', authRoutes);                  // Google OAuth and future providers
app.use(loginAndRegisterRoutes);               // Login/register routes for local users


// Placeholder index page
app.get('/', (req, res) => {
    res.render('./pages/index', {
        title: 'Home',
        stylesheets: ['index.css']
    });
});


app.get('/loggedIn', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    res.render('./pages/Dashboard', {
        title: 'Dashboard',
        stylesheets: []
    });
});

// Temporary diagnostic route — remove after debugging
app.get('/debug-health', (req, res) => {
    res.json({
        status: 'ok',
        env: {
            hasDbUser: !!process.env.DB_USER,
            hasDbPass: !!process.env.DB_PASS,
            hasCookieKey: !!process.env.COOKIE_KEY,
            hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            hasGoogleCbUrl: !!process.env.GOOGLE_CB_URL,
            hasJwtSecret: !!process.env.JWT_SECRET,
            isVercel: !!process.env.VERCEL,
        },
        dbConnected: !!db,
        viewsDir: path.join(__dirname, 'views'),
        nodeVersion: process.version,
    });
});

// Catch-all error handler — shows actual error instead of generic "Internal Server Error"
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
});

// Only listen locally — Vercel handles this in production
if (!process.env.VERCEL) {
    (async () => {
        try {
            await connectToDb();
            db = getDb();

            app.listen(process.env.PORT || 3000, () => {
                console.log(`Server is running on port ${process.env.PORT || 3000}`);
            });

        } catch (err) {
            console.error('Failed to connect to the database', err);
            process.exit(1);
        }
    })();
}

process.on('SIGINT', async () => {
    console.log('\nSIGINT received, closing DB connection...');
    await closeConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received, closing DB connection...');
    await closeConnection();
    process.exit(0);
});

// Export the app for Vercel serverless function
module.exports = app;
