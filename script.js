// ============================================================================
// Quantum Digits – Full Frontend Script (Final, all trade types predict digits)
// ============================================================================

// Disable right-click
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
});
document.addEventListener('selectstart', function (e) {
    e.preventDefault();
    return false;
});
document.addEventListener('dragstart', function (e) {
    e.preventDefault();
    return false;
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        return false;
    }
});
// GLOBALS
let freqWindow = 20;           // default: 20 ticks
let jwt = localStorage.getItem('jwt');
let currentUser = null;
let currentRole = null;
let recentDigits = [];
let lastActualDigit = Math.floor(Math.random() * 10);
let currentTradeType = 'matches';
let waveFreq = 2.0;
let fermiTemp = 0.8;
let autoRefreshInterval = null;
let derivSocket = null;
let selectedVolatility = 'Volatility 10 (1s)';
let pieChart, barChart, scatterChart;
let chatHistory = [];
let proActive = false;
let lastPredictedDigit = null;

// Volatility & Symbol Maps
const volatilityMap = {
    "Volatility 10 (1s)": 0, "Volatility 10": 1, "Volatility 15 (1s)": 2,
    "Volatility 25 (1s)": 3, "Volatility 25": 4, "Volatility 30 (1s)": 5,
    "Volatility 50 (1s)": 6, "Volatility 50": 7, "Volatility 75 (1s)": 8,
    "Volatility 75": 9, "Volatility 90": 9,
    "Volatility 100 (1s)": 10, "Volatility 100": 11
};
// Static symbol map (fallback, also used directly if dynamic fetch is not yet implemented)
const symbolMap = {
    // 2-second indices (keep as they were)
    "Volatility 10": "R_10",
    "Volatility 25": "R_25",
    "Volatility 50": "R_50",
    "Volatility 75": "R_75",
    "Volatility 100": "R_100",
    "Volatility 90": "R_90",

    // 1-second indices (use the correct 1HZ...V pattern)
    "Volatility 10 (1s)": "1HZ10V",
    "Volatility 15 (1s)": "1HZ15V",     // Deriv’s 15% volatility (1s) uses the same symbol
    "Volatility 25 (1s)": "1HZ25V",
    "Volatility 30 (1s)": "1HZ30V",     // 30% (1s) also uses 1HZ30V
    "Volatility 50 (1s)": "1HZ50V",
    "Volatility 75 (1s)": "1HZ75V",
    "Volatility 100 (1s)": "1HZ100V"
};
async function fetchSymbolMap() {
    try {
        const response = await fetch('/api/symbols');
        const data = await response.json();

        if (data.symbols && Array.isArray(data.symbols)) {
            const map = {};
            data.symbols.forEach(symbol => {
                // Deriv's `display_name` often includes the "(1s)" suffix.
                // This will correctly map both standard and 1‑second indices.
                map[symbol.display_name] = symbol.symbol;
            });
            return map;
        }
        // Fallback to a default static map if the API call fails
        return getFallbackSymbolMap();
    } catch (error) {
        console.error("Error fetching symbol map, using fallback:", error);
        return getFallbackSymbolMap();
    }
}

// Static map for fallback or simpler implementation
function getFallbackSymbolMap() {
    return {
        "Volatility 10 (1s)": "R_10",   // The API's naming convention for 1‑second indices
        "Volatility 25 (1s)": "R_25",
        "Volatility 50 (1s)": "R_50",
        "Volatility 75 (1s)": "R_75",
        "Volatility 100 (1s)": "R_100",
        "Volatility 150 (1s)": "R_150",
        "Volatility 250 (1s)": "R_250",
        "Volatility 10": "R_10",
        "Volatility 25": "R_25",
        "Volatility 50": "R_50",
        "Volatility 75": "R_75",
        "Volatility 100": "R_100"
    };
}
// ======================== API HELPER ========================
async function apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = localStorage.getItem('jwt');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem('jwt');
        showNotification('Session expired. Please log in again.', true);
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ======================== NOTIFICATION ========================
function showNotification(message, isError = false) {
    let notif = document.querySelector('.notification-global');
    if (!notif) {
        notif = document.createElement('div');
        notif.className = 'notification-global';
        document.body.appendChild(notif);
        const style = document.createElement('style');
        style.textContent = `
            .notification-global {
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(145deg, #4a00e0, #8e2de2);
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                z-index: 9999;
                transform: translateX(4000px);
                transition: transform 0.3s ease-in-out;
                border: 1px solid #00ffff;
                font-size: 0.9rem;
                max-width: 350px;
                pointer-events: none;
            }
            .notification-global.show {
                transform: translateX(0);
            }
        `;
        document.head.appendChild(style);
    }

    // Clear any existing timeout to prevent conflicts
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }

    notif.textContent = message;
    notif.classList.add('show');

    window.notificationTimeout = setTimeout(() => {
        notif.classList.remove('show');
        // Optional: remove the element after transition to prevent accumulation
        setTimeout(() => {
            if (notif.parentNode && !notif.classList.contains('show')) {
                // Keep it in DOM but hidden – don't remove, just keep hidden
                // Or remove if you prefer: notif.remove();
            }
        }, 300);
    }, 3000);
}

