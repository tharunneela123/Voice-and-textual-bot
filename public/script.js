// Initialize Lucide Icons
lucide.createIcons();

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const messagesArea = document.getElementById('messagesArea');
const welcomeScreen = document.getElementById('welcomeScreen');
const themeToggle = document.getElementById('themeToggle');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryItems = document.querySelectorAll('.history-item');
const suggestionChips = document.querySelectorAll('.suggestion-chip');
const body = document.body;
const userAvatarLetter = document.getElementById('userAvatarLetter');
const micBtn = document.querySelector('.mic-btn');


// App State
let currentTheme = 'solarized-dark';
let currentUser = { name: 'User', id: null, email: null };
let authToken = localStorage.getItem('token');
let currentConversationId = null;
let editingMessageId = null;
let editingMessageElement = null;

const landingMessages = [
    "Meet AI Mitra, your personal AI assistant",
    "Supercharge your productivity with AI Mitra",
    "Plan, learn, and create with your AI companion",
    "Experience the future of conversation",
    "Ideas spark here. Start chatting."
];
let currentMsgIndex = 0;

// Initialization on load
document.addEventListener('DOMContentLoaded', () => {
    // Restore Theme
    const savedTheme = localStorage.getItem('theme') || 'solarized-dark';
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
    
    let iconName = 'moon';
    if (currentTheme === 'light') iconName = 'sun';
    else if (currentTheme === 'solarized-dark') iconName = 'cloud-moon';
    else if (currentTheme === 'solarized-light') iconName = 'cloud-sun';
    
    if (themeToggle) {
        themeToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    updateHljsTheme(currentTheme);



    if (authToken) {
        fetchProfile();
        fetchChatHistory();
    }

    // Start landing heading cycle if logged out
    if (!authToken) {
        setInterval(cycleLandingHeading, 4000);
    }
    
    // Custom Model Selector Interactivity
    const modelContainer = document.getElementById('modelSelectorContainer');
    const modelTrigger = document.getElementById('modelSelectorTrigger');
    const modelInput = document.getElementById('chatModelSelect');
    const selectedModelText = document.getElementById('selectedModelText');

    if (modelTrigger) {
        modelTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            modelContainer.classList.toggle('open');
        });

        document.querySelectorAll('.model-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                modelInput.value = option.dataset.value;
                selectedModelText.textContent = option.querySelector('span').textContent;
                
                const newIconName = option.dataset.icon;
                const triggerIconContainer = document.getElementById('selectedModelIconContainer');
                if (triggerIconContainer && newIconName) {
                    triggerIconContainer.innerHTML = `<i data-lucide="${newIconName}"></i>`;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
                
                document.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                modelContainer.classList.remove('open');
            });
        });

        document.addEventListener('click', (e) => {
            if (!modelContainer.contains(e.target)) {
                modelContainer.classList.remove('open');
            }
        });
    }
});

function cycleLandingHeading() {
    const heading = document.getElementById('landingDynamicHeading');
    if (!heading || !body.classList.contains('is-logged-out')) return;

    heading.classList.add('fade-out');
    setTimeout(() => {
        currentMsgIndex = (currentMsgIndex + 1) % landingMessages.length;
        heading.innerText = landingMessages[currentMsgIndex];
        heading.classList.remove('fade-out');
    }, 500);
}

function updateWelcomeScreen() {
    const welcomeSubtext = document.getElementById('welcomeSubtext');
    if (welcomeSubtext) {
        const subtexts = [
            "What shall we create together today?",
            "How can I help you be more productive?",
            "Ready to explore some new ideas?",
            "What's on your mind today?",
            "Let's build something amazing."
        ];
        welcomeSubtext.innerText = subtexts[Math.floor(Math.random() * subtexts.length)];
    }
}

// --- Auth Architecture ---

async function fetchProfile() {
    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const user = await res.json();
            currentUser.name = user.displayName || user.fullName;
            currentUser.id = user._id;
            currentUser.email = user.email;

            // Update UI
            body.classList.remove('is-logged-out');
            sidebar.classList.add('collapsed');


            updateWelcomeScreen();

            const sideAvatarLetter = document.getElementById('userAvatarLetter');
            if (sideAvatarLetter) sideAvatarLetter.innerText = currentUser.name.charAt(0).toUpperCase();

            const welcomeUserName = document.getElementById('welcomeUserName');
            if (welcomeUserName) {
                welcomeUserName.innerText = currentUser.name;
            }

            const sidebarUserNameSpan = document.getElementById('sidebarUserNameSpan');
            if (sidebarUserNameSpan) {
                sidebarUserNameSpan.innerText = currentUser.name;
            }
        } else {
            // Token likely expired
            processLogout();
        }
    } catch (e) {
        console.error("Profile fetch failed", e);
    }
}

