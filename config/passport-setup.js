const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const { getDb } = require('../databaseFiles/db'); 


/**
 * Serialize user by storing only their MongoDB _id in the session.
 * @param {Object} user - The user object retrieved from the database.
 * @param {Function} cb - Callback function to complete serialization.
 */
passport.serializeUser((user, cb)=>{
    cb(null, user._id);
})

/**
 * Deserialize user by looking them up using their stored _id.
 * @param {string} id - MongoDB _id stored in the session.
 * @param {Function} cb - Callback function to complete deserialization.
 */
passport.deserializeUser(async (id, cb)=>{
    try{
        const db = getDb();
        const user = await db.collection('login_data').findOne({_id: id});
        cb(null, user);
    }
    catch(err){
        cb(err, null);
    }
    
})

/**
 * Google OAuth strategy configuration.
 * Attempts to find or create a user based on their Google profile ID.
 */
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CB_URL
  },
  async (accessToken, refreshToken, profile, cb) => {
    try {
        const db = getDb();
        const collection = db.collection('login_data');

        const googleId = profile.id;

        // Check if user with this Google ID already exists
        let user = await collection.findOne({ googleId });

        if (!user) {
            const email = profile.emails?.[0]?.value;

            const data = {
            googleId,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            username: profile.displayName,
            email,
            loginType: 'google',
            };

            const result = await collection.insertOne(data);
            user = { ...data, _id: result.insertedId };
        }
        
        return cb(null, user)
    } catch (err) {
    console.error('Error in GoogleStrategy:', err);
    return cb(err, null);
    }
}));

/* passport.use(new MicrosoftStrategy(
    {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: process.env.MICROSOFT_CB_URL,

    },
    (accessToken, refreshToken, profile, cb)=>{

    })
);

passport.use(new AppleStrategy(
    {
        clientID: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
        callbackURL: process.env.APPLE_CB_URL,

    },
    (accessToken, refreshToken, profile, cb)=>{

    })
); */