// ======================== LOGIN ========================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const terms = document.getElementById('termsCheckbox').checked;
    if (!terms) {
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorText').innerText = 'You must accept the Terms.';
        return;
    }
    try {
        const data = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        localStorage.setItem('jwt', data.token);
        jwt = data.token;
        currentUser = data.username;
        currentRole = data.role;
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        initApp();
        showNotification(`Welcome, ${currentUser}!`);
    } catch (err) {
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorText').innerText = err.message;
    }
});
document.querySelector('.deriv-affiliate-btn')?.addEventListener('click', () => {
    console.log('Affiliate link clicked');
    // send to analytics
    if (typeof gtag !== 'undefined') gtag('event', 'click', { 'event_category': 'affiliate', 'event_label': 'join-deriv' });
});
// ======================== LOGOUT ========================
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('jwt');
    jwt = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    if (derivSocket) derivSocket.close();
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    showNotification('Logged out');
});

// ======================== FEATURE EXTRACTION ========================
function buildFeatures() {
    // This function is kept for compatibility but not used in the new predictor.
    // The predictor only needs recentDigits and tradeType.
    return [];
}

// ======================== PRICE DISPLAY & EVEN/ODD PATTERN ========================
function updatePriceDisplay(price, digit) {
    const priceSpan = document.getElementById('currentPrice');
    const lastDigitSpan = document.getElementById('lastDigitDisplay');
    if (!priceSpan) return;
    const priceStr = price.toString();
    const lastChar = priceStr.slice(-1);
    const rest = priceStr.slice(0, -1);
    priceSpan.innerHTML = `${rest}<strong class="last-digit-blink">${lastChar}</strong>`;
    if (lastDigitSpan) lastDigitSpan.textContent = digit;
    const boldDigit = priceSpan.querySelector('.last-digit-blink');
    if (boldDigit) {
        boldDigit.classList.add('blink');
        setTimeout(() => boldDigit.classList.remove('blink'), 200);
    }
    updateEOPattern(digit);
}

function updateEOPattern(digit) {
    const container = document.getElementById('eoSequence');
    if (!container) return;
    const eo = digit % 2 === 0 ? 'E' : 'O';
    let pattern = JSON.parse(localStorage.getItem('eoPattern') || '[]');
    pattern.unshift(eo);
    if (pattern.length > 10) pattern.pop();
    localStorage.setItem('eoPattern', JSON.stringify(pattern));
    container.innerHTML = pattern.map(l => `<span class="eo-letter">${l}</span>`).join('');
}

// Even/Odd pattern override: if last three digits are all even, predict an odd digit; if all odd, predict an even digit.
function getEvenOddPatternOverride() {
    if (recentDigits.length < 3) return null;
    const last3 = recentDigits.slice(-3);
    const allEven = last3.every(d => d % 2 === 0);
    const allOdd = last3.every(d => d % 2 === 1);
    if (allEven) return { digit: 1, confidence: 70 };   // any odd digit
    if (allOdd) return { digit: 0, confidence: 70 };    // any even digit
    return null;
}