async function fetchChatHistory() {
    try {
        const res = await fetch('/api/chat/history', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const history = await res.json();
            const chatHistory = document.getElementById('chatHistory');
            if (chatHistory) {
                chatHistory.innerHTML = ''; // Clear default mock chats
                history.forEach(convo => {
                    const li = document.createElement('li');
                    li.className = 'history-item';
                    li.setAttribute('data-chat-id', convo._id);
                    li.innerHTML = `
                        <div class="history-item-content" style="display:flex; align-items:center; gap:12px; overflow:hidden; flex:1;">
                            <i data-lucide="message-square" style="min-width:16px;"></i><span class="chat-title-text" style="overflow:hidden; text-overflow:ellipsis;">${convo.title}</span>
                        </div>
                        <div class="history-item-actions">
                            <button class="action-chat-btn rename-btn" title="Rename Chat" onclick="promptRenameChat(event, '${convo._id}', '${convo.title.replace(/'/g, "\\'")}', this.parentElement.parentElement)">
                                <i data-lucide="edit-2"></i>
                            </button>
                            <button class="action-chat-btn delete-btn" title="Delete Chat" onclick="promptDeleteChat(event, '${convo._id}', this.parentElement.parentElement)">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `;
                    li.querySelector('.history-item-content').addEventListener('click', () => loadConversation(convo._id, convo.title, li));
                    chatHistory.appendChild(li);
                });
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    } catch (e) {
        console.error("History fetch failed", e);
    }
}

// Global scope for onclick handlers
let chatToDelete = null;
let chatElementToDelete = null;
let chatToRename = null;
let chatElementToRename = null;

window.promptDeleteChat = (event, chatId, element) => {
    event.stopPropagation();
    chatToDelete = chatId;
    chatElementToDelete = element;
    
    const overlay = document.getElementById('deleteConfirmModalOverlay');
    if (overlay) overlay.classList.add('active');
};

window.promptRenameChat = (event, chatId, currentTitle, element) => {
    event.stopPropagation();
    chatToRename = chatId;
    chatElementToRename = element;
    
    const input = document.getElementById('renameChatInput');
    if (input) input.value = currentTitle;
    
    const overlay = document.getElementById('renameChatModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        if (input) input.focus();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // ... existing delete listeners ...
    const cancelDeleteBtn = document.getElementById('cancelDeleteChatBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteChatBtn');
    const deleteOverlay = document.getElementById('deleteConfirmModalOverlay');

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            if (deleteOverlay) deleteOverlay.classList.remove('active');
            chatToDelete = null;
            chatElementToDelete = null;
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!chatToDelete) return;
            
            try {
                const res = await fetch(`/api/chat/${chatToDelete}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (res.ok) {
                    if (chatElementToDelete) chatElementToDelete.remove();
                    if (currentConversationId === chatToDelete) {
                        resetChat();
                    }
                }
            } catch (e) {
                console.error("Failed to delete chat", e);
            }
            
            if (deleteOverlay) deleteOverlay.classList.remove('active');
            chatToDelete = null;
            chatElementToDelete = null;
        });
    }

    // Rename listeners
    const cancelRenameBtn = document.getElementById('cancelRenameChatBtn');
    const confirmRenameBtn = document.getElementById('confirmRenameChatBtn');
    const renameOverlay = document.getElementById('renameChatModalOverlay');
    const renameInput = document.getElementById('renameChatInput');

    if (cancelRenameBtn) {
        cancelRenameBtn.addEventListener('click', () => {
            if (renameOverlay) renameOverlay.classList.remove('active');
            chatToRename = null;
            chatElementToRename = null;
        });
    }

    if (confirmRenameBtn) {
        confirmRenameBtn.addEventListener('click', async () => {
            if (!chatToRename || !renameInput.value.trim()) return;
            
            const newTitle = renameInput.value.trim();

            try {
                const res = await fetch(`/api/chat/${chatToRename}/rename`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}` 
                    },
                    body: JSON.stringify({ title: newTitle })
                });
                
                if (res.ok) {
                    const span = chatElementToRename.querySelector('.chat-title-text');
                    if (span) span.textContent = newTitle;
                    
                    const renameBtn = chatElementToRename.querySelector('.rename-btn');
                    if (renameBtn) {
                        renameBtn.setAttribute('onclick', `promptRenameChat(event, '${chatToRename}', '${newTitle.replace(/'/g, "\\'")}', this.parentElement.parentElement)`);
                    }
                }
            } catch (e) {
                console.error("Failed to rename chat", e);
            }
            
            if (renameOverlay) renameOverlay.classList.remove('active');
            chatToRename = null;
            chatElementToRename = null;
        });
    }
});

