const { CohereClient } = require('cohere-ai');
require('dotenv').config();

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function run() {
    try {
        const response = await cohere.chat({
            message: 'Hello',
            model: 'command',
        });
        console.log("SUCCESS:", response.text);
    } catch (e) {
        console.error("ERROR:");
        console.error(e.message);
        if (e.statusCode) console.error("Status:", e.statusCode);
        if (e.body) console.error("Body:", e.body);
    }
}
run();