// ======================== DERIV WEBSOCKET (UPDATED: Public Endpoint, No Auth) ========================
function connectDerivWebSocket() {
    if (derivSocket && (derivSocket.readyState === WebSocket.OPEN || derivSocket.readyState === WebSocket.CONNECTING)) {
        derivSocket.close();
    }

    // New public endpoint – no authentication, no API token
    const socketUrl = 'wss://api.derivws.com/trading/v1/options/ws/public';
    derivSocket = new WebSocket(socketUrl);

    derivSocket.onopen = () => {
        console.log('Deriv Public WebSocket opened');
        const symbol = symbolMap[selectedVolatility] || 'R_10';
        console.log(`📡 Subscribing to ${symbol} ticks via public stream`);
        // Flattened subscription payload as required
        derivSocket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    };

    derivSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);

        // Public stream uses the same 'tick' message structure
        if (data.msg_type === 'tick' && data.tick && typeof data.tick.quote !== 'undefined') {
            const price = data.tick.quote;
            const digit = parseInt(price.toString().slice(-1));
            updatePriceDisplay(price, digit);
            recentDigits.push(digit);
            if (recentDigits.length > 20) recentDigits.shift();
            lastActualDigit = digit;
            if (document.getElementById('autoRefreshCheckbox')?.checked) {
                performAnalysis(false);
            }
            // Update frequency chart immediately
            if (barChart) {
                const windowDigits = recentDigits.slice(-freqWindow);
                const freq = new Array(10).fill(0);
                windowDigits.forEach(d => { if (d >= 0 && d <= 9) freq[d]++; });
                const total = windowDigits.length || 1;
                const freqPercent = freq.map(f => (f / total * 100).toFixed(1));
                barChart.data.datasets[0].data = freqPercent;
                barChart.update();
            }
        } else if (data.error) {
            console.error('Deriv Public API error:', data.error);
            if (!window._derivErrorShown) {
                showNotification('Public stream error – check connection', true);
                window._derivErrorShown = true;
            }
        }
    };

    derivSocket.onerror = (err) => {
        console.error('Deriv Public WebSocket error', err);
        if (!window._derivErrorShown) {
            showNotification('Public stream unavailable – using simulation', true);
            window._derivErrorShown = true;
        }
    };

    derivSocket.onclose = () => {
        console.log('Deriv Public WebSocket closed');
    };
}
// ======================== PREDICTION (using new frequency-based backend) ========================
async function performAnalysis(showLoading = true) {
    if (showLoading) document.getElementById('loadingOverlay').classList.remove('hidden');
    try {
        const features = buildFeatures();
        const result = await apiRequest('/api/predict', {
            method: 'POST',
            body: JSON.stringify({
                recentDigits,
                tradeType: currentTradeType,
                volatility: selectedVolatility,
                waveFreq,
                fermiTemp,
                lastActualDigit,
                lastPredictedDigit   // ← send previous prediction
            }),
        });
        const predicted = result.digit;
        const confidence = result.confidence;

        // Update UI
        document.querySelector('.big-digit').textContent = predicted;
        document.getElementById('tradeCondition').textContent = `${currentTradeType} → predicted ${predicted}`;
        document.getElementById('lastAnalysisResult').innerHTML = `<strong>Prediction:</strong> Digit ${predicted} <span style="color: #00ffff;">(${confidence}% confidence)</span><br><small>Trade type: ${currentTradeType}</small>`;

        if (pieChart) pieChart.data.datasets[0].data = [confidence, 100 - confidence]; pieChart.update();

        // Get the last `freqWindow` digits for frequency calculation
        const windowDigits = recentDigits.slice(-freqWindow);
        const freq = new Array(10).fill(0);
        windowDigits.forEach(d => { if (d >= 0 && d <= 9) freq[d]++; });
        const total = windowDigits.length || 1;
        const freqPercent = freq.map(f => (f / total * 100).toFixed(1));
        barChart.data.datasets[0].data = freqPercent;
        barChart.update();

        // Update algorithm confidence bars (if you have that function)
        if (typeof updateAlgorithmBars === 'function') {
            updateAlgorithmBars(result.probabilities, confidence);
        }

        // Push predicted digit to history (only if it's a digit, which it always is)
        recentDigits.push(predicted);
        if (recentDigits.length > 20) recentDigits.shift();
        lastActualDigit = predicted;

        // Store the predicted digit for the next call (to avoid repetition)
        lastPredictedDigit = predicted;

    } catch (err) {
        showNotification(err.message, true);
    } finally {
        if (showLoading) document.getElementById('loadingOverlay').classList.add('hidden');
    }
}
function updateAlgorithmBars(probabilities, confidence) {
    const algoFills = document.querySelectorAll('.progress-fill');
    const algoValues = document.querySelectorAll('.algo-value');
    const metrics = [
        confidence,
        Math.min(99, Math.max(45, confidence - 5)),
        Math.min(99, Math.max(45, confidence - 10)),
        Math.min(99, Math.max(45, confidence - 15)),
        Math.min(99, Math.max(45, confidence + 5)),
        Math.min(99, Math.max(45, confidence - 8))
    ];
    for (let i = 0; i < Math.min(6, algoFills.length); i++) {
        algoFills[i].style.width = metrics[i] + '%';
        algoValues[i].textContent = metrics[i] + '%';
    }
}

