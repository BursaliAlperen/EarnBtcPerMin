import * as storage from 'storage';
import * as i18n from 'i18n';

const state = {
    currentUser: null,
    users: [],
    earningIntervals: [],
    balanceChart: null,
};

// --- DOM Elements ---
const pages = {
    login: document.getElementById('login-page'),
    register: document.getElementById('register-page'),
    main: document.getElementById('main-app'),
    authContainer: document.getElementById('auth-container'),
};

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// --- Constants ---
const BTC_EARN_RATE = 0.00000001; // per second
const EARN_INTERVAL = 1000; // 1 second
const MIN_WITHDRAWAL_AMOUNT = 0.0001;
const BTC_ADDRESS_REGEX = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;

// --- Page Navigation ---
function showPage(pageName) {
    Object.values(pages).forEach(p => p.style.display = 'none');
    if (pageName === 'login' || pageName === 'register') {
        pages.authContainer.style.display = 'flex';
        pages[pageName].style.display = 'block';
    } else {
        pages[pageName].style.display = 'block';
    }
}

// --- Authentication ---
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const user = storage.findUserByEmail(email);

    if (user && user.password === password) {
        if (user.suspended) {
            alert('Your account is suspended.');
            return;
        }
        storage.setCurrentUserId(user.id);
        initializeApp();
    } else {
        alert('Invalid email or password.');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (storage.findUserByEmail(email)) {
        alert('An account with this email already exists.');
        return;
    }

    const newUser = {
        username,
        email,
        password,
        role: 'user',
        suspended: false,
        wallets: [],
        earningsHistory: [],
    };
    const savedUser = storage.saveUser(newUser);
    storage.setCurrentUserId(savedUser.id);
    initializeApp();
}

function handleLogout() {
    stopEarning();
    storage.clearCurrentUserId();
    state.currentUser = null;
    showPage('login');
    loginForm.reset();
    registerForm.reset();
}

// --- Rendering ---
function renderDashboard() {
    const user = state.currentUser;
    document.getElementById('username-display').textContent = user.username;
    
    updateStats();
    renderWallets();
    renderBalanceChart();
    
    const adminPanelContainer = document.getElementById('admin-panel-container');
    if(user.role === 'admin') {
        adminPanelContainer.style.display = 'block';
        renderAdminPanel();
    } else {
        adminPanelContainer.style.display = 'none';
    }
}

function updateStats() {
    const user = state.currentUser;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    const totalBalance = user.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const todaysEarnings = user.earningsHistory
        .filter(e => now - e.timestamp < oneDay)
        .reduce((sum, e) => sum + e.amount, 0);
    const weeklyEarnings = user.earningsHistory
        .filter(e => now - e.timestamp < sevenDays)
        .reduce((sum, e) => sum + e.amount, 0);
    
    document.getElementById('total-balance').textContent = totalBalance.toFixed(8);
    document.getElementById('today-earnings').textContent = todaysEarnings.toFixed(8);
    document.getElementById('weekly-earnings').textContent = weeklyEarnings.toFixed(8);
}

function renderWallets() {
    const tbody = document.querySelector('#wallets-table tbody');
    tbody.innerHTML = '';
    state.currentUser.wallets.forEach(wallet => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${wallet.address}</td>
            <td id="balance-${wallet.address}">${wallet.balance.toFixed(8)}</td>
            <td>
                <button class="btn btn-danger btn-sm delete-wallet-btn" data-address="${wallet.address}">${i18n.translate('delete')}</button>
                <button class="btn btn-success btn-sm withdraw-btn" data-address="${wallet.address}">${i18n.translate('withdraw')}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderBalanceChart() {
    const ctx = document.getElementById('balance-chart').getContext('2d');
    const labels = state.currentUser.wallets.map(w => w.address.substring(0, 8) + '...');
    const data = state.currentUser.wallets.map(w => w.balance);
    const totalBalance = data.reduce((a,b) => a+b, 0);

    if (state.balanceChart) {
        state.balanceChart.destroy();
    }
    
    if (totalBalance === 0) {
        // Show a message or an empty state for the chart
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillText('No data to display. Add a wallet and start earning.', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    state.balanceChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Balance',
                data: data,
                backgroundColor: [
                    '#f7931a', '#ffb258', '#ffd197', '#4d4d4d', '#7e7e7e', '#afafaf'
                ],
                borderColor: '#1e1e1e',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            }
        }
    });
}

