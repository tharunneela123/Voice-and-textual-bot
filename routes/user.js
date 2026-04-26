const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// GET /api/user/profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json(user);
    } catch (error) {
        console.error('Fetch profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/user/profile
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { fullName, username } = req.body;
        
        const updates = {};
        if (fullName) updates.fullName = fullName;
        if (username !== undefined) updates.username = username; // allow empty string reset

        // Validate unique username if provided and changed
        if (username) {
            const existingName = await User.findOne({ username, _id: { $ne: req.user.userId } });
            if (existingName) {
                return res.status(400).json({ error: 'Username is already taken' });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        res.json(updatedUser);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// DELETE /api/user/profile
router.delete('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');

        // 1. Find all conversations belonging to the user
        const conversations = await Conversation.find({ userId: userId });
        const convoIds = conversations.map(c => c._id);

        // 2. Delete all messages within those conversations
        await Message.deleteMany({ conversationId: { $in: convoIds } });

        // 3. Delete all conversations
        await Conversation.deleteMany({ userId: userId });

        // 4. Delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: 'User account and all associated data deleted successfully.' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// POST /api/user/feedback
router.post('/feedback', requireAuth, async (req, res) => {
    try {
        const { rating, text } = req.body;
        if (!rating || !text) {
            return res.status(400).json({ error: 'Rating and text are required' });
        }

        const Feedback = require('../models/Feedback');
        const newFeedback = new Feedback({
            user: req.user.userId,
            rating,
            text
        });

        await newFeedback.save();
        res.status(201).json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Feedback submission error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// PUT /api/user/update-password
router.put('/update-password', requireAuth, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.password = password;
        await user.save(); // This will trigger any pre-save hooks to hash the password

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

module.exports = router;