// ======================== CHARTS ========================
function initCharts() {
    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: { labels: ['Win Probability', 'Payout Ratio'], datasets: [{ data: [75, 25], backgroundColor: ['#4a00e0', '#8e2de2'], borderWidth: 0 }] },
        options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } }
    });
    const barCtx = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: { labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], datasets: [{ label: 'Frequency %', data: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], backgroundColor: '#4a00e0' }] },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 25 } }, plugins: { legend: { display: false } } }
    });
}
function initScatterChart() {
    if (scatterChart) scatterChart.destroy();
    const scatterCtx = document.getElementById('scatterChart').getContext('2d');
    const pointRadius = window.matchMedia('(max-width: 768px)').matches ? 3 : 6;
    scatterChart = new Chart(scatterCtx, {
        type: 'scatter',
        data: { datasets: [{ label: 'Confidence', data: generateScatterData(80), backgroundColor: '#00ffff', pointRadius, pointHoverRadius: pointRadius + 2 }] },
        options: { responsive: true, scales: { x: { title: { display: true, text: 'Tick index' } }, y: { title: { display: true, text: 'Probability %' }, min: 0, max: 35 } } }
    });
}
function generateScatterData(n) { return Array.from({ length: n }, () => ({ x: Math.random() * 100, y: Math.random() * 30 + 2 })); }
function updateScatterChart() { scatterChart.data.datasets[0].data = generateScatterData(80); scatterChart.update(); document.getElementById('scatter-time').textContent = new Date().toLocaleTimeString(); }

// ======================== AUTO-REFRESH ========================
function initAutoRefresh() {
    const autoCheckbox = document.getElementById('autoRefreshCheckbox');
    const intervalSelect = document.getElementById('refreshIntervalSelect');
    function start() { if (autoRefreshInterval) clearInterval(autoRefreshInterval); const interval = parseInt(intervalSelect.value, 10) * 1000; autoRefreshInterval = setInterval(() => { if (document.getElementById('dashboard').classList.contains('active')) performAnalysis(false); }, interval); }
    function stop() { if (autoRefreshInterval) clearInterval(autoRefreshInterval); autoRefreshInterval = null; }
    autoCheckbox.addEventListener('change', () => { if (autoCheckbox.checked) start(); else stop(); });
    intervalSelect.addEventListener('change', () => { if (autoCheckbox.checked) start(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (autoCheckbox.checked) start(); });
}

// ======================== NAVIGATION & THEME ========================
function initNavigation() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); const pageId = item.dataset.page;
            navItems.forEach(n => n.classList.remove('active')); item.classList.add('active');
            pages.forEach(p => p.classList.remove('active')); document.getElementById(pageId).classList.add('active');
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
            if (pageId === 'analysis') updateScatterChart();
        });
    });
}
function initThemeSwitch() {
    const themeSelect = document.getElementById('themeSelect');
    const saved = localStorage.getItem('theme') || 'dark';
    document.body.className = saved + '-theme';
    themeSelect.value = saved;
    themeSelect.addEventListener('change', (e) => { document.body.className = e.target.value + '-theme'; localStorage.setItem('theme', e.target.value); showNotification(`Theme switched to ${e.target.value}`); });
}
function startClock() { function update() { document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }); } update(); setInterval(update, 1000); }