async function loadConversation(id, title, liElement) {
    currentConversationId = id;

    // UI Updates
    const items = document.querySelectorAll('.history-item');
    items.forEach(i => i.classList.remove('active'));
    if (liElement) liElement.classList.add('active');

    messagesArea.innerHTML = '';
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) chatContainer.classList.remove('landing-mode');
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (window.innerWidth <= 768) sidebar.classList.remove('active');

    // Fetch messages
    try {
        const res = await fetch(`/api/chat/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const messages = await res.json();
            messages.forEach(msg => {
                addMessage(msg.role, msg.content, false, msg.providerUsed, msg._id);
            });
        }
    } catch (e) {
        console.error("Failed to load conversation", e);
    }
}

function simulateLogin() {
    if (typeof openAuthModal === 'function') {
        openAuthModal(false);
    }
}

function simulateLogout() {
    const logoutModalOverlay = document.getElementById('logoutModalOverlay');
    if (logoutModalOverlay) {
        logoutModalOverlay.classList.add('active');
        const settingsDropdown = document.getElementById('settingsDropdown');
        if (settingsDropdown) settingsDropdown.classList.remove('active');
    } else {
        showInfoModal("Are you sure you want to sign out?", "Sign out", () => {
            processLogout();
        }, "Cancel");
    }
}

function processLogout() {
    localStorage.removeItem('token');
    authToken = null;
    currentConversationId = null;
    currentUser = { name: 'User', id: null };

    if (typeof google !== 'undefined') {
        google.accounts.id.disableAutoSelect();
    }

    body.classList.add('is-logged-out');
    sidebar.classList.remove('collapsed');



    const sidebarUserNameSpan = document.getElementById('sidebarUserNameSpan');
    if (sidebarUserNameSpan) {
        sidebarUserNameSpan.innerText = '';
    }

    const sideAvatarLetter = document.getElementById('userAvatarLetter');
    if (sideAvatarLetter) sideAvatarLetter.innerText = '';

    document.getElementById('chatHistory').innerHTML = ''; // clear history on logout
    resetChat();
}

// Sidebar manual toggle
const globalSidebarToggle = document.getElementById('globalSidebarToggle');
globalSidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click from immediately closing it
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('active');
    } else {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
            globalSidebarToggle.title = "Expand menu";
        } else {
            globalSidebarToggle.title = "Collapse menu";
        }
    }
});

// --- Sidebar Interactivity ---

// Close sidebar when clicking outside on mobile
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target)) {
        if (globalSidebarToggle && globalSidebarToggle.contains(e.target)) return;
        sidebar.classList.remove('active');
    }
});

let newChatCount = 0;

function addChatToHistory(title) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return;

    const existingItems = chatHistory.querySelectorAll('.history-item');
    existingItems.forEach(item => item.classList.remove('active'));

    const li = document.createElement('li');
    li.className = 'history-item active';
    li.setAttribute('data-chat-id', 'new-' + newChatCount);

    li.innerHTML = `
        <i data-lucide="message-square"></i>
        <span>${title}</span>
    `;

    li.addEventListener('click', () => {
        const items = chatHistory.querySelectorAll('.history-item');
        items.forEach(i => i.classList.remove('active'));
        li.classList.add('active');

        resetChat();

        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.classList.remove('landing-mode');
        }
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        addMessage('bot', `Loading your conversation about "${title}"...`);
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    });

    chatHistory.prepend(li);
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- Chat Interaction ---

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    let audioContext, analyser, dataArray, source, animationId, currentStream;

    function startWaves() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                currentStream = stream;
                source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                function update() {
                    if (!currentStream) return;
                    analyser.getByteFrequencyData(dataArray);

                    const waves = document.querySelectorAll('.wave');

                    waves.forEach((wave, i) => {
                        let binIndex = i % dataArray.length;
                        let value = dataArray[binIndex];
                        let scale = 0.1 + (value / 140) * 1.8;
                        wave.style.setProperty('--wave-scale', Math.min(2.5, Math.max(0.1, scale)));
                    });

                    animationId = requestAnimationFrame(update);
                }
                update();
            })
            .catch(err => console.error("Mic access denied for waves", err));
    }

    function stopWaves() {
        if (animationId) cancelAnimationFrame(animationId);
        if (source) source.disconnect();
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        // Reset waves
        document.querySelectorAll('.wave').forEach(wave => wave.style.setProperty('--wave-scale', '0.1'));
    }

    micBtn.addEventListener('click', () => {
        try {
            recognition.start();
            micBtn.classList.add('is-recording');
            micBtn.title = 'Listening...';
            startWaves();
        } catch (e) {
            console.log("Speech recognition is already running.");
        }
    });

    recognition.addEventListener('result', (e) => {
        const transcript = e.results[0][0].transcript;
        const currentVal = chatInput.value;
        chatInput.value = currentVal ? currentVal + ' ' + transcript : transcript;
        chatInput.dispatchEvent(new Event('input'));

        recognition.stop();
        micBtn.classList.remove('is-recording');
        micBtn.title = 'Voice Input';
        stopWaves();
    });

    recognition.addEventListener('speechend', () => {
        recognition.stop();
        micBtn.classList.remove('is-recording');
        micBtn.title = 'Voice Input';
        stopWaves();
    });

    recognition.addEventListener('error', (e) => {
        console.error('Speech recognition error:', e.error);
        recognition.stop();
        micBtn.classList.remove('is-recording');
        micBtn.title = 'Voice Input';
        stopWaves();

        if (e.error === 'network') {
            showInfoModal('Voice Input Failed: Your browser cannot connect to its translation servers.');
        } else if (e.error !== 'no-speech' && e.error !== 'not-allowed') {
            showInfoModal('Speech recognition error: ' + e.error);
        }
    });
} else {
    micBtn.addEventListener('click', () => {
        showInfoModal("Your browser does not support Speech Recognition. Please try Chrome, Safari, or Edge.");
    });
}

// Auto-grow textarea
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';

    // Enable/Disable send button
    sendBtn.disabled = chatInput.value.trim() === '';
});

// Handle enter key
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
    if (e.key === 'Escape' && editingMessageId) {
        cancelEdit();
    }
});

sendBtn.addEventListener('click', handleSendMessage);

function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Enforce authentication before chatting
    if (!authToken) {
        if (typeof openAuthModal === 'function') {
            openAuthModal(false);
        } else {
            alert("Please log in to chat.");
        }
        return;
    }

    // Show disclaimer if it's the first message
    const disclaimer = document.getElementById('chatDisclaimer');
    if (disclaimer) disclaimer.style.display = 'block';

    if (editingMessageId) {
        // --- EDIT MODE ---
        const oldText = editingMessageElement.querySelector('.message-text').innerText;
        if (oldText === text) {
            // No changes, just reset
            cancelEdit();
            return;
        }

        editingMessageElement.querySelector('.message-text').innerHTML = formatText(text);
        editingMessageElement.style.background = '';
        
        // Remove all subsequent messages in the UI
        let next = editingMessageElement.nextElementSibling;
        while (next) {
            let toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
        }

        const msgIdToUpdate = editingMessageId;
        
        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatInput.placeholder = "Message AI Mitra...";
        sendBtn.disabled = true;

        updateMessageAndRegenerate(msgIdToUpdate, text);
        
        // Reset state
        editingMessageId = null;
        editingMessageElement = null;

    } else {
        // --- NEW MESSAGE MODE ---
        let isNewChat = false;
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer && chatContainer.classList.contains('landing-mode')) {
            isNewChat = true;
            chatContainer.classList.remove('landing-mode');
            if (welcomeScreen) {
                welcomeScreen.style.opacity = '0';
                setTimeout(() => {
                    welcomeScreen.style.display = 'none';
                }, 300);
            }
        } else {
            if (welcomeScreen) {
                welcomeScreen.style.display = 'none';
            }
        }

        addMessage('user', text);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.disabled = true;

        simulateBotResponse(text);
    }
}

function cancelEdit() {
    if (editingMessageElement) editingMessageElement.style.background = '';
    editingMessageId = null;
    editingMessageElement = null;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.placeholder = "Message AI Mitra...";
}

async function updateMessageAndRegenerate(messageId, text) {
    if (!messageId || messageId === 'null') {
        showToast('Cannot update: Message ID missing', 'alert-circle');
        return;
    }

    // Typing indicator
    const loadingRow = addMessage('bot', '', true);
    loadingRow.classList.add('loading');

    const chatModelSelect = document.getElementById('chatModelSelect');
    const selectedModel = chatModelSelect ? chatModelSelect.value : 'auto';

    console.log(`[Edit] Updating message ${messageId} with text: "${text}"`);

    try {
        const response = await fetch(`/api/chat/message/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt: text, selectedModel })
        });

        const data = await response.json();
        
        if (loadingRow.parentElement) messagesArea.removeChild(loadingRow);

        if (response.ok) {
            addMessage('bot', data.response, false, data.provider, data.botMessageId);
            showToast('Message updated', 'check');
        } else {
            console.error('Update failed:', data);
            addMessage('bot', data.error || "Failed to update message.");
            showToast('Update failed', 'alert-circle');
        }
    } catch (error) {
        if (loadingRow.parentElement) messagesArea.removeChild(loadingRow);
        console.error('Network/JSON Error during update:', error);
        addMessage('bot', "Network error while updating. Please check if the server is running.");
        showToast('Connection error', 'alert-circle');
    }
}

function addMessage(role, text, isTyping = false, provider = null, id = null, shouldType = false) {
    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${role}-row`;
    if (id) {
        messageRow.setAttribute('data-message-id', id);
        console.log(`[UI] Added message ID: ${id} for role: ${role}`);
    }

    let avatarHtml = '';
    if (role === 'user') {
        const initial = (currentUser && currentUser.name) ? currentUser.name.charAt(0).toUpperCase() : 'U';
        avatarHtml = `<div class="message-avatar" style="background: var(--accent-primary); color: white;">${initial}</div>`;
    } else {
        avatarHtml = `<div class="message-avatar"><div class="mini-logo-icon"></div></div>`;
    }
    
    let contentHtml = '';
    if (isTyping) {
        contentHtml = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>`;
    } else {
        contentHtml = shouldType ? '' : formatText(text);
    }

    const actionsHtml = `
        <div class="message-actions">
            <button class="msg-action-btn" title="Copy Text" onclick="copyMessageText(this)">
                <i data-lucide="copy"></i>
            </button>
            ${role === 'user' ? `
            <button class="msg-action-btn" title="Edit Message" onclick="editUserMessage(this)">
                <i data-lucide="edit-3"></i>
            </button>` : ''}
        </div>
    `;

    messageRow.innerHTML = `
        <div class="message-content">
            ${avatarHtml}
            <div class="message-text-wrapper">
                <div class="message-text">${contentHtml}</div>
                ${actionsHtml}
            </div>
        </div>

    `;

    messagesArea.appendChild(messageRow);

    if (shouldType && !isTyping) {
        const textElement = messageRow.querySelector('.message-text');
        typeMessage(textElement, text);
    }

    // Re-run Lucide to render icon in badge if present
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Scroll to bottom
    messagesArea.scrollTo({
        top: messagesArea.scrollHeight,
        behavior: 'smooth'
    });
    
    return messageRow;
}

