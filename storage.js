const DB_NAME = 'earnBTCPerMinDB';

function getInitialData() {
    return {
        users: [
            {
                id: 1,
                email: "superadmin@example.com",
                username: "superadmin",
                password: "Alperen1",
                role: "admin",
                suspended: false,
                wallets: [],
                earningsHistory: []
            }
        ],
        currentUser: null,
        userLang: 'en',
    };
}

export function init() {
    if (!localStorage.getItem(DB_NAME)) {
        localStorage.setItem(DB_NAME, JSON.stringify(getInitialData()));
    }
}

function getDB() {
    return JSON.parse(localStorage.getItem(DB_NAME));
}

function saveDB(db) {
    localStorage.setItem(DB_NAME, JSON.stringify(db));
}

export function getAllUsers() {
    return getDB().users;
}

export function saveAllUsers(users) {
    const db = getDB();
    db.users = users;
    saveDB(db);
}

export function findUserByEmail(email) {
    const users = getAllUsers();
    return users.find(user => user.email === email);
}

export function findUserById(id) {
    const users = getAllUsers();
    return users.find(user => user.id === id);
}

export function saveUser(userToSave) {
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userToSave.id);
    if (userIndex > -1) {
        users[userIndex] = userToSave;
    } else {
        userToSave.id = Date.now();
        users.push(userToSave);
    }
    saveAllUsers(users);
    return userToSave;
}

export function getCurrentUserId() {
    return getDB().currentUser;
}

export function setCurrentUserId(userId) {
    const db = getDB();
    db.currentUser = userId;
    saveDB(db);
}

export function clearCurrentUserId() {
    const db = getDB();
    db.currentUser = null;
    saveDB(db);
}

export function getUserLang() {
    return getDB().userLang || 'en';
}

export function setUserLang(lang) {
    const db = getDB();
    db.userLang = lang;
    saveDB(db);
}