// ======================== AI CHAT (DeepSeek) ========================
async function loadChatHistory() { try { const data = await apiRequest('/api/chat'); chatHistory = data.messages || []; renderChatHistory(); } catch (e) { console.error(e); } }
async function saveChatMessage(sender, text) { try { await apiRequest('/api/chat', { method: 'POST', body: JSON.stringify({ sender, message: text }) }); } catch (e) { console.error(e); } }
async function clearChatHistory() { try { await apiRequest('/api/chat', { method: 'DELETE' }); chatHistory = []; renderChatHistory(); showNotification('Chat history cleared'); } catch (e) { console.error(e); } }
function renderChatHistory() { const container = document.getElementById('chatHistoryList'); if (!container) return; if (chatHistory.length === 0) { container.innerHTML = '<p>No chat history yet.</p>'; return; } const groups = {}; chatHistory.forEach(msg => { const date = new Date(msg.timestamp).toLocaleDateString(); if (!groups[date]) groups[date] = []; groups[date].push(msg); }); container.innerHTML = ''; for (let date in groups) { const dateDiv = document.createElement('div'); dateDiv.className = 'history-date'; dateDiv.innerHTML = `<h4>${date}</h4>`; container.appendChild(dateDiv); groups[date].forEach(msg => { const preview = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text; const item = document.createElement('div'); item.className = 'history-item'; item.innerHTML = `<div class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div><div class="preview">${msg.sender === 'user' ? 'You: ' : 'Bot: '}${preview}</div>`; item.addEventListener('click', () => addChatMessage(msg.text, msg.sender, false)); container.appendChild(item); }); }; }
function addChatMessage(text, sender, save = true) { const chatContainer = document.getElementById('chatContainer'); const msgDiv = document.createElement('div'); msgDiv.className = `chat-message ${sender}`; msgDiv.innerHTML = `<span class="chat-avatar"><i class="fas ${sender === 'bot' ? 'fa-robot' : 'fa-user'}"></i></span><span class="chat-text">${text}</span>`; chatContainer.appendChild(msgDiv); chatContainer.scrollTop = chatContainer.scrollHeight; if (save) { chatHistory.push({ sender, text, timestamp: new Date().toISOString() }); saveChatMessage(sender, text); renderChatHistory(); } }
// Function to call the streaming endpoint and accumulate the response
async function getBotResponse(userMsg) {
    try {
        const response = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'AI request failed');
        }
        const data = await response.json();
        return data.reply;
    } catch (err) {
        console.error('AI error:', err);
        // Fallback rule (local) – never fails
        const lower = userMsg.toLowerCase();
        if (lower.includes('hello')) return "Hello! I'm ACE-RADICAL. How can I assist?";
        if (lower.includes('predict')) return "Click 'Analyze Digits' on the Dashboard.";
        if (lower.includes('volatility')) return "Volatility affects probability distribution. Adjust wave frequency in Settings.";
        if (lower.includes('strategy')) return "Common strategies: trend following, mean reversion, breakout.";
        if (lower.includes('binary options')) return "Binary options pay a fixed amount if condition met. Trade with caution.";
        return "I'm not sure. Try asking about predictions, volatility, strategies, or binary options.";
    }
}

// Modified setupAITabs to use streaming
function setupAITabs() {
    const tabs = document.querySelectorAll('.ai-tab');
    const contents = document.querySelectorAll('.ai-tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(`${target}Tab`).classList.add('active');
            if (target === 'history') renderChatHistory();
        });
    });

    const sendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');

    async function sendMessage() {
        const msg = chatInput.value.trim();
        if (!msg) return;

        // Add user message
        addChatMessage(msg, 'user', true);
        chatInput.value = '';

        // Add a temporary "Thinking..." bot message
        const tempId = Date.now();
        const tempDiv = document.createElement('div');
        tempDiv.className = 'chat-message bot';
        tempDiv.id = `temp-${tempId}`;
        tempDiv.innerHTML = `<span class="chat-avatar"><i class="fas fa-robot"></i></span><span class="chat-text">Thinking...</span>`;
        document.getElementById('chatContainer').appendChild(tempDiv);

        // Get streamed reply
        let fullReply = '';
        const updateMessage = (text) => {
            const botMsgDiv = document.getElementById(`temp-${tempId}`);
            if (botMsgDiv) {
                botMsgDiv.querySelector('.chat-text').textContent = text;
            }
        };

        try {
            fullReply = await getBotResponseStream(msg, updateMessage);
            // Replace temporary message with final one (save to history)
            const finalDiv = document.createElement('div');
            finalDiv.className = 'chat-message bot';
            finalDiv.innerHTML = `<span class="chat-avatar"><i class="fas fa-robot"></i></span><span class="chat-text">${fullReply}</span>`;
            document.getElementById('chatContainer').appendChild(finalDiv);
            document.getElementById(`temp-${tempId}`)?.remove();
            // Save to history
            addChatMessage(fullReply, 'bot', true);
        } catch (err) {
            updateMessage("Sorry, I couldn't get a response.");
        }
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // Clear history, upgrade PRO, API form (same as before)
    // ... (keep your existing handlers for these)
}
// ======================== ACCOUNT UPDATE ========================
async function updateCredentials() {
    const newUsername = document.getElementById('newUsername').value.trim();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (!currentPassword) { showNotification('Please enter current password'); return; }
    if (newPassword !== confirm) { showNotification('New passwords do not match'); return; }
    try {
        await apiRequest('/api/user', { method: 'PUT', body: JSON.stringify({ newUsername, currentPassword, newPassword: newPassword || undefined }) });
        showNotification('Credentials updated successfully');
        document.getElementById('newUsername').value = '';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        if (newUsername) { currentUser = newUsername; document.getElementById('loggedInUserName').textContent = newUsername; document.getElementById('accountUserName').textContent = newUsername; }
    } catch (err) { showNotification(err.message, true); }
}

// ======================== ADMIN DASHBOARD ========================
let adminDashboardInitialized = false;
async function initAdminDashboard() {
    if (adminDashboardInitialized) return;
    adminDashboardInitialized = true;
    const container = document.getElementById('adminDashboardContainer');
    if (!container) return;
    container.innerHTML = `<div class="stats-grid" id="adminStatsGrid"></div><div class="action-bar"><button class="btn-primary" id="adminGenerateNewIdBtn"><i class="fas fa-plus-circle"></i> Create New User Account</button></div><div class="table-wrapper"><table class="credentials-table" id="adminCredsTable"><thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Subscription Date</th><th>Expiry Date</th><th>Remove</th></table></thead><tbody id="adminTableBody"></tbody></table></div><div class="prediction-card"><h2><i class="fas fa-chart-line"></i> Revenue vs Monthly Target (Current Year)</h2><canvas id="adminRevenueChart" width="800" height="350" style="width:100%; height:auto; max-height:350px"></canvas></div><div id="adminCredentialModal" class="modal-overlay"><div class="modal-container"><h3><i class="fas fa-id-card"></i> New subscription</h3><div class="input-group"><label>Username *</label><input type="text" id="adminModalUsername"></div><div class="input-group"><label>Password *</label><input type="text" id="adminModalPassword"></div><div class="input-group"><label>Role *</label><select id="adminModalRole"><option value="regular">Regular</option><option value="tech">Tech</option><option value="admin">Admin</option></select></div><div id="adminModalError" class="error-msg"></div><div class="modal-buttons"><button class="btn-secondary" id="adminCancelModalBtn">Cancel</button><button class="btn-submit" id="adminConfirmAddBtn">Add credential</button></div></div></div>`;
    await refreshAdminDashboard();
    document.getElementById('adminGenerateNewIdBtn').addEventListener('click', () => document.getElementById('adminCredentialModal').classList.add('active'));
    document.getElementById('adminCancelModalBtn').addEventListener('click', () => document.getElementById('adminCredentialModal').classList.remove('active'));
    document.getElementById('adminConfirmAddBtn').addEventListener('click', async () => {
        const username = document.getElementById('adminModalUsername').value.trim();
        const password = document.getElementById('adminModalPassword').value.trim();
        const role = document.getElementById('adminModalRole').value;
        if (!username || !password) { document.getElementById('adminModalError').innerText = 'Both fields required.'; return; }
        try {
            await apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
            document.getElementById('adminCredentialModal').classList.remove('active');
            refreshAdminDashboard();
            showNotification('User created');
        } catch (err) { document.getElementById('adminModalError').innerText = err.message; }
    });
}
async function refreshAdminDashboard() {
    try {
        const stats = await apiRequest('/api/admin/stats');
        const statsGrid = document.getElementById('adminStatsGrid');
        statsGrid.innerHTML = `<div class="stat-card"><h3>Active users</h3><div class="stat-value">${stats.activeUsers}</div></div><div class="stat-card"><h3>Total subscriptions</h3><div class="stat-value">${stats.totalSubs}</div></div><div class="stat-card"><h3>Today's revenue</h3><div class="stat-value">$${stats.todayRevenue}</div></div><div class="stat-card"><h3>Monthly MRR</h3><div class="stat-value">$${stats.monthlyRecurringRevenue}</div></div><div class="stat-card"><h3>Yearly target</h3><div class="stat-value">$${stats.ytdRevenue} <span style="font-size:1rem;">/ $100k</span></div><div class="progress-container"><div class="progress-fill" style="width: ${stats.percentage}%;"></div></div><div class="target-sub">${stats.percentage.toFixed(1)}% achieved</div></div>`;
        const users = await apiRequest('/api/admin/users');
        const tbody = document.getElementById('adminTableBody');
        tbody.innerHTML = '';
        users.forEach(user => {
            const row = tbody.insertRow();
            row.insertCell(0).innerHTML = `<strong>${user._id.slice(-4)}</strong>`;
            row.insertCell(1).innerHTML = `<i class="fas fa-user-circle"></i> ${user.username}`;
            row.insertCell(2).innerHTML = user.role;
            row.insertCell(3).innerHTML = user.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString() : 'N/A';
            row.insertCell(4).innerHTML = 'Active';
            const delCell = row.insertCell(5);
            const delBtn = document.createElement('button');
            delBtn.className = 'remove-btn'; delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            delBtn.onclick = async () => { if (confirm(`Delete user ${user.username}?`)) { await apiRequest(`/api/admin/users?userId=${user._id}`, { method: 'DELETE' }); refreshAdminDashboard(); } };
            delCell.appendChild(delBtn);
        });
        const ctx = document.getElementById('adminRevenueChart').getContext('2d');
        const monthlyRev = Array(12).fill(0).map(() => Math.floor(Math.random() * 15000));
        const monthlyTarget = Array(12).fill(8333.33);
        if (window.adminRevenueChart && typeof window.adminRevenueChart.destroy === 'function') window.adminRevenueChart.destroy();
        window.adminRevenueChart = new Chart(ctx, { type: 'bar', data: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], datasets: [{ label: 'Monthly Revenue (USD)', data: monthlyRev, backgroundColor: '#2c7da0', borderRadius: 8 }, { label: 'Monthly Target ($8,333.33)', data: monthlyTarget, type: 'line', borderColor: '#e9a35f', borderWidth: 3, borderDash: [6, 6], fill: false, pointRadius: 2 }] }, options: { responsive: true } });
    } catch (err) { console.error(err); }
}