async function typeMessage(element, text, speed = 80) {
    const lines = text.split('\n');
    let currentText = '';
    element.innerHTML = '';
    
    if (sendBtn) sendBtn.disabled = true;

    return new Promise(resolve => {
        let lineIndex = 0;
        const interval = setInterval(() => {
            if (lineIndex < lines.length) {
                currentText += lines[lineIndex] + (lineIndex < lines.length - 1 ? '\n' : '');
                element.innerHTML = formatText(currentText);
                lineIndex++;
                
                if (messagesArea) {
                    const isAtBottom = messagesArea.scrollHeight - messagesArea.scrollTop <= messagesArea.clientHeight + 150;
                    if (isAtBottom) {
                        messagesArea.scrollTop = messagesArea.scrollHeight;
                    }
                }
            } else {
                clearInterval(interval);
                element.innerHTML = formatText(text);
                if (sendBtn) sendBtn.disabled = chatInput.value.trim() === '';
                resolve();
            }
        }, speed);
    });
}


async function simulateBotResponse(userMsg) {
    // Typing indicator
    const loadingRow = addMessage('bot', '', true);
    loadingRow.classList.add('loading');

    const chatModelSelect = document.getElementById('chatModelSelect');
    const selectedModel = chatModelSelect ? chatModelSelect.value : 'auto';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({ prompt: userMsg, conversationId: currentConversationId, selectedModel })
        });

        const data = await response.json();

        messagesArea.removeChild(loadingRow);

        if (response.ok) {
            // If new chat, the backend generated an ID for us
            if (!currentConversationId && data.conversationId) {
                currentConversationId = data.conversationId;
                // Refresh history so the new chat shows up in the sidebar
                fetchChatHistory();
            }

            // Update user message ID in DOM if it was just created
            if (data.userMessageId) {
                const userRows = messagesArea.querySelectorAll('.user-row');
                const lastUserRow = userRows[userRows.length - 1];
                if (lastUserRow && !lastUserRow.getAttribute('data-message-id')) {
                    lastUserRow.setAttribute('data-message-id', data.userMessageId);
                }
            }

            addMessage('bot', data.response, false, data.provider, data.botMessageId, true);

            // Auto-update model selector UI if a fallback occurred
            if (data.provider && data.provider !== 'None' && data.provider !== 'Offline Fallback') {
                const modelKey = data.provider.toLowerCase().includes('gemini') ? 'gemini' : 
                                 data.provider.toLowerCase().includes('cohere') ? 'cohere' : null;
                
                if (modelKey) {
                    updateModelUI(modelKey);
                }
            }
        } else {
            console.error('API Error:', data);
            addMessage('bot', data.error || "I'm sorry, I encountered an error connecting to my servers.");
        }
    } catch (error) {
        messagesArea.removeChild(loadingRow);
        console.error('Fetch error:', error);
        addMessage('bot', "Network error. Please make sure the backend server is running.");
    }
}

