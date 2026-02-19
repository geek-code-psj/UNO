// public/js/auth.js — Authentication module

const API_BASE = '';
let currentToken = localStorage.getItem('uno_token');
let currentUser = null;

async function apiCall(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function showAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function hideAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function showLogin() {
    document.getElementById('auth-login-form').classList.remove('hidden');
    document.getElementById('auth-register-form').classList.add('hidden');
    document.getElementById('auth-title').textContent = 'Welcome to UNO Arena';
}

function showRegister() {
    document.getElementById('auth-login-form').classList.add('hidden');
    document.getElementById('auth-register-form').classList.remove('hidden');
    document.getElementById('auth-title').textContent = 'Create Account';
}

async function doLogin() {
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        if (!email || !password) return showToast('Please fill in all fields', 'error');

        const data = await apiCall('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('uno_token', currentToken);
        hideAuthModal();
        updateUserUI();
        connectSocket();
        showToast(`Welcome back, ${currentUser.username}!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function doRegister() {
    try {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        if (!username || !email || !password) return showToast('Please fill in all fields', 'error');

        const data = await apiCall('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        });

        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('uno_token', currentToken);
        hideAuthModal();
        updateUserUI();
        connectSocket();
        showToast(`Account created! Welcome, ${currentUser.username}!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function playAsGuest() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('uno_token');
    hideAuthModal();
    connectSocket();
    showToast('Playing as guest. Register to save your progress!', 'info');
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('uno_token');
    if (window.socket) window.socket.disconnect();
    updateUserUI();
    showAuthModal();
}

async function loadProfile() {
    if (!currentToken) return;
    try {
        const data = await apiCall('/api/auth/profile');
        currentUser = data.user;
        updateUserUI();
    } catch (err) {
        // Token expired or invalid
        currentToken = null;
        localStorage.removeItem('uno_token');
    }
}

async function claimDailyBonus() {
    if (!currentToken) return showToast('Login to claim daily bonus', 'error');
    try {
        const data = await apiCall('/api/auth/daily-bonus', { method: 'POST' });
        currentUser = data.user;
        updateUserUI();
        showToast(`+${data.amount} coins daily bonus claimed! 🎁`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function updateUserUI() {
    const coinCount = document.getElementById('coin-count');
    const navAvatar = document.getElementById('nav-avatar');

    if (currentUser) {
        coinCount.textContent = currentUser.coins || 0;
        document.getElementById('stat-wins').textContent = currentUser.wins || 0;
        document.getElementById('stat-losses').textContent = currentUser.losses || 0;
        document.getElementById('stat-games').textContent = currentUser.games_played || 0;
        const winRate = currentUser.games_played > 0
            ? Math.round((currentUser.wins / currentUser.games_played) * 100)
            : 0;
        document.getElementById('stat-winrate').textContent = winRate + '%';
        navAvatar.title = currentUser.username;
    } else {
        coinCount.textContent = '0';
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = '300ms ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (currentToken) {
        await loadProfile();
        connectSocket();
    } else {
        showAuthModal();
    }
});