// ======================== INITIALIZATION ========================
function initTradeButtons() {
    document.querySelectorAll('.trade-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.trade-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentTradeType = this.dataset.type;
            console.log('Trade type changed to:', currentTradeType); // for debugging
        });
    });
    document.querySelector('.trade-btn[data-type="matches"]').classList.add('active');
}

function initEyeToggle() {
    const toggle = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (toggle && passwordInput) {
        toggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggle.classList.toggle('fa-eye');
            toggle.classList.toggle('fa-eye-slash');
        });
    }
}

function initTermsLinks() {
    const termsLink = document.getElementById('termsLink');
    const privacyLink = document.getElementById('privacyLink');
    const termsModal = document.getElementById('termsModal');
    const privacyModal = document.getElementById('privacyModal');
    const closeTerms = document.getElementById('closeTermsModal');
    const closePrivacy = document.getElementById('closePrivacyModal');

    if (termsLink && termsModal) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            termsModal.classList.add('active');
        });
    }
    if (privacyLink && privacyModal) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            privacyModal.classList.add('active');
        });
    }
    if (closeTerms) {
        closeTerms.addEventListener('click', () => {
            termsModal.classList.remove('active');
        });
    }
    if (closePrivacy) {
        closePrivacy.addEventListener('click', () => {
            privacyModal.classList.remove('active');
        });
    }
    // Close modal when clicking outside
    if (termsModal) {
        termsModal.addEventListener('click', (e) => {
            if (e.target === termsModal) termsModal.classList.remove('active');
        });
    }
    if (privacyModal) {
        privacyModal.addEventListener('click', (e) => {
            if (e.target === privacyModal) privacyModal.classList.remove('active');
        });
    }
}

