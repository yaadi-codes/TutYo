const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Creates a reusable Nodemailer transport using Gmail SMTP.
 * Requires EMAIL_USER and EMAIL_PASS environment variables.
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Sends a password reset email to the specified address.
 * 
 * @param {string} toEmail - The recipient's email address.
 * @param {string} resetLink - The full URL for the password reset page.
 * @returns {Promise} Resolves when the email is sent.
 */
async function sendResetEmail(toEmail, resetLink) {
    const mailOptions = {
        from: `"TutYo Support" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'TutYo — Reset Your Password',
        html: `
            <div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; color: #e0e0e0;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="font-size: 28px; margin: 0; color: #ffffff;">
                        Tut<span style="background: #e75480; padding: 2px 8px; border-radius: 6px; color: #fff;">Yo</span>
                    </h1>
                    <p style="color: #aaa; font-size: 13px; margin-top: 4px;">Making learning fun</p>
                </div>

                <h2 style="font-size: 20px; color: #ffffff; margin-bottom: 8px;">Password Reset Request</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #ccc;">
                    We received a request to reset your password. Click the button below to choose a new one. 
                    This link <strong>expires in 15 minutes</strong>.
                </p>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="${resetLink}" 
                       style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #e75480, #c0392b); color: #ffffff; text-decoration: none; border-radius: 25px; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">
                        Reset My Password
                    </a>
                </div>

                <p style="font-size: 13px; color: #999; line-height: 1.5;">
                    If you didn't request this, you can safely ignore this email — your password won't change.
                </p>

                <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;">
                <p style="font-size: 11px; color: #666; text-align: center;">
                    © ${new Date().getFullYear()} TutYo. All rights reserved.
                </p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendResetEmail };
