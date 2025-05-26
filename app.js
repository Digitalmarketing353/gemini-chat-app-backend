// app.js (User Frontend - C:\Users\akele\gemini\app.js)
// Version with UI fixes for panel and initial chat state
console.log("User frontend app.js (v6 - UI & Panel Fixes) loaded");

// --- DOM Elements ---
const authContainer = document.getElementById('auth-container');
const loginFormContainer = document.getElementById('login-form-container');
const registerFormContainer = document.getElementById('register-form-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const loginErrorP = document.getElementById('login-error');
const registerErrorP = document.getElementById('register-error');

const appContainer = document.getElementById('app-container');
const currentUsernameDisplay = document.getElementById('current-username-display');
const logoutButton = document.getElementById('logout-button');

// Panel and Chat Elements
const menuToggleButton = document.getElementById('menu-toggle-button');
const conversationPanel = document.getElementById('conversations-list-panel');
const mainChatLayout = document.querySelector('.main-chat-layout'); // Parent of panel and chat-interface
const conversationsUl = document.getElementById('conversations-ul');
const newChatButton = document.getElementById('new-chat-button');
const chatInterface = document.getElementById('chat-interface'); // Main chat area
const chatMessagesDisplay = document.getElementById('chat-messages-display');
const messageInputForm = document.getElementById('message-input-form');
const messageInputField = document.getElementById('message-input-field');
const placeholderMessage = document.querySelector('#chat-messages-display .placeholder-message');

// --- State ---
let currentUser = null;
let conversations = [];
let currentConversationId = null;
let currentConversationTitle = null; // Initially no title for current convo

// --- State specific to streaming with RAF ---
let activeAIMessageElement = null;
let currentAIResponseForRAF = "";
let animationFrameId = null;
let pendingTextForRAF = "";

// --- API Base URL ---
const API_BASE_URL = 'http://localhost:3000/api';

// --- Helper Functions ---
function displayError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    } else { console.warn("displayError: Provided element is null for message:", message); }
}
function clearError(element) {
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}
function showView(view) {
    console.log(`Frontend: showView called with view = '${view}'`);
    if (authContainer) authContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'none';
    if (loginFormContainer) loginFormContainer.style.display = 'none';
    if (registerFormContainer) registerFormContainer.style.display = 'none';

    if (view === 'login') {
        if (authContainer) authContainer.style.display = 'block';
        if (loginFormContainer) loginFormContainer.style.display = 'block';
    } else if (view === 'register') {
        if (authContainer) authContainer.style.display = 'block';
        if (registerFormContainer) registerFormContainer.style.display = 'block';
    } else if (view === 'app') {
        if (appContainer) appContainer.style.display = 'flex';
    }
}

// --- Panel Toggle ---
function toggleConversationPanel() {
    if (conversationPanel && mainChatLayout) {
        const isCurrentlyCollapsed = conversationPanel.classList.contains('collapsed');
        conversationPanel.classList.toggle('collapsed', !isCurrentlyCollapsed);
        mainChatLayout.classList.toggle('panel-collapsed', !isCurrentlyCollapsed);
        // Store preference if needed:
        // localStorage.setItem('conversationPanelCollapsed', !isCurrentlyCollapsed);
        console.log(`Panel toggled. Now ${!isCurrentlyCollapsed ? 'collapsed' : 'open'}`);
    }
}

// --- Authentication State Check and Initialization ---
async function checkLoginState() {
    console.log("Frontend: checkLoginState() called.");
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, { method: 'GET' });
        console.log("Frontend: /api/auth/me response status:", response.status);

        if (response.ok) {
            const userData = await response.json();
            currentUser = { id: userData.id, username: userData.username, isAdmin: userData.isAdmin };
            if (currentUsernameDisplay) currentUsernameDisplay.textContent = currentUser.username;
            showView('app');
            await loadConversations();
            // DO NOT automatically select a conversation or new chat here.
            // Let the user decide. The placeholder message will show.
            resetChatInterfaceToPlaceholder();
        } else {
            // ... (error handling as before, then call handleLogout(false)) ...
            await handleLogout(false);
        }
    } catch (err) {
        console.error('Frontend: Error in checkLoginState():', err);
        await handleLogout(false);
    }
}

// --- Authentication Functions (handleRegister, handleLogin, handleLogout) ---
// Keep these as they were in the previous "full app.js with RAF and Markdown" version
// Ensure handleLogin calls checkLoginState() after successful API call.
// Ensure handleLogout calls showView('login') and resets relevant state.
async function handleRegister(event) { /* ... same as before ... */ 
    event.preventDefault();
    if (registerErrorP) clearError(registerErrorP);
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Registration failed');
        showView('login');
        if (loginForm && loginForm.querySelector('#login-username')) loginForm.querySelector('#login-username').value = username;
        if (loginErrorP) displayError(loginErrorP, 'Registration successful! Please login.');
    } catch (err) { if (registerErrorP) displayError(registerErrorP, err.message); }
}

async function handleLogin(event) {
    event.preventDefault();
    if (loginErrorP) clearError(loginErrorP);
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');
        console.log('Local Login API call successful. Backend should have set app_token cookie.');
        await checkLoginState();
    } catch (err) { if (loginErrorP) displayError(loginErrorP, err.message); }
}

async function handleLogout(doRedirect = true) {
    console.log("Frontend: handleLogout called, doRedirect =", doRedirect);
    currentUser = null; currentConversationId = null; conversations = []; currentConversationTitle = null;
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
        console.log("Frontend: Backend logout call successful.");
    } catch (err) { console.error("Frontend: Error calling backend logout:", err);
    } finally {
        if (conversationsUl) conversationsUl.innerHTML = '';
        resetChatInterfaceToPlaceholder(); // Reset chat UI
        if (currentUsernameDisplay) currentUsernameDisplay.textContent = '';
        showView('login');
        if (doRedirect) window.history.replaceState({}, document.title, "/");
    }
}


// --- Conversation Functions ---
async function loadConversations() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_BASE_URL}/chat/conversations`);
        if (!response.ok) {
            if (response.status === 401) { await handleLogout(); return; }
            throw new Error((await response.json().catch(()=>({}))).message || 'Failed to load conversations');
        }
        conversations = await response.json();
        renderConversations();
    } catch (err) { console.error('Error loading conversations:', err); }
}

function renderConversations() {
    if (!conversationsUl) return;
    conversationsUl.innerHTML = '';
    if (!conversations || conversations.length === 0) {
        conversationsUl.innerHTML = '<li class="no-convos-message">No conversations yet.</li>'; return;
    }
    conversations.forEach(convo => {
        const li = document.createElement('li');
        li.textContent = convo.title || `Conversation ${convo.id}`;
        li.dataset.id = convo.id;
        li.dataset.title = convo.title || `Conversation ${convo.id}`;
        // Do not add 'active' class here; selectConversation will handle it
        li.addEventListener('click', () => selectConversation(convo.id, convo.title));
        conversationsUl.appendChild(li);
    });
}

function resetChatInterfaceToPlaceholder() {
    if (chatMessagesDisplay) chatMessagesDisplay.innerHTML = ''; // Clear messages
    if (placeholderMessage) {
        placeholderMessage.textContent = 'Select a conversation from the left, or click "New Chat" to begin.';
        placeholderMessage.style.display = 'block';
    }
    // Unhighlight any active conversation
    document.querySelectorAll('#conversations-ul li.active').forEach(li => li.classList.remove('active'));
    currentConversationId = null; // No conversation is active
    currentConversationTitle = null;
    console.log("Frontend: Chat interface reset to placeholder.");
}

async function selectConversation(conversationId, title = "New Chat") {
    console.log(`Frontend: selectConversation ID: ${conversationId}, Title: ${title}`);
    if (currentConversationId === conversationId && conversationId !== null) {
        console.log("Frontend: Same conversation selected, no action needed.");
        return; // Avoid reloading if same convo is clicked
    }

    currentConversationId = conversationId;
    currentConversationTitle = title;

    document.querySelectorAll('#conversations-ul li').forEach(li => {
        li.classList.remove('active');
        if (li.dataset.id === String(conversationId)) {
            li.classList.add('active');
        }
    });

    if (chatMessagesDisplay) chatMessagesDisplay.innerHTML = '';
    if (placeholderMessage) placeholderMessage.style.display = 'none';

    if (conversationId) { // Fetching messages for an existing conversation
        try {
            const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`);
            if (!response.ok) {
                if (response.status === 401) { await handleLogout(); return; }
                throw new Error((await response.json().catch(()=>({}))).message || 'Failed to load messages');
            }
            const messages = await response.json();
            if (chatMessagesDisplay) {
                if (messages.length === 0) {
                    if(placeholderMessage) {
                        placeholderMessage.textContent = "No messages in this conversation yet. Send one to start!";
                        placeholderMessage.style.display = 'block';
                    }
                } else {
                    messages.forEach(msg => appendMessageToUI(msg.content, msg.role, msg.createdAt));
                }
            }
        } catch (err) {
            console.error('Error loading messages:', err);
            if (chatMessagesDisplay) appendMessageToUI(marked.parse(`Error loading messages: ${err.message}`), 'system', new Date().toISOString());
        }
    } else { // New chat mode (currentConversationId is null)
        currentConversationTitle = "New Chat"; // Explicitly set title for new chat state
        if (placeholderMessage) {
            placeholderMessage.textContent = 'Type a message to start a new conversation with AI.';
            placeholderMessage.style.display = 'block';
        }
    }
    if (messageInputField) messageInputField.focus();
    if (window.innerWidth < 768 && conversationPanel && !conversationPanel.classList.contains('collapsed')) {
        toggleConversationPanel(); // Auto-collapse panel on mobile after selecting a convo
    }
}