// Utility to update Model Selector UI
function updateModelUI(modelValue) {
    const modelInput = document.getElementById('chatModelSelect');
    const selectedModelText = document.getElementById('selectedModelText');
    const modelContainer = document.getElementById('modelSelectorContainer');
    
    if (!modelInput || modelInput.value === modelValue) return;

    const option = document.querySelector(`.model-option[data-value="${modelValue}"]`);
    if (!option) return;

    // Update internal value
    modelInput.value = modelValue;
    
    // Update visible text
    if (selectedModelText) {
        selectedModelText.textContent = option.querySelector('span').textContent;
    }

    // Update icon
    const newIconName = option.dataset.icon;
    const triggerIconContainer = document.getElementById('selectedModelIconContainer');
    if (triggerIconContainer && newIconName) {
        triggerIconContainer.innerHTML = `<i data-lucide="${newIconName}"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Update active class in dropdown
    document.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');
}

// Message Actions Logic
window.copyMessageText = (btn) => {
    const textNode = btn.closest('.message-content').querySelector('.message-text');
    let cleanText = textNode.innerText || textNode.textContent;
    
    // Fallback for empty text
    if (!cleanText.trim()) return;

    navigator.clipboard.writeText(cleanText.trim()).then(() => {
        const row = btn.closest('.message-row');
        const icon = btn.querySelector('i');
        const oldIconName = icon ? icon.getAttribute('data-lucide') : 'copy';
        
        // 1. Ensure actions stay visible during feedback even if hover is lost
        if (row) row.classList.add('keep-actions');
        
        // 2. Update icon
        if (icon) {
            icon.setAttribute('data-lucide', 'check');
            icon.style.color = '#10b981';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // 3. Show Global Toast
        showToast('Text copied to clipboard', 'check');

        // 4. Reset after 2 seconds
        setTimeout(() => {
            const freshIcon = btn.querySelector('i') || btn.querySelector('svg');
            if (freshIcon) {
                if (freshIcon.tagName.toLowerCase() === 'svg') {
                    btn.innerHTML = `<i data-lucide="${oldIconName}"></i>`;
                } else {
                    freshIcon.setAttribute('data-lucide', oldIconName);
                    freshIcon.style.color = '';
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            
            if (row) row.classList.remove('keep-actions');
        }, 1500); // Shorter duration for simple icon swap
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Failed to copy text', 'alert-circle');
    });
};

window.editUserMessage = (btn) => {
    const row = btn.closest('.message-row');
    const msgId = row.getAttribute('data-message-id');
    const textNode = row.querySelector('.message-text');
    const cleanText = textNode.innerText || textNode.textContent;
    
    // Set edit state
    editingMessageId = msgId;
    editingMessageElement = row;

    // Put back in input and focus
    const input = document.getElementById('chatInput');
    if (input) {
        input.value = cleanText.trim();
        input.placeholder = "Edit your message...";
        input.focus();
        input.dispatchEvent(new Event('input')); // Trigger auto-grow
    }

    // Scroll to the message being edited
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.background = 'rgba(99, 102, 241, 0.05)';
};

// Global Toast Notification
function showToast(message, iconName = 'check') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 2700);
}

function formatText(text) {
    if (typeof marked === 'undefined') {
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }
    
    return marked.parse(text);
}


// --- Utilities ---

// New Chat Functionality
newChatBtn.addEventListener('click', resetChat);

function resetChat() {
    currentConversationId = null;
    messagesArea.innerHTML = '';
    messagesArea.appendChild(welcomeScreen);

    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) chatContainer.classList.add('landing-mode');

    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        // setTimeout ensures opacity transitions after display is set to block
        setTimeout(() => welcomeScreen.style.opacity = '1', 50);
    }

    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
}

// Theme Toggle
themeToggle.addEventListener('click', () => {
    const themes = ['dark', 'light', 'solarized-dark', 'solarized-light'];
    let currentIndex = themes.indexOf(currentTheme);
    currentTheme = themes[(currentIndex + 1) % themes.length];
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateHljsTheme(currentTheme);


    // Update Icon based on theme
    let iconName = 'moon';
    if (currentTheme === 'light') iconName = 'sun';
    else if (currentTheme === 'solarized-dark') iconName = 'cloud-moon';
    else if (currentTheme === 'solarized-light') iconName = 'cloud-sun';

    themeToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

function updateHljsTheme(theme) {
    const link = document.getElementById('hljsTheme');
    if (!link) return;
    
    let themeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
    if (theme === 'light') {
        themeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    } else if (theme === 'solarized-light') {
        themeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/solarized-light.min.css';
    } else if (theme === 'solarized-dark') {
        themeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/solarized-dark.min.css';
    }
    
    link.href = themeUrl;
}




// Clickable Suggestions
suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
        chatInput.value = chip.innerText;
        chatInput.dispatchEvent(new Event('input'));
        handleSendMessage();
    });
});

// Settings Dropdown Toggle
const settingsMenuBtn = document.getElementById('settingsMenuBtn');
const settingsDropdown = document.getElementById('settingsDropdown');

if (settingsMenuBtn && settingsDropdown) {
    settingsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!settingsDropdown.contains(e.target) && e.target !== settingsMenuBtn) {
            settingsDropdown.classList.remove('active');
        }
    });

    const dropdownItems = settingsDropdown.querySelectorAll('.dropdown-item:not([onclick]):not([id="profileDropdownItem"]):not([id="feedbackDropdownItem"]):not([id="helpDropdownItem"])');
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            settingsDropdown.classList.remove('active');
        });
    });

    const helpDropdownItem = document.getElementById('helpDropdownItem');
    if (helpDropdownItem) {
        helpDropdownItem.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme') || 'dark';
            window.open(`help.html?theme=${theme}`, '_blank');
            settingsDropdown.classList.remove('active');
        });
    }
}


// Profile Modal Logic
const profileDropdownItem = document.getElementById('profileDropdownItem');
const profileModalOverlay = document.getElementById('profileModalOverlay');
const cancelProfileBtn = document.getElementById('cancelProfileBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const displayNameInput = document.getElementById('displayNameInput');
const usernameInput = document.getElementById('usernameInput');
const globalModalAvatar = document.getElementById('modalAvatarLetter');
const sideAvatarLetter = document.getElementById('userAvatarLetter');

if (profileDropdownItem && profileModalOverlay) {
    profileDropdownItem.addEventListener('click', () => {
        if (!authToken) {
            showInfoModal(
                "Unlock your personalized profile. Sign up or log in to view and manage your account details.", 
                "Sign up / Log in", 
                () => simulateLogin(),
                "Maybe later"
            );
            return;
        }
        // Populate with current user details
        displayNameInput.value = currentUser.name;
        
        const profileEmailDisplay = document.getElementById('profileEmailDisplay');
        if (profileEmailDisplay) {
            profileEmailDisplay.innerText = currentUser.email || '';
        }

        // Extract username from email (first part before @)
        let derivedUsername = '';
        if (currentUser.email && currentUser.email.includes('@')) {
            derivedUsername = currentUser.email.split('@')[0];
        } else {
            derivedUsername = currentUser.name.toLowerCase().replace(/\s/g, '');
        }

        usernameInput.value = derivedUsername;
        globalModalAvatar.innerText = currentUser.name.charAt(0).toUpperCase();

        profileModalOverlay.classList.add('active');
        if (settingsDropdown) settingsDropdown.classList.remove('active');
    });

    cancelProfileBtn.addEventListener('click', () => {
        profileModalOverlay.classList.remove('active');
    });

    profileModalOverlay.addEventListener('click', (e) => {
        if (e.target === profileModalOverlay) {
            profileModalOverlay.classList.remove('active');
        }
    });

    saveProfileBtn.addEventListener('click', async () => {
        const newName = displayNameInput.value.trim();
        const newUsername = usernameInput.value.trim();

        saveProfileBtn.disabled = true;
        saveProfileBtn.classList.add('btn-loading');

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ fullName: newName, username: newUsername })
            });

            if (res.ok) {
                const user = await res.json();
                currentUser.name = user.fullName;


                if (sideAvatarLetter) sideAvatarLetter.innerText = currentUser.name.charAt(0).toUpperCase();

                const welcomeUserName = document.getElementById('welcomeUserName');
                if (welcomeUserName) {
                    welcomeUserName.innerText = currentUser.name;
                }

                profileModalOverlay.classList.remove('active');
            } else {
                const data = await res.json();
                showInfoModal(data.error || 'Failed to preserve profile details');
            }
        } catch (error) {
            console.error(error);
            showInfoModal('A network error occurred.');
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.classList.remove('btn-loading');
        }
    });

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const deleteAccountModalOverlay = document.getElementById('deleteAccountModalOverlay');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    if (deleteAccountBtn && deleteAccountModalOverlay) {
        deleteAccountBtn.addEventListener('click', () => {
            deleteAccountModalOverlay.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });

        cancelDeleteBtn.addEventListener('click', () => {
            deleteAccountModalOverlay.classList.remove('active');
        });

        deleteAccountModalOverlay.addEventListener('click', (e) => {
            if (e.target === deleteAccountModalOverlay) {
                deleteAccountModalOverlay.classList.remove('active');
            }
        });

        confirmDeleteBtn.addEventListener('click', async () => {
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.classList.add('btn-loading');

            try {
                const res = await fetch('/api/user/profile', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                if (res.ok) {
                    deleteAccountModalOverlay.classList.remove('active');
                    profileModalOverlay.classList.remove('active');
                    showInfoModal('Your account has been deleted. We will miss you!');
                    processLogout();
                } else {
                    const data = await res.json();
                    showInfoModal(data.error || 'Failed to delete account');
                }
            } catch (error) {
                console.error(error);
                showInfoModal('A network error occurred.');
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.classList.remove('btn-loading');
            }
        });
    }
}

// Logout Modal Logic
const logoutModalOverlay = document.getElementById('logoutModalOverlay');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

if (logoutModalOverlay) {
    cancelLogoutBtn.addEventListener('click', () => {
        logoutModalOverlay.classList.remove('active');
    });

    logoutModalOverlay.addEventListener('click', (e) => {
        if (e.target === logoutModalOverlay) {
            logoutModalOverlay.classList.remove('active');
        }
    });

    confirmLogoutBtn.addEventListener('click', () => {
        processLogout();
        logoutModalOverlay.classList.remove('active');
    });
}

// Auth Modal Logic
const authModalOverlay = document.getElementById('authModalOverlay');
const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const nameInputContainer = document.getElementById('nameInputContainer');

const authNameInput = document.getElementById('authNameInput');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');

const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const confirmPasswordContainer = document.getElementById('confirmPasswordContainer');
const authConfirmPasswordInput = document.getElementById('authConfirmPasswordInput');
const otpInputContainer = document.getElementById('otpInputContainer');
const authOtpInput = document.getElementById('authOtpInput');
const otpError = document.getElementById('otpError');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const forgotPasswordContainer = document.getElementById('forgotPasswordContainer');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

let isSignupMode = false;
// let loginAttempts = 0; // Removed attempt tracking as per request

function setAuthMode(signup) {
    isSignupMode = signup;
    // Reset view to method selection
    backToAuthMethods();

    // Clear errors
    if (nameError) nameError.style.display = 'none';
    if (emailError) emailError.style.display = 'none';
    if (passwordError) passwordError.style.display = 'none';
    if (confirmPasswordError) confirmPasswordError.style.display = 'none';
    if (authNameInput) authNameInput.parentElement.style.borderColor = '';
    if (authEmailInput) authEmailInput.parentElement.style.borderColor = '';
    if (authPasswordInput) authPasswordInput.parentElement.style.borderColor = '';
    if (authConfirmPasswordInput) authConfirmPasswordInput.parentElement.style.borderColor = '';

    // Clear inputs
    if (authNameInput) authNameInput.value = '';
    if (authEmailInput) authEmailInput.value = '';
    if (authPasswordInput) authPasswordInput.value = '';
    if (authConfirmPasswordInput) authConfirmPasswordInput.value = '';

    if (signup) {
        tabSignup.style.background = 'var(--accent-gradient)';
        tabSignup.style.color = 'white';
        tabSignup.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)';

        tabLogin.style.background = 'transparent';
        tabLogin.style.color = 'var(--text-muted)';
        tabLogin.style.boxShadow = 'none';

        nameInputContainer.style.display = 'flex';
        confirmPasswordContainer.style.display = 'flex';
        otpInputContainer.style.display = 'none';
        sendOtpBtn.style.display = 'block';
        authSubmitBtn.style.display = 'none';
        if (forgotPasswordContainer) forgotPasswordContainer.style.display = 'none';

        const continueEmailText = document.getElementById('continueEmailText');
        if (continueEmailText) continueEmailText.innerText = "Continue with AI Mitra";
    } else {
        tabLogin.style.background = 'var(--accent-gradient)';
        tabLogin.style.color = 'white';
        tabLogin.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)';

        tabSignup.style.background = 'transparent';
        tabSignup.style.color = 'var(--text-muted)';
        tabSignup.style.boxShadow = 'none';

        nameInputContainer.style.display = 'none';
        confirmPasswordContainer.style.display = 'none';
        otpInputContainer.style.display = 'none';
        sendOtpBtn.style.display = 'none';
        authSubmitBtn.style.display = 'block';

        // Show forgot password instantly in login mode
        if (forgotPasswordContainer) forgotPasswordContainer.style.display = 'block';

        authSubmitBtn.innerText = 'Log in';

        const continueEmailText = document.getElementById('continueEmailText');
        if (continueEmailText) continueEmailText.innerText = "Log in with AI Mitra";
    }
}

if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
        const email = authEmailInput.value.trim();
        const name = authNameInput.value.trim();
        const pass = authPasswordInput.value.trim();
        const confirm = authConfirmPasswordInput.value.trim();

        // Basic validation before sending OTP
        if (!name || !email || !pass || !confirm) {
            showInfoModal('Please fill all fields before requesting a code.');
            return;
        }

        if (pass !== confirm) {
            showInfoModal('Passwords do not match.');
            return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.classList.add('btn-loading');

        try {
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (response.ok) {
                showInfoModal(`Verification code sent to ${email}! Please check your inbox.`, "Got it");
                otpInputContainer.style.display = 'flex';
                sendOtpBtn.style.display = 'none';
                authSubmitBtn.style.display = 'block';
                authSubmitBtn.innerText = 'Create Account';
            } else {
                showInfoModal(data.error || 'Failed to send code.');
                sendOtpBtn.disabled = false;
                sendOtpBtn.classList.remove('btn-loading');
            }
        } catch (err) {
            console.error('OTP Error:', err);
            showInfoModal('Error connecting to server.');
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerText = 'Send Verification Code';
        }
    });
}

const GOOGLE_CLIENT_ID = "377795330142-v4ivcei3umbesj9mf5uisvef98a1ser5.apps.googleusercontent.com"; 
let googleInitialized = false;

function initializeGoogleAuth() {
    if (typeof google === 'undefined') {
        setTimeout(initializeGoogleAuth, 100);
        return;
    }
    
    if (!googleInitialized) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            ux_mode: "popup",
            auto_select: false
        });
        
        // This triggers the "One Tap" prompt (floating popup at top right)
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.log("One Tap status:", notification.getNotDisplayedReason() || notification.getSkippedReason());
            }
        });
        
        googleInitialized = true;
    }

    const btnContainer = document.getElementById("googleSignInButton");
    if (btnContainer && btnContainer.innerHTML === "") { // Only render if empty
        google.accounts.id.renderButton(
            btnContainer,
            { 
                theme: "filled_blue", 
                size: "large", 
                width: 320, 
                shape: "pill",
                text: "continue_with",
                logo_alignment: "left"
            }
        );
    }
}

let isProcessingGoogle = false;

async function handleCredentialResponse(response) {
    if (isProcessingGoogle) return;
    isProcessingGoogle = true;

    // --- INSTANT OPTIMISTIC UI UPDATE (Zero Lag) ---
    // Extract info locally from Google's token to show the name immediately
    try {
        const payload = decodeJwtResponse(response.credential);
        const name = payload.name;
        
        // Update all UI labels instantly before the server even responds
        if (name) {
            const sideAvatarLetter = document.getElementById('userAvatarLetter');
            if (sideAvatarLetter) sideAvatarLetter.innerText = name.charAt(0).toUpperCase();
            const welcomeUserName = document.getElementById('welcomeUserName');
            if (welcomeUserName) welcomeUserName.innerText = name;
            const sidebarUserNameSpan = document.getElementById('sidebarUserNameSpan');
            if (sidebarUserNameSpan) sidebarUserNameSpan.innerText = name;
        }
    } catch (err) {
        console.warn("Optimistic update failed, waiting for server...", err);
    }

    try {
        const res = await fetch('/api/auth/google-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: response.credential })
        });

        const data = await res.json();
        
        if (res.ok) {
            currentUser.name = data.user.fullName;
            currentUser.id = data.user.id;
            currentUser.email = data.user.email;
            currentUser.avatar = data.user.avatar;
            authToken = data.token;
            
            localStorage.setItem('token', authToken);

            // Update UI session state
            document.body.classList.remove('is-logged-out');
            if (sidebar) sidebar.classList.add('collapsed');
            
            updateWelcomeScreen();

            // Refresh user elements
            const sideAvatarLetter = document.getElementById('userAvatarLetter');
            if (sideAvatarLetter) sideAvatarLetter.innerText = currentUser.name.charAt(0).toUpperCase();
            
            const welcomeUserName = document.getElementById('welcomeUserName');
            if (welcomeUserName) welcomeUserName.innerText = currentUser.name;

            const sidebarUserNameSpan = document.getElementById('sidebarUserNameSpan');
            if (sidebarUserNameSpan) sidebarUserNameSpan.innerText = currentUser.name;

            // Close Modal
            const authModalOverlay = document.getElementById('authModalOverlay');
            if (authModalOverlay) authModalOverlay.classList.remove('active');
            
            fetchChatHistory();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            console.error('Login Error details:', data);
        }
    } catch (err) {
        console.error('Google Server connection failed:', err);
    } finally {
        isProcessingGoogle = false;
    }
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function showAuthForm() {
    document.getElementById('authMethodSelection').style.display = 'none';
    document.getElementById('authFormContainer').style.display = 'block';
}

function backToAuthMethods() {
    const authForm = document.getElementById('authFormContainer');
    const methodSelection = document.getElementById('authMethodSelection');
    const tabsHeader = document.getElementById('authTabsHeader');

    if (authForm) authForm.style.display = 'none';
    if (methodSelection) methodSelection.style.display = 'flex';
    if (tabsHeader) tabsHeader.style.display = 'flex';
}

// Re-init Google button whenever the modal opens to ensure it renders correctly
function openAuthModal(signup = false) {
    const authModalOverlay = document.getElementById('authModalOverlay');
    if (authModalOverlay) {
        authModalOverlay.classList.add('active');
        setAuthMode(signup);
        initializeGoogleAuth();
    }
}

// Password visibility toggle logic
document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const passwordInput = document.getElementById(targetId);
        if (passwordInput && passwordInput.type === 'password') {
            passwordInput.type = 'text';
            btn.innerText = 'Hide';
        } else if (passwordInput) {
            passwordInput.type = 'password';
            btn.innerText = 'Show';
        }
    });
});

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pwd) {
    // Requires at least one letter, one number, min 8 characters.
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&_.\-]{8,}$/.test(pwd);
}

function showError(element, inputEl, message) {
    element.innerText = message;
    element.style.display = 'block';
    inputEl.parentElement.style.borderColor = '#ef4444';
}

function hideError(element, inputEl) {
    element.style.display = 'none';
    inputEl.parentElement.style.borderColor = '';
}

if (authModalOverlay) {
    if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode(false));
    if (tabSignup) tabSignup.addEventListener('click', () => setAuthMode(true));

    if (closeAuthModalBtn) {
        closeAuthModalBtn.addEventListener('click', () => {
            authModalOverlay.classList.remove('active');
        });
    }

    authModalOverlay.addEventListener('click', (e) => {
        if (e.target === authModalOverlay) {
            authModalOverlay.classList.remove('active');
        }
    });

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', () => {
            const name = authNameInput.value.trim();
            const email = authEmailInput.value.trim();
            const password = authPasswordInput.value;
            const confirmPassword = authConfirmPasswordInput.value;
            const otp = authOtpInput.value.trim();

            let isValid = true;

            hideError(nameError, authNameInput);
            hideError(emailError, authEmailInput);
            hideError(passwordError, authPasswordInput);
            hideError(confirmPasswordError, authConfirmPasswordInput);
            hideError(otpError, authOtpInput);

            if (isSignupMode) {
                if (!name) {
                    showError(nameError, authNameInput, "Name is required");
                    isValid = false;
                }
                if (!otp) {
                    showError(otpError, authOtpInput, "Verification code is required");
                    isValid = false;
                } else if (otp.length < 6) {
                    showError(otpError, authOtpInput, "OTP must be 6 digits");
                    isValid = false;
                }
            }

            if (!email) {
                showError(emailError, authEmailInput, "Email is required");
                isValid = false;
            } else if (!validateEmail(email)) {
                showError(emailError, authEmailInput, "Please enter a valid email address");
                isValid = false;
            }

            if (!password) {
                showError(passwordError, authPasswordInput, "Password is required");
                isValid = false;
            } else if (isSignupMode && !validatePassword(password)) {
                showError(passwordError, authPasswordInput, "Min 8 chars, must include letters and numbers");
                isValid = false;
            } else if (!isSignupMode && password.length < 1) {
                showError(passwordError, authPasswordInput, "Password is required");
                isValid = false;
            }

            if (isSignupMode) {
                if (!confirmPassword) {
                    showError(confirmPasswordError, authConfirmPasswordInput, "Please confirm your password");
                    isValid = false;
                } else if (password !== confirmPassword) {
                    showError(confirmPasswordError, authConfirmPasswordInput, "Passwords do not match");
                    isValid = false;
                }
            }

            if (isValid) {
                const endpoint = isSignupMode ? '/api/auth/signup' : '/api/auth/login';
                const payload = isSignupMode
                    ? { fullName: name, email, password, otp }
                    : { email, password };

                authSubmitBtn.disabled = true;
                authSubmitBtn.classList.add('btn-loading');

                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(async res => {
                        const data = await res.json();
                        return { status: res.status, ok: res.ok, body: data };
                    })
                    .then(res => {
                        authSubmitBtn.disabled = false;
                        authSubmitBtn.classList.remove('btn-loading');

                        if (res.ok) {
                            // Success!
                            authToken = res.body.token;
                            localStorage.setItem('token', authToken);

                            currentUser.name = res.body.user.displayName || res.body.user.fullName;
                            currentUser.id = res.body.user.id;
                            currentUser.email = res.body.user.email;

                            body.classList.remove('is-logged-out');
                            if (sidebar) sidebar.classList.add('collapsed');
                            
                            updateWelcomeScreen();

                            // Explicitly clear all modal states
                            const authModalOverlay = document.getElementById('authModalOverlay');
                            if (authModalOverlay) authModalOverlay.classList.remove('active');

                            const sideAvatarLetter = document.getElementById('userAvatarLetter');
                            if (sideAvatarLetter) sideAvatarLetter.innerText = currentUser.name.charAt(0).toUpperCase();

                            const welcomeUserName = document.getElementById('welcomeUserName');
                            if (welcomeUserName) welcomeUserName.innerText = currentUser.name;

                            const sidebarUserNameSpan = document.getElementById('sidebarUserNameSpan');
                            if (sidebarUserNameSpan) sidebarUserNameSpan.innerText = currentUser.name;

                            fetchChatHistory();
                        } else {
                            // Error reported by backend
                            showError(emailError, authEmailInput, res.body.error || 'Authentication failed');
                        }
                    })
                    .catch(err => {
                        console.error('SIGNUP FETCH ERROR:', err);
                        authSubmitBtn.disabled = false;
                        authSubmitBtn.classList.remove('btn-loading');
                        
                        // Check if we actually have a token (silent signup detection)
                        const possibleToken = localStorage.getItem('token');
                        if (possibleToken && isSignupMode) {
                            console.log("Detected silent signup success despite fetch error.");
                            location.reload(); 
                        } else {
                            showError(emailError, authEmailInput, 'Unable to connect to server. Please try again.');
                        }
                    });
            }
        });
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                const email = authEmailInput.value.trim();
                if (!email) {
                    showError(emailError, authEmailInput, "Please enter your email first");
                    return;
                }
                if (!validateEmail(email)) {
                    showError(emailError, authEmailInput, "Please enter a valid email address");
                    return;
                }

                forgotPasswordLink.classList.add('btn-loading');
                forgotPasswordLink.style.pointerEvents = 'none';

                // Request password reset email
                fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                })
                    .then(res => res.json().then(data => ({ status: res.status, ok: res.ok, body: data })))
                    .then(res => {
                        forgotPasswordLink.classList.remove('btn-loading');
                        forgotPasswordLink.style.pointerEvents = 'auto';

                        if (res.ok) {
                            showInfoModal(res.body.message || "Reset link has been sent to your email!", "Got it", () => {
                                authModalOverlay.classList.remove('active');
                            });
                        } else {
                            showError(emailError, authEmailInput, res.body.error || "No account found with this email");
                        }
                    })
                    .catch(err => {
                        forgotPasswordLink.classList.remove('btn-loading');
                        forgotPasswordLink.style.pointerEvents = 'auto';
                        console.error("Forgot password error", err);
                        showInfoModal("Unable to process request. Please try again later.");
                    });
            });
        }
    }

    // --- Feedback Modal Logic ---
    const feedbackDropdownItem = document.getElementById('feedbackDropdownItem');
    const feedbackModalOverlay = document.getElementById('feedbackModalOverlay');
    const feedbackTextarea = document.getElementById('feedbackTextarea');
    const feedbackSendBtn = document.getElementById('feedbackSendBtn');
    const closeFeedbackModalBtn = document.getElementById('closeFeedbackModalBtn');

    if (feedbackDropdownItem && feedbackModalOverlay) {
        let currentRating = 0;
        const starBtns = document.querySelectorAll('.star-btn');
        const feedbackFormContent = document.getElementById('feedbackFormContent');
        const feedbackSuccessContent = document.getElementById('feedbackSuccessContent');
        const feedbackDoneBtn = document.getElementById('feedbackDoneBtn');
        const feedbackSuccessTitle = document.getElementById('feedbackSuccessTitle');
        const feedbackSuccessMessage = document.getElementById('feedbackSuccessMessage');

        feedbackDropdownItem.addEventListener('click', () => {
            const token = localStorage.getItem('token');
            if (!token) {
                if (settingsDropdown) settingsDropdown.classList.remove('active');
                openAuthModal(false);
                return;
            }

            feedbackModalOverlay.classList.add('active');
            if (settingsDropdown) settingsDropdown.classList.remove('active');
            
            // Reset views
            feedbackFormContent.style.display = 'block';
            feedbackSuccessContent.style.display = 'none';
            
            // Reset state
            feedbackTextarea.value = '';
            currentRating = 0;
            updateStars(0);
            updateSendButtonState();
            
            setTimeout(() => feedbackTextarea.focus(), 300);
        });

        // Star Selection Logic
        starBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentRating = parseInt(btn.dataset.rating);
                updateStars(currentRating);
                updateSendButtonState();
            });
        });

        function updateStars(rating) {
            starBtns.forEach(btn => {
                const btnRating = parseInt(btn.dataset.rating);
                if (btnRating <= rating) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        function updateSendButtonState() {
            const hasText = feedbackTextarea.value.trim() !== '';
            feedbackSendBtn.disabled = !hasText || currentRating === 0;
        }

        feedbackTextarea.addEventListener('input', updateSendButtonState);

        feedbackSendBtn.addEventListener('click', async () => {
            const feedbackText = feedbackTextarea.value.trim();
            if (feedbackText && currentRating > 0) {
                const token = localStorage.getItem('token');
                try {
                    // Send to backend
                    const res = await fetch('/api/user/feedback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            rating: currentRating,
                            text: feedbackText
                        })
                    });

                    if (!res.ok) {
                        console.error('Failed to submit feedback');
                        showToast('Failed to submit feedback', 'x');
                        return;
                    }

                    // Determine Success Message based on rating
                    let title = "Thank you!";
                let message = "We appreciate your feedback and will use it to make AI Mitra better.";

                if (currentRating === 5) {
                    title = "We're Thrilled!";
                    message = "We're so happy you're loving AI Mitra! Your support keeps us inspired to build bigger and better things.";
                } else if (currentRating === 4) {
                    title = "Awesome!";
                    message = "Great to hear you're enjoying the experience! We'll keep working hard to earn that 5-star rating from you.";
                } else if (currentRating <= 3) {
                    title = "Thank You!";
                    message = "We appreciate your honest feedback. We're constantly refining AI Mitra and your input helps us tremendously.";
                }

                feedbackSuccessTitle.innerText = title;
                feedbackSuccessMessage.innerText = message;

                // Toggle views with a smooth transition hidden by JS
                feedbackFormContent.style.display = 'none';
                feedbackSuccessContent.style.display = 'block';
                
                // Finalize Lucide icons in second view
                if (typeof lucide !== 'undefined') lucide.createIcons();
                } catch (error) {
                    console.error('Feedback error:', error);
                    showToast('An error occurred', 'x');
                }
            }
        });

        if (feedbackDoneBtn) {
            feedbackDoneBtn.addEventListener('click', () => {
                feedbackModalOverlay.classList.remove('active');
            });
        }

        closeFeedbackModalBtn.addEventListener('click', () => feedbackModalOverlay.classList.remove('active'));
        feedbackModalOverlay.addEventListener('click', (e) => {
            if (e.target === feedbackModalOverlay) feedbackModalOverlay.classList.remove('active');
        });
    }

    // --- About Page Logic ---
    const aboutDropdownItem = document.getElementById('aboutDropdownItem');
    if (aboutDropdownItem) {
        aboutDropdownItem.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme') || 'dark';
            window.open(`about.html?theme=${theme}`, '_blank');
            if (settingsDropdown) settingsDropdown.classList.remove('active');
        });
    }

    // Info Modal Helper
    function showInfoModal(message, primaryBtnText = 'OK', actionCallback = null, secondaryBtnText = null, secondaryCallback = null) {
        const infoModal = document.getElementById('infoModalOverlay');
        const infoMsg = document.getElementById('infoModalMessage');
        const infoActionBtn = document.getElementById('infoModalActionBtn');
        const closeInfoBtn = document.getElementById('closeInfoModalBtn');
        const settingsDropdown = document.getElementById('settingsDropdown');

        if (infoModal && infoMsg) {
            infoMsg.innerText = message;
            infoActionBtn.innerText = primaryBtnText;
            
            // Handle Secondary Button
            if (secondaryBtnText) {
                closeInfoBtn.innerText = secondaryBtnText;
                closeInfoBtn.style.display = 'block';
            } else {
                // If only one button, rename OK to something logical if default
                closeInfoBtn.style.display = 'none';
            }

            infoModal.classList.add('active');
            if (settingsDropdown) settingsDropdown.classList.remove('active');

            // --- Reset Primary Listener ---
            const newActionBtn = infoActionBtn.cloneNode(true);
            infoActionBtn.parentNode.replaceChild(newActionBtn, infoActionBtn);
            newActionBtn.addEventListener('click', () => {
                infoModal.classList.remove('active');
                if (actionCallback) actionCallback();
            });

            // --- Reset Secondary Listener ---
            const newCloseBtn = closeInfoBtn.cloneNode(true);
            closeInfoBtn.parentNode.replaceChild(newCloseBtn, closeInfoBtn);
            newCloseBtn.addEventListener('click', () => {
                infoModal.classList.remove('active');
                if (secondaryCallback) secondaryCallback();
            });

            infoModal.addEventListener('click', (e) => {
                if (e.target === infoModal) infoModal.classList.remove('active');
            });
        }
    }
}