const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const { generateChatResponse } = require('../services/llmFallbackService');

// Require auth for all chat routes
router.use(requireAuth);

// GET /api/chat/history - Get all conversations for a user
router.get('/history', async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to retrieve chat history' });
    }
});

// GET /api/chat/:conversationId - Get messages for a specific conversation
router.get('/:conversationId', async (req, res) => {
    try {
        // Verify ownership
        const convo = await Conversation.findOne({ _id: req.params.conversationId, userId: req.user.userId });
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });

        const messages = await Message.find({ conversationId: convo._id }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
});

// POST /api/chat - Process new message (replaces the simple /api/chat block in server.js)
router.post('/', async (req, res) => {
    try {
        const { prompt, conversationId, selectedModel } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let activeConvoId = conversationId;

        // 1. If no conversationId is passed, this is a "New Chat" -> create the Conversation doc
        if (!activeConvoId) {
            // Generate a small title from the prompt
            let title = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
            const newConvo = new Conversation({
                userId: req.user.userId,
                title: title
            });
            await newConvo.save();
            activeConvoId = newConvo._id;
        } else {
            // Verify ownership
            const checkConvo = await Conversation.findOne({ _id: activeConvoId, userId: req.user.userId });
            if (!checkConvo) return res.status(404).json({ error: 'Conversation not found' });
            
            // Update timestamp
            checkConvo.updatedAt = Date.now();
            await checkConvo.save();
        }

        // 2. Save User Message
        const userMsg = new Message({
            conversationId: activeConvoId,
            role: 'user',
            content: prompt
        });
        await userMsg.save();

        // 3. Fetch History (limit to last 10 messages for context)
        const history = await Message.find({ conversationId: activeConvoId })
            .sort({ createdAt: 1 })
            .limit(100); // Fetch up to 100 but we will slice the last 10 later if needed
        
        // We only want history BEFORE the current message we just saved
        const historyContext = history.filter(m => m._id.toString() !== userMsg._id.toString()).slice(-10);

        // 4. Generate LLM Response with context
        const { text: responseText, provider } = await generateChatResponse(prompt, selectedModel, historyContext);

        // 4. Save Bot Message
        const botMsg = new Message({
            conversationId: activeConvoId,
            role: 'bot',
            content: responseText,
            providerUsed: provider
        });
        await botMsg.save();

        // 5. Return payload including IDs for editing support
        res.json({
            conversationId: activeConvoId,
            userMessageId: userMsg._id,
            botMessageId: botMsg._id,
            response: responseText,
            provider: provider
        });

    } catch (error) {
        console.error('Server error during chat routing:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /api/chat/message/:messageId - Edit a message and re-generate response
router.put('/message/:messageId', async (req, res) => {
    try {
        const { prompt, selectedModel } = req.body;
        const { messageId } = req.params;

        console.log(`[API] Editing message ${messageId}: "${prompt}" using model ${selectedModel}`);

        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        // 1. Find the message and verify ownership via conversation
        const userMsg = await Message.findById(messageId);
        if (!userMsg || userMsg.role !== 'user') {
            return res.status(404).json({ error: 'User message not found' });
        }

        const convo = await Conversation.findOne({ _id: userMsg.conversationId, userId: req.user.userId });
        if (!convo) return res.status(403).json({ error: 'Unauthorized' });

        // 2. Update user message content
        userMsg.content = prompt;
        await userMsg.save();

        // 3. Delete all messages that come AFTER this message in the conversation
        // This ensures the bot responds to the new version and the chat continues from there
        await Message.deleteMany({
            conversationId: userMsg.conversationId,
            createdAt: { $gt: userMsg.createdAt }
        });

        // 4. Fetch History for the current conversation (context)
        // Since we deleted subsequent messages, we just fetch what remains
        const historyContext = await Message.find({ conversationId: userMsg.conversationId })
            .sort({ createdAt: 1 })
            .limit(10);

        // 5. Generate NEW LLM Response with context
        const { text: responseText, provider } = await generateChatResponse(prompt, selectedModel, historyContext);

        // 5. Save NEW Bot Message
        const botMsg = new Message({
            conversationId: userMsg.conversationId,
            role: 'bot',
            content: responseText,
            providerUsed: provider
        });
        await botMsg.save();

        // 6. Update conversation timestamp
        convo.updatedAt = Date.now();
        await convo.save();

        res.json({
            userMessageId: userMsg._id,
            botMessageId: botMsg._id,
            response: responseText,
            provider: provider
        });

    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ error: 'Failed to edit message / re-generate response' });
    }
});

// DELETE /api/chat/:conversationId
router.delete('/:conversationId', async (req, res) => {
    try {
        const convo = await Conversation.findOneAndDelete({ _id: req.params.conversationId, userId: req.user.userId });
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });
        
        await Message.deleteMany({ conversationId: req.params.conversationId });
        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// PUT /api/chat/:conversationId/rename
router.put('/:conversationId/rename', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

        const convo = await Conversation.findOne({ _id: req.params.conversationId, userId: req.user.userId });
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });
        
        convo.title = title.trim();
        await convo.save();
        
        res.json({ message: 'Conversation renamed successfully', title: convo.title });
    } catch (error) {
        console.error('Error renaming conversation:', error);
        res.status(500).json({ error: 'Failed to rename conversation' });
    }
});

module.exports = router;
