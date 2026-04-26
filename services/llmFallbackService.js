require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');
const ChatLog = require('../models/ChatLog');

// Initialize API Clients
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const cohere = process.env.COHERE_API_KEY ? new CohereClient({ token: process.env.COHERE_API_KEY }) : null;

// Circuit Breaker State
const providerStatus = {}; 
const FAILURE_COOLDOWN = 60000; // Skip failed models for 60 seconds

/**
 * Helper to run a promise with a timeout
 */
async function withTimeout(promise, ms, label) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

/**
 * Generates a chat response using a cost-effective, rate-limit-conscious tiered fallback.
 * Includes conversation history for context.
 */
async function generateChatResponse(prompt, requestedModel = 'auto', history = []) {
    let finalResponse = '';
    let providerUsed = 'None';
    let fallbackTriggered = false;
    const startTime = Date.now();

    // Format history for different providers
    const formatHistoryGemini = () => {
        return history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
    };

    const formatHistoryCohere = () => {
        return history.map(msg => ({
            role: msg.role === 'user' ? 'USER' : 'CHATBOT',
            message: msg.content
        }));
    };

    // Provider Helpers
    const runGemini = async (modelName, timeoutMs) => {
        if (!genAI) throw new Error("Gemini API key missing");
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const contents = formatHistoryGemini();
        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const result = await withTimeout(model.generateContent({
            contents: contents,
        }), timeoutMs, `Gemini ${modelName}`);
        const response = await result.response;
        return { text: response.text() || '', provider: `Gemini (${modelName})` };
    };

    const runCohere = async (modelName, timeoutMs) => {
        if (!cohere) throw new Error("Cohere API key missing");
        const response = await withTimeout(cohere.chat({
            message: prompt,
            model: modelName,
            chat_history: formatHistoryCohere()
        }), timeoutMs, `Cohere ${modelName}`);
        return { text: response.text || '', provider: `Cohere (${modelName})` };
    };

    // Tiers with Balanced Timeouts (Lighter = faster, Heavier = more patient)
    const tiers = [
        { name: 'gemini-2.5-flash', type: 'gemini', timeout: 15000 },
        { name: 'gemini-2.0-flash', type: 'gemini', timeout: 15000 },
        { name: 'command-r7b-12-2024', type: 'cohere', timeout: 20000 },
        { name: 'command-r-08-2024', type: 'cohere', timeout: 35000 },
        { name: 'command-r-plus-08-2024', type: 'cohere', timeout: 45000 },
        { name: 'gemini-2.5-pro', type: 'gemini', timeout: 50000 }
    ];

    const modelMapping = {
        'gemini-2.5-flash': 'gemini-2.5-flash',
        'gemini-2.0-flash': 'gemini-2.0-flash',
        'gemini-2.5-pro': 'gemini-2.5-pro',
        'command-r': 'command-r-08-2024',
        'command-r-plus': 'command-r-plus-08-2024',
        'command-r7b': 'command-r7b-12-2024'
    };

    let executionQueue = [...tiers];
    const isAuto = requestedModel === 'auto';
    
    if (!isAuto) {
        const targetModel = modelMapping[requestedModel] || requestedModel;
        const index = executionQueue.findIndex(t => t.name === targetModel);
        if (index > -1) {
            const requested = executionQueue.splice(index, 1)[0];
            // Boost the timeout if explicitly requested by user
            requested.timeout = Math.max(requested.timeout, 40000); 
            executionQueue.unshift(requested);
        }
    }

    const now = Date.now();
    const availableQueue = executionQueue.filter(tier => {
        const status = providerStatus[tier.name];
        // Only skip if it was a hard error (429/503), not just a timeout
        if (status && status.reason !== 'Timeout' && (now - status.lastFail < FAILURE_COOLDOWN)) {
            console.log(`[Circuit Breaker] Skipping ${tier.name} (failed recently: ${status.reason})`);
            return false;
        }
        return true;
    });

    const finalQueue = availableQueue.length > 0 ? availableQueue : executionQueue;

    for (let i = 0; i < finalQueue.length; i++) {
        const tier = finalQueue[i];
        try {
            console.log(`[Tier ${i + 1}] Attempting ${tier.name}...`);
            let res;
            if (tier.type === 'gemini') res = await runGemini(tier.name, tier.timeout);
            else if (tier.type === 'cohere') res = await runCohere(tier.name, tier.timeout);

            finalResponse = res.text;
            providerUsed = res.provider;
            if (i > 0 || finalQueue.length < executionQueue.length) fallbackTriggered = true;
            
            delete providerStatus[tier.name];
            console.log(`[Tier ${i + 1}] Success with ${tier.name} in ${Date.now() - startTime}ms`);
            break;
        } catch (error) {
            const isRateLimit = error.message.includes('429') || error.message.toLowerCase().includes('rate limit') || error.message.includes('quota');
            const isTimeout = error.message.includes('Timeout');
            const is503 = error.message.includes('503');
            
            const reason = isRateLimit ? 'Rate Limit' : isTimeout ? 'Timeout' : is503 ? 'High Demand' : 'Error';
            console.warn(`[Tier ${i + 1}] ${tier.name} failed (${reason}): ${error.message}`);
            
            providerStatus[tier.name] = { lastFail: Date.now(), reason };

            if (i === finalQueue.length - 1) {
                finalResponse = "As AI Mitra, I'm currently experiencing extremely high demand across all my brain centers. I'm in power-saving mode. Please try again in a minute!";
                providerUsed = 'Offline Fallback';
                fallbackTriggered = true;
            }
        }
    }

    finalResponse = finalResponse.trim();
    try {
        const logEntry = new ChatLog({
            userPrompt: prompt,
            finalResponse: finalResponse,
            providerUsed: providerUsed,
            fallbackTriggered: fallbackTriggered,
            timestamp: new Date()
        });
        await logEntry.save();
    } catch (dbError) {
        console.error(`[LLM Logging] Failed to save log: ${dbError.message}`);
    }

    return { text: finalResponse, provider: providerUsed };
}

module.exports = {
    generateChatResponse
};