function renderAdminPanel() {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    const allUsers = storage.getAllUsers();
    allUsers.forEach(user => {
        const totalBalance = user.wallets.reduce((sum, w) => sum + w.balance, 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${totalBalance.toFixed(8)} BTC</td>
            <td><span class="status-${user.suspended ? 'suspended' : 'active'}">${user.suspended ? i18n.translate('suspended') : i18n.translate('active')}</span></td>
            <td>
                ${user.role !== 'admin' ? `
                <button class="btn btn-secondary btn-sm suspend-user-btn" data-userid="${user.id}">${user.suspended ? i18n.translate('activate') : i18n.translate('suspend')}</button>
                <button class="btn btn-danger btn-sm delete-user-btn" data-userid="${user.id}">${i18n.translate('delete')}</button>
                <button class="btn btn-primary btn-sm update-balance-btn" data-userid="${user.id}">${i18n.translate('updateBalance')}</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Earning Logic ---
function startEarning() {
    stopEarning(); // Clear any existing intervals
    state.currentUser.wallets.forEach(wallet => {
        const interval = setInterval(() => {
            const user = storage.findUserById(state.currentUser.id); // Get fresh user data
            const walletToUpdate = user.wallets.find(w => w.address === wallet.address);
            if (walletToUpdate) {
                walletToUpdate.balance += BTC_EARN_RATE;
                user.earningsHistory.push({
                    timestamp: Date.now(),
                    amount: BTC_EARN_RATE,
                    walletAddress: wallet.address
                });
                state.currentUser = user; // update state
                storage.saveUser(user);
                
                // Update UI
                const balanceEl = document.getElementById(`balance-${wallet.address}`);
                if (balanceEl) {
                    balanceEl.textContent = walletToUpdate.balance.toFixed(8);
                }
                updateStats();
                renderBalanceChart();
            }
        }, EARN_INTERVAL);
        state.earningIntervals.push(interval);
    });
}

function stopEarning() {
    state.earningIntervals.forEach(clearInterval);
    state.earningIntervals = [];
}

// --- Wallet Management ---
function handleAddWallet() {
    const address = prompt(i18n.translate('addWalletPrompt'));
    if (address) {
        if (!BTC_ADDRESS_REGEX.test(address)) {
            alert(i18n.translate('invalidBtcAddress'));
            return;
        }
        if (state.currentUser.wallets.some(w => w.address === address)) {
            alert('This wallet address already exists.');
            return;
        }

        const user = storage.findUserById(state.currentUser.id);
        user.wallets.push({
            address,
            balance: 0,
            createdAt: Date.now()
        });
        storage.saveUser(user);
        state.currentUser = user;
        
        renderWallets();
        startEarning();
        alert(i18n.translate('addressAdded'));
    }
}

function handleDeleteWallet(e) {
    if (!e.target.classList.contains('delete-wallet-btn')) return;
    const address = e.target.dataset.address;
    if (confirm(i18n.translate('confirmDeleteWallet'))) {
        const user = storage.findUserById(state.currentUser.id);
        user.wallets = user.wallets.filter(w => w.address !== address);
        storage.saveUser(user);
        state.currentUser = user;

        renderDashboard();
        stopEarning();
        startEarning();
        alert(i18n.translate('walletDeleted'));
    }
}

function handleWithdraw(e) {
    if (!e.target.classList.contains('withdraw-btn')) return;
    const address = e.target.dataset.address;
    const wallet = state.currentUser.wallets.find(w => w.address === address);

    if (wallet.balance < MIN_WITHDRAWAL_AMOUNT) {
        alert(i18n.translate('withdrawalMinWarning'));
    } else {
        alert(i18n.translate('withdrawalSuccess'));
        // In a real app, this would trigger a backend process.
        // For this simulation, we can optionally reset the balance.
        const user = storage.findUserById(state.currentUser.id);
        const walletToUpdate = user.wallets.find(w => w.address === address);
        walletToUpdate.balance = 0;
        storage.saveUser(user);
        state.currentUser = user;
        renderDashboard();
    }
}


// --- Admin Actions ---
function handleSuspendUser(e) {
    if (!e.target.classList.contains('suspend-user-btn')) return;
    const userId = parseInt(e.target.dataset.userid);
    const allUsers = storage.getAllUsers();
    const user = allUsers.find(u => u.id === userId);
    if(user) {
        user.suspended = !user.suspended;
        storage.saveAllUsers(allUsers);
        alert(user.suspended ? i18n.translate('userSuspended') : i18n.translate('userActivated'));
        renderAdminPanel();
    }
}

function handleDeleteUser(e) {
    if (!e.target.classList.contains('delete-user-btn')) return;
    const userId = parseInt(e.target.dataset.userid);
     if (confirm(i18n.translate('confirmDeleteUser'))) {
        let allUsers = storage.getAllUsers();
        allUsers = allUsers.filter(u => u.id !== userId);
        storage.saveAllUsers(allUsers);
        alert(i18n.translate('userDeleted'));
        renderAdminPanel();
    }
}

function handleUpdateBalance(e) {
    if (!e.target.classList.contains('update-balance-btn')) return;
    const userId = parseInt(e.target.dataset.userid);
    const newBalanceStr = prompt(i18n.translate('updateBalancePrompt'));
    const newBalance = parseFloat(newBalanceStr);
    if (!isNaN(newBalance) && newBalance >= 0) {
        const allUsers = storage.getAllUsers();
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            if (user.wallets.length > 0) {
                user.wallets.forEach(w => w.balance = 0);
                user.wallets[0].balance = newBalance;
            } else {
                user.wallets.push({
                    address: 'manual-admin-update',
                    balance: newBalance,
                    createdAt: Date.now()
                });
            }
            storage.saveAllUsers(allUsers);
            alert(i18n.translate('balanceUpdated'));
            renderAdminPanel();
        }
    } else {
        alert('Invalid balance amount.');
    }
}

// --- Language Switcher ---
function handleLangSwitch(e) {
    if (!e.target.classList.contains('btn-lang')) return;
    const lang = e.target.id.split('-')[1];
    document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    i18n.loadLanguage(lang).then(() => {
        i18n.translatePage();
        // Re-render dynamic content that needs translation
        if(state.currentUser) {
            renderDashboard();
        }
    });
}

// --- Initialization ---
async function initializeApp() {
    storage.init();
    const currentUserId = storage.getCurrentUserId();
    
    // Load language first
    const userLang = storage.getUserLang();
    await i18n.loadLanguage(userLang);
    i18n.translatePage();
    document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`lang-${userLang}`).classList.add('active');

    if (currentUserId) {
        const user = storage.findUserById(currentUserId);
        if (user && !user.suspended) {
            state.currentUser = user;
            showPage('main');
            renderDashboard();
            startEarning();
        } else {
            handleLogout(); // clear invalid session
        }
    } else {
        showPage('login');
    }

    // Bind events once
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });
    document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); showPage('login'); });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.querySelector('.lang-switcher').addEventListener('click', handleLangSwitch);
    
    document.getElementById('add-wallet-btn').addEventListener('click', handleAddWallet);
    document.querySelector('#wallets-table tbody').addEventListener('click', handleDeleteWallet);
    document.querySelector('#wallets-table tbody').addEventListener('click', handleWithdraw);

    document.getElementById('toggle-admin-panel-btn')?.addEventListener('click', () => {
        const panel = document.getElementById('admin-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('admin-panel')?.addEventListener('click', handleSuspendUser);
    document.getElementById('admin-panel')?.addEventListener('click', handleDeleteUser);
    document.getElementById('admin-panel')?.addEventListener('click', handleUpdateBalance);

}

document.addEventListener('DOMContentLoaded', initializeApp);