function handleNewChat() {
    console.log("Frontend: handleNewChat called");
    selectConversation(null, "New Chat"); // This sets currentConversationId to null
}

// --- Message UI Functions (with RAF and Markdown) ---
// appendMessageToUI, _renderBufferedAIMessage, updateStreamingAIMessageRAF, finalizeAIMessage
// Keep these exactly as they were in the previous "full app.js with RAF and Markdown" version.
// For brevity, I'm not repeating them here, but they are essential.
// Ensure appendMessageToUI adds 'user-row' or 'model-row' to the parent of the bubble.

function appendMessageToUI(text, role, timestamp, isStreamingPlaceholder = false) {
    if (!chatMessagesDisplay) return null;
    if (placeholderMessage && placeholderMessage.style.display !== 'none') placeholderMessage.style.display = 'none';
    
    const messageRowDiv = document.createElement('div'); // Create the outer row
    messageRowDiv.classList.add('message-row');
    messageRowDiv.classList.add(role.toLowerCase() === 'user' ? 'user-row' : 'model-row');

    const messageBubbleDiv = document.createElement('div'); // This is the actual bubble
    messageBubbleDiv.classList.add('message-bubble', role.toLowerCase());
    
    // Avatar Logic (simple initials) - Place according to CSS order rules
    if (role.toLowerCase() === 'model') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar', 'model-avatar');
        avatarDiv.textContent = 'AI';
        messageRowDiv.appendChild(avatarDiv); // Model avatar before bubble in DOM
    }
    
    const roleSpan = document.createElement('span');
    roleSpan.classList.add('role');
    roleSpan.textContent = role.toUpperCase();
    messageBubbleDiv.appendChild(roleSpan);
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('content');
    if ((role === 'model' || role === 'system') && !isStreamingPlaceholder && typeof marked !== 'undefined') {
        contentDiv.innerHTML = marked.parse(text || "");
    } else {
        contentDiv.innerHTML = isStreamingPlaceholder ? text : (text || "").replace(/\n/g, '<br>');
    }
    messageBubbleDiv.appendChild(contentDiv);
    
    if (timestamp && !isStreamingPlaceholder) {
        const timeSpan = document.createElement('span');
        timeSpan.classList.add('timestamp');
        timeSpan.textContent = new Date(timestamp).toLocaleString();
        messageBubbleDiv.appendChild(timeSpan);
    }
    
    messageRowDiv.appendChild(messageBubbleDiv); // Add bubble to the row

    if (role.toLowerCase() === 'user') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar', 'user-avatar');
        avatarDiv.textContent = currentUser ? currentUser.username.substring(0,1).toUpperCase() : 'U';
        messageRowDiv.appendChild(avatarDiv); // User avatar after bubble in DOM
    }

    chatMessagesDisplay.appendChild(messageRowDiv);
    chatMessagesDisplay.scrollTop = chatMessagesDisplay.scrollHeight;
    
    if (isStreamingPlaceholder && role.toLowerCase() === 'model') {
        activeAIMessageElement = messageBubbleDiv; // The bubble is what we update
        currentAIResponseForRAF = ""; 
        pendingTextForRAF = "";      
        if (animationFrameId) {    
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        activeAIMessageElement.classList.add('streaming');
    }
    return messageBubbleDiv; 
}

