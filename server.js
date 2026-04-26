require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { generateChatResponse } = require('./services/llmFallbackService');

const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);


// Start Server unconditionally so Render always sees an active web service
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Connect to MongoDB asynchronously
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aimitra')
    .then(() => {
        console.log('✅ Connected to MongoDB');
    })
    .catch((err) => {
        console.error('❌ Failed to connect to MongoDB', err);
    });
