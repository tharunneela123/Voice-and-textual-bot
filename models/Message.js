const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'system', 'bot'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    providerUsed: {
        type: String,
        default: 'None' // Useful for logging bot generation sources
    },
    fallbackTriggered: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Message', messageSchema);