function _renderBufferedAIMessage() { /* ... same as before ... */ 
    if (activeAIMessageElement && pendingTextForRAF) {
        const contentDiv = activeAIMessageElement.querySelector('.content');
        if (contentDiv.textContent === "Thinking...") {
            contentDiv.innerHTML = ""; 
            currentAIResponseForRAF = pendingTextForRAF; 
        } else {
            currentAIResponseForRAF += pendingTextForRAF; 
        }
        if (typeof marked !== 'undefined') {
            contentDiv.innerHTML = marked.parse(currentAIResponseForRAF || "");
        } else { 
            contentDiv.innerHTML = (currentAIResponseForRAF || "").replace(/\n/g, '<br>');
        }
        pendingTextForRAF = ""; 
        if (chatMessagesDisplay) chatMessagesDisplay.scrollTop = chatMessagesDisplay.scrollHeight;
    }
    animationFrameId = null; 
}
function updateStreamingAIMessageRAF(textChunk) { /* ... same as before ... */ 
    pendingTextForRAF += textChunk; 
    if (!animationFrameId) { 
        animationFrameId = requestAnimationFrame(_renderBufferedAIMessage);
    }
}
function finalizeAIMessage(finalTimestamp) { /* ... same as before ... */
    if (animationFrameId) { 
        cancelAnimationFrame(animationFrameId);
        _renderBufferedAIMessage(); 
    }
    if (activeAIMessageElement) {
        const contentDiv = activeAIMessageElement.querySelector('.content');
        if(contentDiv) {
            if (typeof marked !== 'undefined') {
                contentDiv.innerHTML = marked.parse(currentAIResponseForRAF || "");
            } else {
                contentDiv.innerHTML = (currentAIResponseForRAF || "").replace(/\n/g, '<br>');
            }
        }
        let timeSpan = activeAIMessageElement.querySelector('.timestamp');
        if (!timeSpan && finalTimestamp) {
            timeSpan = document.createElement('span');
            timeSpan.classList.add('timestamp');
            activeAIMessageElement.appendChild(timeSpan);
        }
        if (timeSpan && finalTimestamp) timeSpan.textContent = new Date(finalTimestamp).toLocaleString();
        activeAIMessageElement.classList.remove('streaming');
    }
    activeAIMessageElement = null;
    currentAIResponseForRAF = "";
    pendingTextForRAF = ""; 
    animationFrameId = null; 
}


