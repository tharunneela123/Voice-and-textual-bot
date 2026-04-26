const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Reusable Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
const FROM_NAME = `"AI Mitra" <${process.env.EMAIL_USER}>`;

// POST /api/auth/google-login
router.post('/google-login', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: 'Token is required' });

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const { sub, email, name, picture } = payload;

        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Create new user for first-time google login
            user = new User({
                fullName: name,
                email: email.toLowerCase(),
                password: crypto.randomBytes(16).toString('hex'), // Secure random password
                isVerified: true,
                avatar: picture
            });
            await user.save();
        } else if (!user.isVerified) {
            // If user existed but wasn't verified, verify them now via Google
            user.isVerified = true;
            await user.save();
        }

        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Google login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatar: picture
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Invalid Google token' });
    }
});

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Check if user already exists and is verified
        const existingUser = await User.findOne({ email: email.toLowerCase(), isVerified: true });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 600000; // 10 minutes

        // Upsert user with OTP (might be an unverified user from previous attempt)
        await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { otp, otpExpires, isVerified: false, fullName: 'Pending...', password: 'Pending...' },
            { upsert: true, returnDocument: 'after' }
        );

        // Send Email
        // Remove local transporter to use global one
        const mailOptions = {
            to: email,
            from: FROM_NAME,
            subject: 'AI Mitra Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #6366f1;">Welcome to AI Mitra</h2>
                    <p>Your verification code is:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #1f2937;">${otp}</h1>
                    <p>This code expires in 10 minutes.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Verification code sent to email' });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { fullName, email, password, otp } = req.body;
        
        if (!fullName || !email || !password || !otp) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        user.fullName = fullName;
        user.password = password;
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email
            }
        });
    } catch (error) {
        console.error('SIGNUP ERROR:', error);
        res.status(500).json({ error: error.message || 'Failed to register user' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(401).json({ error: 'Email not verified. Please sign up again to receive a code.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password', exists: true });
        }

        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username || ''
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to authenticate user' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Generate token
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
        await user.save();

        // Send Email
        const resetUrl = `http://localhost:${process.env.PORT || 3000}/reset-password.html?token=${resetToken}`;
        
        const mailOptions = {
            to: user.email,
            from: FROM_NAME,
            subject: 'AI Mitra Password Reset',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                  `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                  `${resetUrl}\n\n` +
                  `If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        await transporter.sendMail(mailOptions);
        
        res.json({ message: 'Reset link has been sent to your email.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send reset email. Please check server configuration.' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });

        const user = await User.findOne({ 
            resetPasswordToken: token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password has been successfully reset. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
});

module.exports = router;