async function initApp() {
    initNavigation();
    initCharts();
    initScatterChart();
    initTradeButtons();
    initThemeSwitch();
    startClock();
    setInterval(() => { if (document.getElementById('analysis').classList.contains('active')) updateScatterChart(); }, 3000);
    initAutoRefresh();

    waveFreq = parseFloat(document.getElementById('waveFreq').value);
    fermiTemp = parseFloat(document.getElementById('fermiTemp').value);
    document.getElementById('waveFreq').addEventListener('input', (e) => { waveFreq = parseFloat(e.target.value); document.getElementById('waveFreqValue').textContent = waveFreq; });
    document.getElementById('fermiTemp').addEventListener('input', (e) => { fermiTemp = parseFloat(e.target.value); document.getElementById('fermiTempValue').textContent = fermiTemp; });
    document.getElementById('volatilitySelect').addEventListener('change', (e) => { selectedVolatility = e.target.options[e.target.selectedIndex].text; connectDerivWebSocket(); });
    document.getElementById('analyzeBtn').addEventListener('click', () => performAnalysis(true));
    document.getElementById('updateCredentialsBtn').addEventListener('click', updateCredentials);

    connectDerivWebSocket();
    setupAITabs();
    await loadChatHistory();

    document.getElementById('accountUserName').textContent = currentUser;
    document.getElementById('loggedInUserName').textContent = currentUser;
    document.getElementById('loginTimeDisplay').textContent = `Logged in: ${new Date().toLocaleString()}`;

    if (currentRole === 'admin') {
        document.getElementById('accountRegular').style.display = 'none';
        document.getElementById('accountAdmin').style.display = 'block';
        initAdminDashboard();
    } else if (currentRole === 'tech') {
        document.getElementById('accountRegular').style.display = 'block';
        document.getElementById('techPartnerPanel').style.display = 'block';
    } else {
        document.getElementById('accountRegular').style.display = 'block';
    }

    // Seed some initial random digits for demo (will be replaced by WebSocket soon)
    for (let i = 0; i < 10; i++) recentDigits.push(Math.floor(Math.random() * 10));
    lastActualDigit = recentDigits[recentDigits.length - 1];

    setTimeout(() => performAnalysis(false), 2000);
    const freqSlider = document.getElementById('freqWindowSlider');
    const freqValueSpan = document.getElementById('freqWindowValue');
    if (freqSlider && freqValueSpan) {
        freqSlider.addEventListener('input', (e) => {
            freqWindow = parseInt(e.target.value);
            freqValueSpan.textContent = freqWindow + ' ticks';
            // Immediately refresh the bar chart with the new window
            if (barChart) {
                const windowDigits = recentDigits.slice(-freqWindow);
                const freq = new Array(10).fill(0);
                windowDigits.forEach(d => { if (d >= 0 && d <= 9) freq[d]++; });
                const total = windowDigits.length || 1;
                const freqPercent = freq.map(f => (f / total * 100).toFixed(1));
                barChart.data.datasets[0].data = freqPercent;
                barChart.update();
            }
        });
    }
}

// ======================== SESSION CHECK ========================
if (jwt) {
    (async () => {
        try {
            const data = await apiRequest('/api/auth/verify');
            if (data.valid) {
                currentUser = data.user.username;
                currentRole = data.user.role;
                document.getElementById('loginPage').style.display = 'none';
                document.getElementById('appContainer').style.display = 'block';
                initApp();
                initEyeToggle();
                initTermsLinks();
            } else throw new Error();
        } catch (err) {
            localStorage.removeItem('jwt');
            jwt = null;
            document.getElementById('loginPage').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
            initEyeToggle();
            initTermsLinks();
        }
    })();
} else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    initEyeToggle();
    initTermsLinks();
}

// ======================== PARTICLE BACKGROUND ========================
const bgCanvas = document.getElementById('particle-canvas');
if (bgCanvas) {
    const ctx = bgCanvas.getContext('2d');
    let width, height, particles = [];
    function resize() { width = window.innerWidth; height = window.innerHeight; bgCanvas.width = width; bgCanvas.height = height; }
    window.addEventListener('resize', resize);
    resize();
    class Particle { constructor() { this.x = Math.random() * width; this.y = Math.random() * height; this.vx = (Math.random() - 0.5) * 0.3; this.vy = (Math.random() - 0.5) * 0.3; this.radius = Math.random() * 2 + 1; this.color = `rgba(${59 + Math.random() * 100}, ${158 + Math.random() * 100}, 255, ${Math.random() * 0.4 + 0.2})`; } update() { this.x += this.vx; this.y += this.vy; if (this.x < 0 || this.x > width) this.vx *= -1; if (this.y < 0 || this.y > height) this.vy *= -1; } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); } }
    for (let i = 0; i < 100; i++) particles.push(new Particle());
    function animate() { ctx.clearRect(0, 0, width, height); particles.forEach(p => { p.update(); p.draw(); }); requestAnimationFrame(animate); }
    animate();
}