// --- Send Message (SSE Handling - Uses RAF and Markdown) ---
// Keep this function as it was in the previous "full app.js with RAF and Markdown" version.
// It correctly calls appendMessageToUI, updateStreamingAIMessageRAF, and finalizeAIMessage.
async function handleSendMessage(event) { /* ... same comprehensive version as before ... */
    event.preventDefault();
    if (!messageInputField || !currentUser) return;
    const prompt = messageInputField.value.trim();
    if (!prompt) return;
    messageInputField.value = '';

    appendMessageToUI(prompt, 'user', new Date().toISOString());
    appendMessageToUI("Thinking...", 'model', null, true);

    try {
        const response = await fetch(`${API_BASE_URL}/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, conversationId: currentConversationId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}` }));
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        if (!response.body) throw new Error('Empty response body from server.');

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let serverAssignedConversationId = currentConversationId; // Use currentConversationId as initial value
        let serverAssignedConversationTitle = currentConversationTitle; // Use current title

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log("Frontend: Stream finished by reader 'done' flag.");
                finalizeAIMessage(new Date().toISOString());
                // If a new conversation was effectively created (currentConversationId was null or changed)
                if (serverAssignedConversationId && (serverAssignedConversationId !== currentConversationId || !currentConversationId) ) {
                    currentConversationId = serverAssignedConversationId; // Update global state
                    currentConversationTitle = serverAssignedConversationTitle;
                    await loadConversations(); // Refresh list (will also re-render)
                    // Try to find and highlight the newly created/updated conversation in the list
                    const newConvoElement = document.querySelector(`#conversations-ul li[data-id='${currentConversationId}']`);
                    if (newConvoElement) {
                        if(serverAssignedConversationTitle) newConvoElement.textContent = serverAssignedConversationTitle; // Update title if changed
                        newConvoElement.classList.add('active'); // Explicitly activate
                    } else {
                        // If not found after load, select it (which should find it if loadConversations was successful)
                        selectConversation(currentConversationId, serverAssignedConversationTitle);
                    }
                } else if (currentConversationId) {
                    // If it was an existing conversation, just ensure it's still selected
                    selectConversation(currentConversationId, currentConversationTitle);
                }
                break;
            }

            const sseMessages = value.split('\n\n');
            for (const sseMessage of sseMessages) {
                if (sseMessage.startsWith('data: ')) {
                    const jsonDataString = sseMessage.substring(6).trim();
                    if (jsonDataString) {
                        try {
                            const data = JSON.parse(jsonDataString);
                            if (data.event === "conversationCreated") {
                                console.log("Conversation created by backend:", data);
                                serverAssignedConversationId = data.conversationId; // Store this ID
                                serverAssignedConversationTitle = data.title;
                                if (!currentConversationId) { // If we were in "new chat" mode
                                    currentConversationId = data.conversationId; // Update state immediately
                                    currentConversationTitle = data.title;
                                }
                            } else if (data.textChunk) {
                                updateStreamingAIMessageRAF(data.textChunk);
                            } else if (data.event === "done") {
                                console.log("Frontend: Received 'done' event payload from server:", data);
                            } else if (data.event === "error") {
                                console.error("SSE Error Event from server:", data.message, data.details);
                                finalizeAIMessage(new Date().toISOString());
                                let errUIText = `Error from AI: ${data.message || 'Unknown AI error.'}`;
                                if (typeof marked !== 'undefined') errUIText = marked.parse(errUIText);
                                appendMessageToUI(errUIText, 'system', new Date().toISOString());
                                return;
                            }
                        } catch (e) { console.warn('Error parsing SSE JSON data:', e, 'Raw data part:', jsonDataString); }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error sending message or processing stream:', error);
        if (activeAIMessageElement) {
            const contentDiv = activeAIMessageElement.querySelector('.content');
            let errUIText = `Error: ${error.message || 'Failed to send message.'}`;
            if(contentDiv) {
                if (typeof marked !== 'undefined') errUIText = marked.parse(errUIText);
                else errUIText = errUIText.replace(/\n/g, '<br>');
                contentDiv.innerHTML = errUIText;
            }
            activeAIMessageElement.classList.add('error');
            finalizeAIMessage(new Date().toISOString());
        } else {
             let errUIText = `Error: ${error.message || 'Failed to send message.'}`;
             if (typeof marked !== 'undefined') errUIText = marked.parse(errUIText);
             appendMessageToUI(errUIText, 'system', new Date().toISOString());
        }
        if (error.message.toLowerCase().includes('unauthorized') || error.message.toLowerCase().includes('token')) {
           await handleLogout();
        }
    }
}


// --- Initialization ---
function init() {
    console.log("Frontend: init() called (v6 - UI & Panel Fixes)");
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showView('register'); clearError(loginErrorP); clearError(registerErrorP); });
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('login'); clearError(loginErrorP); clearError(registerErrorP); });
    if (logoutButton) logoutButton.addEventListener('click', () => handleLogout(true));
    if (newChatButton) newChatButton.addEventListener('click', handleNewChat);
    if (messageInputForm) messageInputForm.addEventListener('submit', handleSendMessage);

    if (menuToggleButton && conversationPanel && mainChatLayout) {
        menuToggleButton.addEventListener('click', toggleConversationPanel);
        // Default state of panel based on screen size
        if (window.innerWidth < 768) { // Example breakpoint for mobile
            conversationPanel.classList.add('collapsed');
            mainChatLayout.classList.add('panel-collapsed');
        } else {
            conversationPanel.classList.remove('collapsed'); // Ensure open on desktop
            mainChatLayout.classList.remove('panel-collapsed');
        }
    }

    checkLoginState();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}