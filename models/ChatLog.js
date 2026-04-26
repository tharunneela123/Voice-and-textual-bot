const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
    userPrompt: {
        type: String,
        required: true
    },
    finalResponse: {
        type: String,
        required: true
    },
    providerUsed: {
        type: String,
        required: true
    },
    fallbackTriggered: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ChatLog', chatLogSchema);
