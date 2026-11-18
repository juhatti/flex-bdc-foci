window.addEventListener('DOMContentLoaded', () => {
    initFirebaseListeners();
    bindEvents();
    checkAutoLogin();
});

function initFirebaseListeners() {
    if (!window.FB) return;
    const { db, ref, onValue } = window.FB;
    const state = window.AppState;

    onValue(ref(db, 'users'), (snapshot) => {
        const rawUsers = snapshot.val() || {};
        const normalized = {};
        Object.entries(rawUsers).forEach(([key, u]) => {
            const uid = String(u.id || key);
            normalized[uid] = { ...u, id: uid };
        });
        state.users = normalized;

        if (state.currentUser && state.currentUser.id) {
            const dbUser = state.users[state.currentUser.id];
            if (dbUser) {
                if (dbUser.pending === true) {
                    state.currentUser = null;
                    state.isAdmin = false;
                    localStorage.removeItem('flex_foci_user');
                } else {
                    state.currentUser = dbUser;
                    state.isAdmin = state.currentUser.admin === true || state.currentUser.admin === 'yes' || state.currentUser.username === 'juhatti';
                }
            } else if (Object.keys(state.users).length > 0) {
                state.currentUser = null;
                state.isAdmin = false;
                localStorage.removeItem('flex_foci_user');
            }
        }
        renderApp();
    });

    onValue(ref(db, 'nextMatch'), (snapshot) => {
        const val = snapshot.val();
        if (val) {
            state.nextMatch = val;
            if (!state.nextMatch.attendances) state.nextMatch.attendances = {};
            if (!state.nextMatch.courtFee) state.nextMatch.courtFee = 18000;
            if (!state.nextMatch.feePerPerson) state.nextMatch.feePerPerson = 1000;
            if (!state.nextMatch.location) state.nextMatch.location = "ELTE Sport Kft Bogdánfy úti sporttelep";
        }
        renderApp();
    });

    onValue(ref(db, 'matches'), (snapshot) => {
        const val = snapshot.val();
        state.matches = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        renderApp();
    });

    onValue(ref(db, 'transactions'), (snapshot) => {
        state.transactions = snapshot.val() || {};
        renderApp();
        if (state.selectedPaymentUserId) {
            renderModalPlayerTransactions();
        }
    });

    onValue(ref(db, 'treasury'), (snapshot) => {
        const val = snapshot.val();
        state.treasury = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        renderApp();
    });
}

function bindEvents() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('go-to-register').addEventListener('click', () => toggleAuthMode('register'));
    document.getElementById('go-to-login').addEventListener('click', () => toggleAuthMode('login'));
    document.getElementById('tri-slider').addEventListener('click', handleSliderClick);
    document.getElementById('user-note').addEventListener('change', (e) => saveAttendanceNote(e.target.value));
    document.getElementById('edit-next-match-btn').addEventListener('click', openEditMatchDateModal);
    document.getElementById('open-match-mode-btn').addEventListener('click', () => openMatchMode());
    document.getElementById('close-match-mode-btn').addEventListener('click', closeMatchMode);
    document.getElementById('toggle-swap-mode-btn').addEventListener('click', toggleSwapMode);
    document.getElementById('add-general-sub-btn').addEventListener('click', addGeneralSubstitute);
    document.getElementById('add-player-btn').addEventListener('click', openAddPlayerModal);
    document.getElementById('close-add-player-modal-btn').addEventListener('click', closeAddPlayerModal);
    document.getElementById('save-match-results-btn').addEventListener('click', saveMatchResults);
    document.getElementById('prev-match-btn').addEventListener('click', prevMatchPage);
    document.getElementById('next-match-btn').addEventListener('click', nextMatchPage);
    document.getElementById('close-date-modal-btn').addEventListener('click', closeEditMatchDateModal);
    document.getElementById('save-date-modal-btn').addEventListener('click', saveNextMatchDateModal);
    document.getElementById('calendar-export-btn').addEventListener('click', exportToGoogleCalendar);
    document.getElementById('export-finances-btn').addEventListener('click', exportFinancesList);

    // Navigation tabs
    document.getElementById('nav-tab-matches').addEventListener('click', () => switchTab('matches'));
    document.getElementById('nav-tab-finances').addEventListener('click', () => switchTab('finances'));
    document.getElementById('nav-tab-standings').addEventListener('click', () => switchTab('standings'));

    // Transaction Pagination
    document.getElementById('prev-my-trans-btn').addEventListener('click', prevMyTransPage);
    document.getElementById('next-my-trans-btn').addEventListener('click', nextMyTransPage);
    document.getElementById('prev-treasury-btn').addEventListener('click', prevTreasuryPage);
    document.getElementById('next-treasury-btn').addEventListener('click', nextTreasuryPage);
    document.getElementById('prev-modal-trans-btn').addEventListener('click', prevModalTransPage);
    document.getElementById('next-modal-trans-btn').addEventListener('click', nextModalTransPage);

    // Player payment modal
    document.getElementById('close-payment-modal-btn').addEventListener('click', closePaymentModal);
    document.getElementById('save-payment-btn').addEventListener('click', savePayment);
    document.getElementById('btn-amount-minus').addEventListener('click', () => adjustModalAmount(-500));
    document.getElementById('btn-amount-plus').addEventListener('click', () => adjustModalAmount(500));

    // Treasury modal
    document.getElementById('open-treasury-modal-btn').addEventListener('click', openTreasuryModal);
    document.getElementById('close-treasury-modal-btn').addEventListener('click', closeTreasuryModal);
    document.getElementById('save-treasury-btn').addEventListener('click', saveTreasuryTransaction);

    // Edit Profile modal
    document.getElementById('open-edit-email-btn').addEventListener('click', openEditEmailModal);
    document.getElementById('close-edit-email-btn').addEventListener('click', closeEditEmailModal);
    document.getElementById('edit-email-form').addEventListener('submit', saveEditedEmail);

    const yearBtn = document.getElementById('year-dropdown-btn');
    const yearMenu = document.getElementById('year-dropdown-menu');
    yearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        yearMenu.classList.toggle('hidden');
    });
    window.addEventListener('click', () => {
        yearMenu.classList.add('hidden');
    });
}

function getTransactionTypeLabel(type) {
    if (type === 'match') return 'Meccs pályadíj';
    if (type === 'initial') return 'Kezdőegyenleg';
    if (type === 'expense') return 'Kiadás';
    return 'Befizetés';
}

function generateUniqueUserId() {
    const existingIds = new Set(Object.keys(window.AppState.users));
    for (let i = 101; i <= 999; i++) {
        if (!existingIds.has(String(i))) return String(i);
    }
    return String(Math.floor(100 + Math.random() * 900));
}

function switchTab(tabName) {
    const state = window.AppState;
    state.activeTab = tabName;
    closeMatchMode();

    const matchesTab = document.getElementById('tab-content-matches');
    const financesTab = document.getElementById('tab-content-finances');
    const standingsTab = document.getElementById('tab-content-standings');

    const btnMatches = document.getElementById('nav-tab-matches');
    const btnFinances = document.getElementById('nav-tab-finances');
    const btnStandings = document.getElementById('nav-tab-standings');

    [matchesTab, financesTab, standingsTab].forEach(el => el.classList.add('hidden'));
    [btnMatches, btnFinances, btnStandings].forEach(btn => {
        btn.className = 'flex items-center space-x-1.5 hover:text-gray-700 transition py-1 px-3 rounded-lg text-gray-400 font-medium';
    });

    if (tabName === 'matches') {
        matchesTab.classList.remove('hidden');
        btnMatches.className = 'flex items-center space-x-1.5 hover:text-gray-700 transition py-1 px-3 rounded-lg text-emerald-600 font-bold bg-emerald-50';
    } else if (tabName === 'finances') {
        financesTab.classList.remove('hidden');
        btnFinances.className = 'flex items-center space-x-1.5 hover:text-gray-700 transition py-1 px-3 rounded-lg text-amber-600 font-bold bg-amber-50';
    } else if (tabName === 'standings') {
        standingsTab.classList.remove('hidden');
        btnStandings.className = 'flex items-center space-x-1.5 hover:text-gray-700 transition py-1 px-3 rounded-lg text-indigo-600 font-bold bg-indigo-50';
        if (typeof window.renderStandings === 'function') {
            window.renderStandings();
        }
    }
}

window.selectYear = function(year) {
    const state = window.AppState;
    state.selectedYear = year;
    document.getElementById('selected-year-label').innerText = year;
    document.getElementById('year-dropdown-menu').classList.add('hidden');
    if (typeof window.renderStandings === 'function') {
        window.renderStandings();
    }
}

window.formatHungarianName = function(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName;

    const lastName = parts[0];
    const firstName = parts.slice(1).join(' ');

    const doubleConsonants = ['cs', 'dz', 'gy', 'ly', 'ny', 'sz', 'ty', 'zs', 'cz'];
    const lowerLast = lastName.toLowerCase();
    let initial = lastName.charAt(0).toUpperCase();

    for (let dc of doubleConsonants) {
        if (lowerLast.startsWith(dc)) {
            initial = lastName.substring(0, 2);
            initial = initial.charAt(0).toUpperCase() + initial.charAt(1).toLowerCase();
            break;
        }
    }

    return `${initial}. ${firstName}`;
}

async function handleLogin(e) {
    e.preventDefault();
    const state = window.AppState;
    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    if (!usernameInput) return;

    let matchedUser = Object.values(state.users).find(u => (u.username || '').toLowerCase() === usernameInput);

    if (!matchedUser && window.FB) {
        try {
            const { db, ref, get } = window.FB;
            const snapshot = await get(ref(db, 'users'));
            if (snapshot.exists()) {
                const rawUsers = snapshot.val() || {};
                const normalized = {};
                Object.entries(rawUsers).forEach(([key, u]) => {
                    const uid = String(u.id || key);
                    normalized[uid] = { ...u, id: uid };
                });
                state.users = normalized;
                matchedUser = Object.values(normalized).find(u => (u.username || '').toLowerCase() === usernameInput);
            }
        } catch (err) {
            console.error("Firebase login check error:", err);
        }
    }

    if (matchedUser) {
        if (matchedUser.pending === true) {
            showToast('Regisztráció jóváhagyása függőben');
            return;
        }
        state.currentUser = matchedUser;
        state.isAdmin = state.currentUser.admin === true || state.currentUser.admin === 'yes';
        saveSession();
    } else {
        showToast('Nem található ilyen felhasználónév!');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const state = window.AppState;
    const lastName = document.getElementById('reg-lastname').value.trim();
    const firstName = document.getElementById('reg-firstname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();

    if (!lastName || !firstName || !email || !username) {
        showToast('Kérlek tölts ki minden mezőt!');
        return;
    }

    const usernameExists = Object.values(state.users).some(u => (u.username || '').toLowerCase() === username);
    if (usernameExists) {
        showToast('Ez a felhasználónév már foglalt!');
        return;
    }

    const newId = generateUniqueUserId();
    const newUser = {
        id: newId,
        username,
        name: `${lastName} ${firstName}`,
        email,
        admin: 'no',
        pending: true
    };

    const { db, ref, set } = window.FB;
    set(ref(db, `users/${newId}`), newUser);
    document.getElementById('register-form').reset();
    toggleAuthMode('login');
    showToast('Regisztráció elküldve! Jóváhagyása függőben.');
}

function saveSession() {
    const state = window.AppState;
    localStorage.setItem('flex_foci_user', JSON.stringify({ user: state.currentUser, isAdmin: state.isAdmin }));
    renderApp();
    showToast(`Üdvözlünk, ${state.currentUser.name}!`);
}

function checkAutoLogin() {
    const state = window.AppState;
    const saved = localStorage.getItem('flex_foci_user');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.user && parsed.user.pending === true) {
                localStorage.removeItem('flex_foci_user');
            } else {
                state.currentUser = parsed.user;
                state.isAdmin = parsed.isAdmin;
            }
        } catch(e) {
            localStorage.removeItem('flex_foci_user');
        }
    }
    renderApp();
}

function logout() {
    const state = window.AppState;
    state.currentUser = null;
    state.isAdmin = false;
    localStorage.removeItem('flex_foci_user');
    renderApp();
    showToast('Kijelentkezve.');
}

function toggleAuthMode(mode) {
    const loginWidget = document.getElementById('login-widget-container');
    if (mode === 'register') {
        document.getElementById('auth-section').classList.add('hidden');
        if (loginWidget) loginWidget.classList.add('hidden');
        document.getElementById('register-section').classList.remove('hidden');
    } else {
        document.getElementById('register-section').classList.add('hidden');
        document.getElementById('auth-section').classList.remove('hidden');
        if (typeof window.renderStandings === 'function') {
            window.renderStandings();
        }
    }
}

function openEditEmailModal() {
    const state = window.AppState;
    if (!state.currentUser || state.currentUser.username === 'admin') return;
    const uid = String(state.currentUser.id);
    const userObj = state.users[uid] || state.currentUser;
    const parts = (userObj.name || '').trim().split(/\s+/);
    document.getElementById('edit-user-id-label').innerText = `#${uid}`;
    document.getElementById('edit-lastname').value = parts[0] || '';
    document.getElementById('edit-firstname').value = parts.slice(1).join(' ') || '';
    document.getElementById('edit-username').value = userObj.username || '';
    document.getElementById('edit-email').value = userObj.email || '';
    document.getElementById('edit-email-reminder').checked = Boolean(userObj.matchReminder);
    document.getElementById('edit-email-modal').classList.remove('hidden');
}

function closeEditEmailModal() {
    document.getElementById('edit-email-modal').classList.add('hidden');
}

function saveEditedEmail(e) {
    e.preventDefault();
    const state = window.AppState;
    if (!state.currentUser) return;

    const uid = String(state.currentUser.id);
    const newUsername = document.getElementById('edit-username').value.trim().toLowerCase();
    const newEmail = document.getElementById('edit-email').value.trim();

    if (!newUsername) {
        showToast('Kérlek add meg a felhasználónevet!');
        return;
    }
    if (!newEmail) {
        showToast('Kérlek add meg az email címet!');
        return;
    }

    const usernameConflict = Object.values(state.users).some(u => String(u.id) !== uid && (u.username || '').toLowerCase() === newUsername) || newUsername === 'admin';
    if (usernameConflict) {
        showToast('Ez a felhasználónév már foglalt!');
        return;
    }

    const wantReminder = document.getElementById('edit-email-reminder').checked;

    state.currentUser.username = newUsername;
    state.currentUser.email = newEmail;
    state.currentUser.matchReminder = wantReminder;

    if (state.users[uid]) {
        state.users[uid].username = newUsername;
        state.users[uid].email = newEmail;
        state.users[uid].matchReminder = wantReminder;
    }

    const { db, ref, set } = window.FB;
    set(ref(db, `users/${uid}`), state.users[uid] || state.currentUser);
    saveSession();
    closeEditEmailModal();
    showToast('Profil sikeresen frissítve!');
}

function handleSliderClick(e) {
    const state = window.AppState;
    if (!state.currentUser) return;
    const option = e.target.closest('.tri-slider-option');
    let nextStatus;
    if (option && option.dataset.status) {
        nextStatus = option.dataset.status;
    } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        if (relX < rect.width / 3) nextStatus = 'no';
        else if (relX < (rect.width * 2) / 3) nextStatus = 'maybe';
        else nextStatus = 'yes';
    }
    const uid = String(state.currentUser.id);
    if (!state.nextMatch.attendances) state.nextMatch.attendances = {};
    const currentAtt = state.nextMatch.attendances[uid] || { status: 'maybe', note: '' };
    if (currentAtt.status !== nextStatus) {
        updateAttendanceDB(uid, nextStatus, currentAtt.note);
    }
}

function saveAttendanceNote(val) {
    const state = window.AppState;
    if (!state.currentUser) return;
    const uid = String(state.currentUser.id);
    const currentAtt = state.nextMatch.attendances[uid] || { status: 'maybe', note: '' };
    updateAttendanceDB(uid, currentAtt.status, val.trim());
}

async function updateAttendanceDB(userId, status, note) {
    const state = window.AppState;
    const uid = String(userId);
    const userData = state.users[uid] || state.currentUser;
    if (!state.nextMatch.attendances) state.nextMatch.attendances = {};
    const payload = { id: uid, status, note: note || '', name: userData.name };

    // Optimistic UI update so the slider moves immediately
    state.nextMatch.attendances[uid] = payload;
    renderNextMatchCard();
    renderAttendeesList();

    if (window.FB) {
        const { db, ref, set, auth } = window.FB;
        if (auth && auth.authStateReady) {
            await auth.authStateReady();
        }
        set(ref(db, `nextMatch/attendances/${uid}`), payload).catch(err => {
            console.error("Attendance update error:", err);
        });
    }
    document.getElementById('attendance-msg').classList.remove('opacity-0');
}

function setUserStatusAdmin(userId, statusVal) {
    const state = window.AppState;
    if (!state.isAdmin) return;
    const uid = String(userId);
    const att = state.nextMatch.attendances[uid] || { note: '', name: state.users[uid]?.name || uid };
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${uid}`), { id: uid, status: statusVal, note: att.note, name: att.name });
}

function renderApp() {
    const state = window.AppState;
    const authSec = document.getElementById('auth-section');
    const dashSec = document.getElementById('dashboard-section');
    const userHeader = document.getElementById('user-header-info');
    const navMenuBar = document.getElementById('nav-menu-bar');
    const adminBadge = document.getElementById('admin-badge');
    const adminControls = document.getElementById('admin-controls');
    const editMatchBtn = document.getElementById('edit-next-match-btn');

    if (state.currentUser) {
        authSec.classList.add('hidden');
        document.getElementById('register-section').classList.add('hidden');
        const loginWidget = document.getElementById('login-widget-container');
        if (loginWidget) {
            loginWidget.classList.add('hidden');
            loginWidget.innerHTML = '';
        }
        dashSec.classList.remove('hidden');
        userHeader.classList.remove('hidden');
        navMenuBar.classList.remove('hidden');
        
        document.getElementById('logged-user-name').innerText = state.currentUser.name;
        if (state.isAdmin) {
            adminBadge.classList.remove('hidden');
            adminControls.classList.remove('hidden');
            editMatchBtn.classList.remove('hidden');
        } else {
            adminBadge.classList.add('hidden');
            adminControls.classList.add('hidden');
            editMatchBtn.classList.add('hidden');
        }

        renderPendingUsers();
        renderNextMatchCard();
        renderAttendeesList();
        renderLastMatches();
        renderFinances();
        switchTab(state.activeTab);
    } else {
        dashSec.classList.add('hidden');
        userHeader.classList.add('hidden');
        navMenuBar.classList.add('hidden');
        authSec.classList.remove('hidden');
        if (typeof window.renderStandings === 'function') {
            window.renderStandings();
        }
    }
}

function renderPendingUsers() {
    const state = window.AppState;
    const section = document.getElementById('pending-users-section');
    const list = document.getElementById('pending-users-list');
    const countBadge = document.getElementById('pending-users-count');
    if (!section || !list) return;

    if (!state.isAdmin) {
        section.classList.add('hidden');
        return;
    }

    const pendingUsers = Object.values(state.users).filter(u => u.pending === true);
    if (pendingUsers.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    if (countBadge) countBadge.innerText = pendingUsers.length;
    list.innerHTML = '';

    pendingUsers.forEach(u => {
        const uid = String(u.id);
        const row = document.createElement('div');
        row.className = 'flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs gap-2';
        row.innerHTML = `
            <div>
                <div class="font-bold text-gray-800">${u.name} <span class="text-gray-400 font-normal">(@${u.username} • #${uid})</span></div>
                <div class="text-[11px] text-gray-500">${u.email || ''}</div>
            </div>
            <div class="flex items-center space-x-2 self-end sm:self-center">
                <button type="button" class="btn-approve-user px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition shadow-2xs">
                    <i class="fa-solid fa-check mr-1"></i> Jóváhagyás
                </button>
                <button type="button" class="btn-reject-user px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition border border-red-200">
                    <i class="fa-solid fa-trash mr-1"></i> Törlés
                </button>
            </div>
        `;
        row.querySelector('.btn-approve-user').addEventListener('click', () => approvePendingUser(uid));
        row.querySelector('.btn-reject-user').addEventListener('click', () => rejectPendingUser(uid));
        list.appendChild(row);
    });
}

function approvePendingUser(uid) {
    const state = window.AppState;
    if (!state.isAdmin || !state.users[uid]) return;
    const { db, ref, set } = window.FB;
    set(ref(db, `users/${uid}/pending`), null);
    showToast(`${state.users[uid].name} regisztrációja jóváhagyva!`);
}

function rejectPendingUser(uid) {
    const state = window.AppState;
    if (!state.isAdmin || !state.users[uid]) return;
    const userName = state.users[uid].name;
    if (!confirm(`Biztosan törlöd ${userName} regisztrációját?`)) return;
    const { db, ref, set } = window.FB;
    set(ref(db, `users/${uid}`), null);
    showToast(`${userName} regisztrációja törölve.`);
}

function renderNextMatchCard() {
    const state = window.AppState;
    document.getElementById('next-match-date-display').innerText = `${state.nextMatch.date} ${state.nextMatch.startTime} - ${state.nextMatch.endTime}`;
    document.getElementById('next-match-location-text').innerText = state.nextMatch.location || "ELTE Sport Kft Bogdánfy úti sporttelep";
    
    const fee = state.nextMatch.courtFee || 18000;
    const perPerson = state.nextMatch.feePerPerson || 1000;
    document.getElementById('next-match-fee-info').innerHTML = `
        <span>${fee.toLocaleString()} Ft</span>
        <span>•</span>
        <span><i class="fa-solid fa-user text-gray-300 mr-0.5"></i> ${perPerson.toLocaleString()} Ft / fő</span>
        <span>•</span>
        <button id="calendar-export-btn" class="text-gray-400 hover:text-gray-700 transition" title="Google Naptár esemény létrehozása">
            <i class="fa-solid fa-calendar-plus text-sm"></i>
        </button>
    `;
    document.getElementById('calendar-export-btn').addEventListener('click', exportToGoogleCalendar);

    if (!state.currentUser) return;
    const uid = String(state.currentUser.id);
    const myAtt = state.nextMatch.attendances[uid] || { status: 'maybe', note: '' };
    const thumb = document.getElementById('slider-thumb');
    thumb.className = 'tri-slider-thumb';
    if (myAtt.status === 'no') thumb.classList.add('pos-left');
    else if (myAtt.status === 'maybe') thumb.classList.add('pos-mid');
    else if (myAtt.status === 'yes') thumb.classList.add('pos-right');

    document.getElementById('user-note').value = myAtt.note || '';
}

function exportToGoogleCalendar() {
    const state = window.AppState;
    const dateStr = state.nextMatch.date.replace(/\./g, '').trim().replace(/ /g, '');
    const startTime = (state.nextMatch.startTime || "09:00").replace(':', '');
    const endTime = (state.nextMatch.endTime || "10:00").replace(':', '');
    
    const startIso = `${dateStr}T${startTime}00`;
    const endIso = `${dateStr}T${endTime}00`;
    
    const title = encodeURIComponent("Flex BDC Foci");
    const location = encodeURIComponent(state.nextMatch.location || "ELTE Sport Kft Bogdánfy úti sporttelep");
    const details = encodeURIComponent("Részletek: https://juhatti.github.io/flex-bdc-foci/");
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&location=${location}&details=${details}`;
    window.open(url, '_blank');
}

function renderAttendeesList() {
    const state = window.AppState;
    const container = document.getElementById('attendees-list');
    container.innerHTML = '';

    let yesCount = 0;
    const entries = Object.entries(state.nextMatch.attendances || {});

    entries.forEach(([uid, att], idx) => {
        if (att.status === 'yes') yesCount++;
        const displayName = state.users[uid]?.name || att.name || uid;
        const formattedName = window.formatHungarianName(displayName);
        const isSub = att.isSubstitute === true;

        let iconHtml = att.status === 'yes' ? `<span class="text-emerald-500 bg-emerald-50 p-1.5 rounded-lg"><i class="fa-solid fa-square-check"></i></span>` :
                       att.status === 'no' ? `<span class="text-red-500 bg-red-50 p-1.5 rounded-lg"><i class="fa-solid fa-square-xmark"></i></span>` :
                       `<span class="text-amber-500 bg-amber-50 p-1.5 rounded-lg"><i class="fa-solid fa-circle-question"></i></span>`;

        const row = document.createElement('div');
        row.className = 'py-3 flex items-center justify-between text-sm hover:bg-gray-50/50 px-2 rounded-xl transition';
        
        if (isSub) {
            row.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="text-xs text-gray-400 font-bold w-4">${idx + 1}.</span>
                    <div>
                        <div class="flex items-center space-x-2">
                            <span class="font-semibold text-gray-800">${formattedName}</span>
                            <span class="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Beugró</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    ${state.isAdmin ? `<button class="btn-del-sub text-xs px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg transition"><i class="fa-solid fa-trash mr-1"></i> Törlés</button>` : ''}
                    ${iconHtml}
                </div>
            `;
            if (state.isAdmin) row.querySelector('.btn-del-sub').addEventListener('click', () => removeGeneralSubstitute(uid));
        } else {
            row.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="text-xs text-gray-400 font-bold w-4">${idx + 1}.</span>
                    <div>
                        <span class="font-semibold text-gray-800">${formattedName}</span>
                        ${att.note ? `<p class="text-xs text-gray-400 italic font-normal">"${att.note}"</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    ${state.isAdmin ? `
                        <button class="btn-att-yes text-xs px-2 py-1 rounded ${att.status === 'yes' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}">✓</button>
                        <button class="btn-att-no text-xs px-2 py-1 rounded ${att.status === 'no' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}">✕</button>
                    ` : ''}
                    ${iconHtml}
                </div>
            `;
            if (state.isAdmin) {
                row.querySelector('.btn-att-yes').addEventListener('click', () => setUserStatusAdmin(uid, 'yes'));
                row.querySelector('.btn-att-no').addEventListener('click', () => setUserStatusAdmin(uid, 'no'));
            }
        }
        container.appendChild(row);
    });

    const badgeContainer = document.getElementById('attending-badge-container');
    document.getElementById('attending-count').innerText = yesCount;
    badgeContainer.className = `border rounded-xl px-6 py-2 text-center transition-colors ${yesCount < 8 ? 'bg-red-50 border-red-100 text-red-700' : yesCount <= 9 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`;
}

function addGeneralSubstitute() {
    const subName = prompt('Add meg a beugró nevét:', 'Beugró Játékos');
    if (!subName || !subName.trim()) return;
    const subKey = 'sub_' + Date.now();
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${subKey}`), { id: subKey, status: 'yes', note: '', name: subName.trim(), isSubstitute: true });
    showToast('Beugró hozzáadva!');
}

function openAddPlayerModal() {
    const state = window.AppState;
    if (!state.isAdmin) return;
    
    const container = document.getElementById('add-player-modal-list');
    container.innerHTML = '';
    
    const currentAttendees = state.nextMatch.attendances || {};
    const unlistedUsers = Object.values(state.users).filter(u => u.pending !== true && !currentAttendees[String(u.id)]);

    if (unlistedUsers.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Minden regisztrált játékos szerepel már a listán.</p>`;
    } else {
        unlistedUsers.forEach(u => {
            const uid = String(u.id);
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-50 p-2 rounded-xl text-xs hover:bg-emerald-50 transition border border-gray-100';
            div.innerHTML = `
                <span class="font-semibold text-gray-800">${u.name} <span class="text-gray-400 font-normal">(#${uid})</span></span>
                <button type="button" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs">Hozzáadás</button>
            `;
            div.querySelector('button').addEventListener('click', () => {
                const { db, ref, set } = window.FB;
                set(ref(db, `nextMatch/attendances/${uid}`), { id: uid, status: 'yes', note: '', name: u.name });
                showToast(`${u.name} hozzáadva a meccshez!`);
                closeAddPlayerModal();
            });
            container.appendChild(div);
        });
    }

    document.getElementById('add-player-modal').classList.remove('hidden');
}

function closeAddPlayerModal() {
    document.getElementById('add-player-modal').classList.add('hidden');
}

function removeGeneralSubstitute(subKey) {
    if (!confirm('Biztosan törlöd ezt a beugrót?')) return;
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${subKey}`), null);
    showToast('Beugró törölve.');
}

function renderLastMatches() {
    const state = window.AppState;
    const container = document.getElementById('last-matches-container');
    const paginationContainer = document.getElementById('match-pagination');
    container.innerHTML = '';

    const reversedMatches = [...state.matches].reverse();
    const pageSize = 3;
    const totalPages = Math.ceil(reversedMatches.length / pageSize) || 1;

    if (state.currentMatchPage >= totalPages) state.currentMatchPage = totalPages - 1;
    if (state.currentMatchPage < 0) state.currentMatchPage = 0;

    const pageMatches = reversedMatches.slice(state.currentMatchPage * pageSize, (state.currentMatchPage + 1) * pageSize);

    if (reversedMatches.length > pageSize) {
        paginationContainer.classList.remove('hidden');
        document.getElementById('match-page-indicator').innerText = `${state.currentMatchPage + 1} / ${totalPages}`;
        document.getElementById('prev-match-btn').disabled = state.currentMatchPage === 0;
        document.getElementById('next-match-btn').disabled = state.currentMatchPage >= totalPages - 1;
    } else {
        paginationContainer.classList.add('hidden');
    }

    if (pageMatches.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Még nincsenek rögzített meccsek.</p>`;
        return;
    }

    pageMatches.forEach((m) => {
        const actualIndex = state.matches.indexOf(m);
        const resolveName = (p) => (p.id && state.users[String(p.id)]?.name) || p.name;

        const formatPlayerEntry = (p, colorClass) => {
            const name = window.formatHungarianName(resolveName(p));
            const goals = parseInt(p.goals || 0);
            if (goals > 0) {
                return `${name} <span class="${colorClass} border px-1.5 py-0.5 rounded text-[10px] font-bold">${goals}</span>`;
            }
            return name;
        };

        // Split starting players and swapped players
        const teamAStarters = (m.teamA || []).filter(p => !p.isSwapped);
        const teamBStarters = (m.teamB || []).filter(p => !p.isSwapped);
        const teamASwaps = (m.teamA || []).filter(p => p.isSwapped);
        const teamBSwaps = (m.teamB || []).filter(p => p.isSwapped);

        const teamAListHtml = teamAStarters.map(p => formatPlayerEntry(p, 'bg-emerald-50 text-emerald-800')).join(', ') || '-';
        const teamBListHtml = teamBStarters.map(p => formatPlayerEntry(p, 'bg-indigo-50 text-indigo-800')).join(', ') || '-';

        const hasSwaps = teamASwaps.length > 0 || teamBSwaps.length > 0;
        let swapsRowHtml = '';
        if (hasSwaps) {
            const teamASwapsHtml = teamASwaps.map(p => formatPlayerEntry(p, 'bg-emerald-50 text-emerald-800')).join(', ') || '';
            const teamBSwapsHtml = teamBSwaps.map(p => formatPlayerEntry(p, 'bg-indigo-50 text-indigo-800')).join(', ') || '';
            swapsRowHtml = `
                <div class="text-xs text-gray-500 mt-2 flex items-center justify-between px-4 border-t border-dashed border-gray-200 pt-2">
                    <span class="w-5/12 text-left pr-2 text-emerald-700 font-medium">${teamASwapsHtml}</span>
                    <span class="w-2/12 text-center text-purple-600" title="Csere meccs közben"><i class="fa-solid fa-right-left"></i></span>
                    <span class="w-5/12 text-right pl-2 text-indigo-700 font-medium">${teamBSwapsHtml}</span>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'bg-gray-50 border border-gray-100 p-4 rounded-xl text-center relative shadow-2xs';
        card.innerHTML = `
            ${state.isAdmin ? `<button class="btn-edit-match absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1.5"><i class="fa-solid fa-pen text-xs"></i></button>` : ''}
            <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">${m.date}</div>
            <div class="text-2xl font-black text-gray-800 my-1">${m.scoreA} : ${m.scoreB}</div>
            <div class="text-xs text-gray-500 mt-2 flex justify-between px-4 border-t pt-2">
                <span class="w-1/2 text-left pr-2 text-emerald-700 font-medium">${teamAListHtml}</span>
                <span class="w-1/2 text-right pl-2 text-indigo-700 font-medium">${teamBListHtml}</span>
            </div>
            ${swapsRowHtml}
        `;
        if (state.isAdmin) card.querySelector('.btn-edit-match').addEventListener('click', () => openMatchMode(actualIndex));
        container.appendChild(card);
    });
}

function prevMatchPage() {
    if (window.AppState.currentMatchPage > 0) { window.AppState.currentMatchPage--; renderLastMatches(); }
}
function nextMatchPage() {
    if (window.AppState.currentMatchPage < Math.ceil(window.AppState.matches.length / 3) - 1) { window.AppState.currentMatchPage++; renderLastMatches(); }
}

function prevMyTransPage() {
    if (window.AppState.currentMyTransPage > 0) { window.AppState.currentMyTransPage--; renderFinances(); }
}
function nextMyTransPage() {
    const uid = String(window.AppState.currentUser?.id || '');
    const len = (window.AppState.transactions[uid] || []).length;
    if (window.AppState.currentMyTransPage < Math.ceil(len / 3) - 1) { window.AppState.currentMyTransPage++; renderFinances(); }
}

function prevTreasuryPage() {
    if (window.AppState.currentTreasuryPage > 0) { window.AppState.currentTreasuryPage--; renderFinances(); }
}
function nextTreasuryPage() {
    const len = (window.AppState.treasury || []).length;
    if (window.AppState.currentTreasuryPage < Math.ceil(len / 3) - 1) { window.AppState.currentTreasuryPage++; renderFinances(); }
}

function prevModalTransPage() {
    if (window.AppState.currentModalTransPage > 0) {
        window.AppState.currentModalTransPage--;
        renderModalPlayerTransactions();
    }
}
function nextModalTransPage() {
    const uid = String(window.AppState.selectedPaymentUserId || '');
    const len = (window.AppState.transactions[uid] || []).length;
    if (window.AppState.currentModalTransPage < Math.ceil(len / 3) - 1) {
        window.AppState.currentModalTransPage++;
        renderModalPlayerTransactions();
    }
}

window.renderFinances = function() {
    const state = window.AppState;
    if (!state.currentUser) return;

    const uid = String(state.currentUser.id);
    const balances = {};
    Object.keys(state.users).forEach(idKey => {
        balances[idKey] = (state.transactions[idKey] || []).reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    });

    const myBal = balances[uid] || 0;
    const myBalText = `${myBal > 0 ? '+' : ''}${myBal.toLocaleString()} Ft`;
    const badgeColorClass = myBal >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800';

    // Update header balance badge
    const headerBalBadge = document.getElementById('header-balance-badge');
    if (headerBalBadge) {
        document.getElementById('header-balance-amount').innerText = myBalText;
        headerBalBadge.className = `px-2.5 py-1 rounded-lg border font-bold text-[11px] ${badgeColorClass}`;
    }

    // Update finances page balance badge
    const myBalBadge = document.getElementById('my-balance-badge');
    document.getElementById('my-balance-amount').innerText = myBalText;
    myBalBadge.className = `px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs ${badgeColorClass}`;

    // Paginate user's own transactions (3 per page)
    const myTransList = document.getElementById('my-transactions-list');
    const myTransPagination = document.getElementById('my-trans-pagination');
    myTransList.innerHTML = '';

    const reversedMyTrans = [...(state.transactions[uid] || [])].reverse();
    const pageSize = 3;
    const totalMyPages = Math.ceil(reversedMyTrans.length / pageSize) || 1;
    if (state.currentMyTransPage >= totalMyPages) state.currentMyTransPage = totalMyPages - 1;
    if (state.currentMyTransPage < 0) state.currentMyTransPage = 0;

    if (reversedMyTrans.length > pageSize) {
        myTransPagination.classList.remove('hidden');
        document.getElementById('my-trans-page-indicator').innerText = `${state.currentMyTransPage + 1} / ${totalMyPages}`;
        document.getElementById('prev-my-trans-btn').disabled = state.currentMyTransPage === 0;
        document.getElementById('next-my-trans-btn').disabled = state.currentMyTransPage >= totalMyPages - 1;
    } else {
        myTransPagination.classList.add('hidden');
    }

    const pageMyTrans = reversedMyTrans.slice(state.currentMyTransPage * pageSize, (state.currentMyTransPage + 1) * pageSize);
    if (pageMyTrans.length === 0) {
        myTransList.innerHTML = `<p class="text-xs text-gray-400 text-center py-2">Nincs rögzített tranzakciód.</p>`;
    } else {
        pageMyTrans.forEach(t => {
            const isPos = t.amount >= 0;
            const typeLabel = getTransactionTypeLabel(t.type);
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs';
            row.innerHTML = `<div><span class="font-semibold text-gray-800 block">${typeLabel}</span><span class="text-[10px] text-gray-400">${t.date}</span></div><span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span>`;
            myTransList.appendChild(row);
        });
    }

    const adminFinSec = document.getElementById('admin-finances-container');
    if (state.isAdmin) {
        adminFinSec.classList.remove('hidden');
        const allBalList = document.getElementById('all-users-balances-list');
        allBalList.innerHTML = '';

        const allUsersArr = Object.values(state.users).filter(u => u.pending !== true);
        allUsersArr.forEach(u => {
            const uIdStr = String(u.id);
            const bal = balances[uIdStr] || 0;
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 hover:bg-purple-50/50 cursor-pointer border border-gray-100 transition text-xs';
            row.innerHTML = `<span class="font-semibold text-gray-800">${window.formatHungarianName(u.name)} <span class="text-gray-400 font-normal text-[10px]">#${uIdStr}</span></span><span class="font-bold px-2 py-0.5 rounded-md text-[11px] ${bal >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${bal >= 0 ? '+' : ''}${bal.toLocaleString()} Ft</span>`;
            row.addEventListener('click', () => openPaymentModal(uIdStr, u.name, bal));
            allBalList.appendChild(row);
        });
    } else {
        adminFinSec.classList.add('hidden');
    }

    const treasuryBal = state.treasury.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    document.getElementById('treasury-balance-amount').innerText = `${treasuryBal > 0 ? '+' : ''}${treasuryBal.toLocaleString()} Ft`;
    document.getElementById('treasury-balance-badge').className = `px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs ${treasuryBal >= 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`;

    // Paginate treasury transactions (3 per page)
    const treasuryList = document.getElementById('treasury-transactions-list');
    const treasuryPagination = document.getElementById('treasury-pagination');
    treasuryList.innerHTML = '';

    const reversedTreasury = [...state.treasury].reverse();
    const totalTreasuryPages = Math.ceil(reversedTreasury.length / pageSize) || 1;
    if (state.currentTreasuryPage >= totalTreasuryPages) state.currentTreasuryPage = totalTreasuryPages - 1;
    if (state.currentTreasuryPage < 0) state.currentTreasuryPage = 0;

    if (reversedTreasury.length > pageSize) {
        treasuryPagination.classList.remove('hidden');
        document.getElementById('treasury-page-indicator').innerText = `${state.currentTreasuryPage + 1} / ${totalTreasuryPages}`;
        document.getElementById('prev-treasury-btn').disabled = state.currentTreasuryPage === 0;
        document.getElementById('next-treasury-btn').disabled = state.currentTreasuryPage >= totalTreasuryPages - 1;
    } else {
        treasuryPagination.classList.add('hidden');
    }

    const pageTreasury = reversedTreasury.slice(state.currentTreasuryPage * pageSize, (state.currentTreasuryPage + 1) * pageSize);
    if (pageTreasury.length === 0) {
        treasuryList.innerHTML = `<p class="text-xs text-gray-400 text-center py-2">Nincs rögzített kasszamozgás.</p>`;
    } else {
        pageTreasury.forEach(t => {
            const isPos = t.amount >= 0;
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs';
            row.innerHTML = `<div><span class="font-semibold text-gray-800 block">${t.note || (t.type === 'income' ? 'Bevétel' : 'Kiadás')}</span><span class="text-[10px] text-gray-400">${t.date}</span></div><span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span>`;
            treasuryList.appendChild(row);
        });
    }

    const treasuryModalBtn = document.getElementById('open-treasury-modal-btn');
    if (state.isAdmin) treasuryModalBtn.classList.remove('hidden');
    else treasuryModalBtn.classList.add('hidden');
}

function exportFinancesList() {
    const state = window.AppState;
    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

    let text = `Egyenlegek - ${dateStr}\n\n`;
    
    Object.values(state.users).filter(u => u.pending !== true).forEach(u => {
        const uid = String(u.id);
        const bal = (state.transactions[uid] || []).reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
        text += `${u.name} (#${uid}): ${bal >= 0 ? '+' : ''}${bal.toLocaleString()} Ft\n`;
    });

    const treasuryBal = state.treasury.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    text += `\nCsapatkassza: ${treasuryBal >= 0 ? '+' : ''}${treasuryBal.toLocaleString()} Ft\n\nUtolsó 3 kasszamozgás:\n`;

    [...state.treasury].slice(-3).reverse().forEach(t => {
        text += `- ${t.date}: ${t.note || 'Mozgás'} (${t.amount >= 0 ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft)\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        showToast('Pénzügyi lista a vágólapra másolva!');
    }).catch(() => {
        alert(text);
    });
}

function openPaymentModal(userId, name, currentBal) {
    const state = window.AppState;
    if (!state.isAdmin) return;
    state.selectedPaymentUserId = String(userId);
    state.currentModalTransPage = 0;
    document.getElementById('modal-user-name').innerText = `${window.formatHungarianName(name)} (#${userId})`;
    document.getElementById('modal-user-balance').innerText = `${currentBal > 0 ? '+' : ''}${currentBal.toLocaleString()} Ft`;
    document.getElementById('modal-trans-type').value = 'payment';
    document.getElementById('modal-amount-input').value = 1000;
    renderModalPlayerTransactions();
    document.getElementById('payment-modal').classList.remove('hidden');
}

function renderModalPlayerTransactions() {
    const state = window.AppState;
    const container = document.getElementById('modal-user-last-trans');
    const paginationContainer = document.getElementById('modal-trans-pagination');
    container.innerHTML = '';

    const userTrans = state.transactions[state.selectedPaymentUserId] || [];
    const currentBal = userTrans.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    document.getElementById('modal-user-balance').innerText = `${currentBal > 0 ? '+' : ''}${currentBal.toLocaleString()} Ft`;

    const reversedTrans = [...userTrans].reverse();
    const pageSize = 3;
    const totalPages = Math.ceil(reversedTrans.length / pageSize) || 1;

    if (state.currentModalTransPage >= totalPages) state.currentModalTransPage = totalPages - 1;
    if (state.currentModalTransPage < 0) state.currentModalTransPage = 0;

    if (reversedTrans.length > pageSize) {
        paginationContainer.classList.remove('hidden');
        document.getElementById('modal-trans-page-indicator').innerText = `${state.currentModalTransPage + 1} / ${totalPages}`;
        document.getElementById('prev-modal-trans-btn').disabled = state.currentModalTransPage === 0;
        document.getElementById('next-modal-trans-btn').disabled = state.currentModalTransPage >= totalPages - 1;
    } else {
        paginationContainer.classList.add('hidden');
    }

    const pageTrans = reversedTrans.slice(state.currentModalTransPage * pageSize, (state.currentModalTransPage + 1) * pageSize);

    if (pageTrans.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-gray-400 text-center py-2">Nincs rögzített tranzakció.</p>`;
        return;
    }

    pageTrans.forEach(t => {
        const origIdx = userTrans.indexOf(t);
        const isPos = t.amount >= 0;
        const typeLabel = getTransactionTypeLabel(t.type);
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-50 p-1.5 rounded text-[11px] border border-gray-100';
        div.innerHTML = `
            <div class="truncate pr-2">
                <span class="font-semibold text-gray-800">${typeLabel}</span>
                <span class="text-gray-400 text-[10px] ml-1">${t.date}</span>
            </div>
            <div class="flex items-center space-x-1.5 shrink-0">
                <span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span>
                <button type="button" class="text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded bg-red-50 font-bold" title="Tranzakció törlése">
                    <i class="fa-solid fa-trash text-[10px]"></i>
                </button>
            </div>
        `;
        div.querySelector('button').addEventListener('click', () => deletePlayerTransaction(origIdx));
        container.appendChild(div);
    });
}

function deletePlayerTransaction(idx) {
    const state = window.AppState;
    if (!confirm('Biztosan törlöd ezt a tranzakciót?')) return;
    const userTrans = state.transactions[state.selectedPaymentUserId] || [];
    userTrans.splice(idx, 1);
    const { db, ref, set } = window.FB;
    set(ref(db, `transactions/${state.selectedPaymentUserId}`), userTrans);
    renderModalPlayerTransactions();
    showToast('Tranzakció törölve.');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
    window.AppState.selectedPaymentUserId = null;
}

function adjustModalAmount(delta) {
    const inp = document.getElementById('modal-amount-input');
    inp.value = Math.max(500, (parseInt(inp.value) || 0) + delta);
}

function savePayment() {
    const state = window.AppState;
    if (!state.isAdmin || !state.selectedPaymentUserId) return;
    let amount = Math.abs(parseInt(document.getElementById('modal-amount-input').value) || 0);
    const type = document.getElementById('modal-trans-type').value;
    if (amount <= 0) return showToast('Érvénytelen összeg!');

    if (type === 'expense') {
        amount = -amount;
    }
    
    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;
    const userTrans = state.transactions[state.selectedPaymentUserId] || [];
    userTrans.push({ amount, date: dateStr, type });

    const { db, ref, set } = window.FB;
    set(ref(db, `transactions/${state.selectedPaymentUserId}`), userTrans);
    closePaymentModal();
    showToast(type === 'expense' ? 'Kiadás rögzítve!' : 'Befizetés rögzítve!');
}

function openTreasuryModal() {
    if (!window.AppState.isAdmin) return;
    document.getElementById('treasury-amount-input').value = 10000;
    document.getElementById('treasury-note-input').value = '';
    renderModalTreasuryTransactions();
    document.getElementById('treasury-modal').classList.remove('hidden');
}

function renderModalTreasuryTransactions() {
    const container = document.getElementById('modal-treasury-last-trans');
    container.innerHTML = '';
    [...window.AppState.treasury].slice(-3).reverse().forEach(t => {
        const origIdx = window.AppState.treasury.indexOf(t);
        const isPos = t.amount >= 0;
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-50 p-1.5 rounded text-[11px]';
        div.innerHTML = `<div><span class="text-gray-500">${t.date} (${t.note || 'Mozgás'})</span><span class="font-bold ml-1 ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span></div><button type="button" class="text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded bg-red-50 font-bold"><i class="fa-solid fa-trash text-[10px]"></i></button>`;
        div.querySelector('button').addEventListener('click', () => {
            window.AppState.treasury.splice(origIdx, 1);
            const { db, ref, set } = window.FB;
            set(ref(db, 'treasury'), window.AppState.treasury);
            renderModalTreasuryTransactions();
            showToast('Kassza mozgás törölve.');
        });
        container.appendChild(div);
    });
}

function closeTreasuryModal() { document.getElementById('treasury-modal').classList.add('hidden'); }
function saveTreasuryTransaction() {
    if (!window.AppState.isAdmin) return;
    const type = document.getElementById('treasury-trans-type').value;
    let amount = parseInt(document.getElementById('treasury-amount-input').value) || 0;
    const note = document.getElementById('treasury-note-input').value.trim() || (type === 'income' ? 'Bevétel' : 'Kiadás');
    if (amount <= 0) return showToast('Érvénytelen összeg!');
    if (type === 'expense') amount = -amount;

    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;
    const newTreasury = [...window.AppState.treasury, { amount, date: dateStr, type, note }];

    const { db, ref, set } = window.FB;
    set(ref(db, 'treasury'), newTreasury);
    closeTreasuryModal();
    showToast('Kassza mozgás rögzítve!');
}

function openEditMatchDateModal() {
    document.getElementById('modal-match-fee').value = window.AppState.nextMatch.courtFee || 18000;
    document.getElementById('modal-match-fee-person').value = window.AppState.nextMatch.feePerPerson || 1000;
    document.getElementById('modal-match-location').value = window.AppState.nextMatch.location || "ELTE Sport Kft Bogdánfy úti sporttelep";
    document.getElementById('edit-date-modal').classList.remove('hidden');
}
function closeEditMatchDateModal() { document.getElementById('edit-date-modal').classList.add('hidden'); }
function saveNextMatchDateModal() {
    const next = window.AppState.nextMatch;
    const dateVal = document.getElementById('modal-match-date').value;
    if (dateVal) next.date = dateVal.replace(/-/g, '. ') + '.';
    next.startTime = document.getElementById('modal-match-start').value || next.startTime;
    next.endTime = document.getElementById('modal-match-end').value || next.endTime;
    next.location = document.getElementById('modal-match-location').value.trim() || "ELTE Sport Kft Bogdánfy úti sporttelep";
    next.courtFee = parseInt(document.getElementById('modal-match-fee').value) || 18000;
    next.feePerPerson = parseInt(document.getElementById('modal-match-fee-person').value) || 1000;

    const { db, ref, set } = window.FB;
    set(ref(db, 'nextMatch'), next);
    closeEditMatchDateModal();
    showToast('Beállítások frissítve!');
}

function openMatchMode(matchIndex = null) {
    const state = window.AppState;
    if (!state.isAdmin) return;
    state.editingMatchIndex = matchIndex;
    state.isSwapModeActive = false;

    const swapToggleBtn = document.getElementById('toggle-swap-mode-btn');
    swapToggleBtn.className = 'px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition flex items-center space-x-1.5 border border-gray-200';

    document.getElementById('match-mode-section').classList.remove('hidden');
    document.getElementById('match-mode-date-label').innerText = `Dátum: ${matchIndex !== null ? state.matches[matchIndex].date : state.nextMatch.date}`;

    const teamAContainer = document.getElementById('team-a-players');
    const teamBContainer = document.getElementById('team-b-players');
    const teamASwaps = document.getElementById('team-a-swaps');
    const teamBSwaps = document.getElementById('team-b-swaps');

    teamAContainer.innerHTML = '';
    teamBContainer.innerHTML = '';
    teamASwaps.innerHTML = '';
    teamBSwaps.innerHTML = '';

    document.getElementById('team-a-swaps-wrapper').classList.add('hidden');
    document.getElementById('team-b-swaps-wrapper').classList.add('hidden');

    let starterList = [];
    let swapList = [];

    if (matchIndex !== null) {
        (state.matches[matchIndex].teamA || []).forEach(p => {
            const entry = { ...p, id: String(p.id || p.username || ''), team: 'A' };
            if (p.isSwapped) swapList.push(entry);
            else starterList.push(entry);
        });
        (state.matches[matchIndex].teamB || []).forEach(p => {
            const entry = { ...p, id: String(p.id || p.username || ''), team: 'B' };
            if (p.isSwapped) swapList.push(entry);
            else starterList.push(entry);
        });
    } else {
        starterList = Object.entries(state.nextMatch.attendances || {})
            .filter(([_, d]) => d.status === 'yes')
            .map(([uid, d], idx) => ({ id: String(uid), name: state.users[uid]?.name || d.name, team: idx % 2 === 0 ? 'A' : 'B', goals: 0, isSubstitute: d.isSubstitute === true, isSwapped: false }));
    }

    starterList.forEach(p => renderPlayerRow(p, teamAContainer, teamBContainer));

    if (swapList.length > 0) {
        state.isSwapModeActive = true;
        swapToggleBtn.className = 'px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition flex items-center space-x-1.5 shadow-sm';
        document.getElementById('team-a-swaps-wrapper').classList.remove('hidden');
        document.getElementById('team-b-swaps-wrapper').classList.remove('hidden');

        swapList.forEach(sp => {
            const sourceTeam = sp.team === 'A' ? 'B' : 'A';
            const sourceContainer = sourceTeam === 'A' ? teamAContainer : teamBContainer;
            const matchingStarterRow = Array.from(sourceContainer.querySelectorAll('.player-row')).find(
                r => r.dataset.userid === sp.id && r.dataset.name === sp.name
            );
            if (matchingStarterRow) {
                matchingStarterRow.dataset.swapped = 'true';
                const swapBtn = matchingStarterRow.querySelector('.btn-player-swap');
                if (swapBtn) {
                    swapBtn.classList.remove('hidden', 'bg-transparent', 'text-gray-500');
                    swapBtn.classList.add('bg-purple-600', 'text-white', 'border-purple-600');
                }
            }
            renderSwappedPlayerRow(sp);
        });
    }

    updateSwapButtonsVisibility();
    updateMatchScores();
}

function toggleSwapMode() {
    const state = window.AppState;
    state.isSwapModeActive = !state.isSwapModeActive;

    const swapToggleBtn = document.getElementById('toggle-swap-mode-btn');
    const wrapperA = document.getElementById('team-a-swaps-wrapper');
    const wrapperB = document.getElementById('team-b-swaps-wrapper');

    if (state.isSwapModeActive) {
        swapToggleBtn.className = 'px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition flex items-center space-x-1.5 shadow-sm';
        wrapperA.classList.remove('hidden');
        wrapperB.classList.remove('hidden');
    } else {
        swapToggleBtn.className = 'px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition flex items-center space-x-1.5 border border-gray-200';
        wrapperA.classList.add('hidden');
        wrapperB.classList.add('hidden');
        document.getElementById('team-a-swaps').innerHTML = '';
        document.getElementById('team-b-swaps').innerHTML = '';

        document.querySelectorAll('#team-a-players .player-row, #team-b-players .player-row').forEach(r => {
            r.dataset.swapped = 'false';
            const btn = r.querySelector('.btn-player-swap');
            if (btn) {
                btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-600');
                btn.classList.add('bg-transparent', 'text-gray-500', 'border-gray-200');
            }
        });
    }

    updateSwapButtonsVisibility();
    updateMatchScores();
}

function updateSwapButtonsVisibility() {
    const isActive = window.AppState.isSwapModeActive;
    document.querySelectorAll('.btn-player-swap').forEach(btn => {
        if (isActive) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    });
}

function renderPlayerRow(p, teamAContainer, teamBContainer) {
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between p-2 bg-white rounded-lg text-xs player-row border border-gray-200 shadow-2xs';
    el.dataset.userid = p.id || '';
    el.dataset.name = p.name;
    el.dataset.isSubstitute = p.isSubstitute ? 'true' : 'false';
    el.dataset.team = p.team;
    el.dataset.swapped = 'false';

    const updateRowLayout = () => {
        const isTeamA = el.dataset.team === 'A';
        const isSwapped = el.dataset.swapped === 'true';
        const goalsVal = el.querySelector('.player-goals') ? el.querySelector('.player-goals').innerText : (p.goals || 0);
        const swapBtnClasses = isSwapped
            ? 'btn-player-swap px-2 py-1 rounded border border-purple-600 bg-purple-600 text-white font-bold transition'
            : 'btn-player-swap px-2 py-1 rounded border border-gray-200 bg-transparent hover:bg-purple-50 text-gray-500 font-bold transition';

        el.innerHTML = `
            <div class="flex items-center space-x-1.5">
                <button type="button" class="${swapBtnClasses} ${window.AppState.isSwapModeActive ? '' : 'hidden'}" title="Átállt a másik csapatba meccs közben">
                    <i class="fa-solid fa-right-left"></i>
                </button>
                ${p.isSubstitute ? '<span class="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Beugró</span>' : ''}
                <span class="font-semibold text-gray-800">${window.formatHungarianName(p.name)}</span>
            </div>
            <div class="flex items-center space-x-2">
                <button type="button" class="btn-switch-team px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold transition" title="${isTeamA ? 'Áthelyezés a B csapatba' : 'Áthelyezés az A csapatba'}">
                    ${isTeamA ? '→' : '←'}
                </button>
                <div class="flex items-center border border-gray-200 rounded bg-white">
                    <button type="button" class="btn-minus px-2 py-0.5 text-gray-500 hover:bg-gray-100 font-bold">-</button>
                    <span class="player-goals px-2 font-bold text-gray-800">${goalsVal}</span>
                    <button type="button" class="btn-plus px-2 py-0.5 text-gray-500 hover:bg-gray-100 font-bold">+</button>
                </div>
            </div>
        `;

        el.querySelector('.btn-minus').addEventListener('click', (e) => {
            const s = e.target.parentElement.querySelector('.player-goals');
            s.innerText = Math.max(0, parseInt(s.innerText) - 1);
            updateMatchScores();
        });
        el.querySelector('.btn-plus').addEventListener('click', (e) => {
            const s = e.target.parentElement.querySelector('.player-goals');
            s.innerText = parseInt(s.innerText) + 1;
            updateMatchScores();
        });
        el.querySelector('.btn-switch-team').addEventListener('click', () => {
            if (el.dataset.swapped === 'true') {
                removeSwappedDuplicate(el.dataset.userid, el.dataset.name);
                el.dataset.swapped = 'false';
            }
            if (el.dataset.team === 'A') {
                el.dataset.team = 'B';
                teamBContainer.appendChild(el);
            } else {
                el.dataset.team = 'A';
                teamAContainer.appendChild(el);
            }
            updateRowLayout();
            updateMatchScores();
        });
        el.querySelector('.btn-player-swap').addEventListener('click', () => {
            if (el.dataset.swapped === 'true') {
                el.dataset.swapped = 'false';
                removeSwappedDuplicate(el.dataset.userid, el.dataset.name);
            } else {
                el.dataset.swapped = 'true';
                const targetTeam = el.dataset.team === 'A' ? 'B' : 'A';
                renderSwappedPlayerRow({
                    id: el.dataset.userid,
                    name: el.dataset.name,
                    isSubstitute: el.dataset.isSubstitute === 'true',
                    team: targetTeam,
                    goals: 0,
                    outcome: 'W'
                });
            }
            updateRowLayout();
            updateMatchScores();
        });
    };

    updateRowLayout();
    if (p.team === 'A') teamAContainer.appendChild(el);
    else teamBContainer.appendChild(el);
}

function removeSwappedDuplicate(userId, name) {
    document.querySelectorAll('#team-a-swaps .swap-player-row, #team-b-swaps .swap-player-row').forEach(r => {
        if (r.dataset.userid === userId && r.dataset.name === name) {
            r.remove();
        }
    });
}

function renderSwappedPlayerRow(sp) {
    const container = sp.team === 'A' ? document.getElementById('team-a-swaps') : document.getElementById('team-b-swaps');
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between p-2 bg-purple-50/60 rounded-lg text-xs swap-player-row border border-purple-200 shadow-2xs';
    el.dataset.userid = sp.id || '';
    el.dataset.name = sp.name;
    el.dataset.isSubstitute = sp.isSubstitute ? 'true' : 'false';
    el.dataset.team = sp.team;

    const currentOutcome = sp.outcome || 'W';

    el.innerHTML = `
        <div class="flex items-center space-x-1.5">
            <span class="text-purple-600"><i class="fa-solid fa-right-left text-[10px]"></i></span>
            <span class="font-semibold text-gray-800">${window.formatHungarianName(sp.name)}</span>
        </div>
        <div class="flex items-center space-x-2">
            <select class="swap-outcome-select px-1.5 py-0.5 rounded border border-purple-300 bg-white text-purple-800 font-bold text-[11px] focus:outline-none" title="Hogyan könyvelődjön a meccs a játékosnak?">
                <option value="W" ${currentOutcome === 'W' ? 'selected' : ''}>W (3p)</option>
                <option value="D" ${currentOutcome === 'D' ? 'selected' : ''}>D (1p)</option>
                <option value="L" ${currentOutcome === 'L' ? 'selected' : ''}>L (0p)</option>
            </select>
            <div class="flex items-center border border-gray-200 rounded bg-white">
                <button type="button" class="btn-minus px-2 py-0.5 text-gray-500 hover:bg-gray-100 font-bold">-</button>
                <span class="player-goals px-2 font-bold text-gray-800">${sp.goals || 0}</span>
                <button type="button" class="btn-plus px-2 py-0.5 text-gray-500 hover:bg-gray-100 font-bold">+</button>
            </div>
        </div>
    `;

    el.querySelector('.btn-minus').addEventListener('click', (e) => {
        const s = e.target.parentElement.querySelector('.player-goals');
        s.innerText = Math.max(0, parseInt(s.innerText) - 1);
        updateMatchScores();
    });
    el.querySelector('.btn-plus').addEventListener('click', (e) => {
        const s = e.target.parentElement.querySelector('.player-goals');
        s.innerText = parseInt(s.innerText) + 1;
        updateMatchScores();
    });

    container.appendChild(el);
}

function updateMatchScores() {
    let scoreA = 0, scoreB = 0;
    document.querySelectorAll('#team-a-players .player-row, #team-a-swaps .swap-player-row').forEach(r => {
        scoreA += parseInt(r.querySelector('.player-goals').innerText || 0);
    });
    document.querySelectorAll('#team-b-players .player-row, #team-b-swaps .swap-player-row').forEach(r => {
        scoreB += parseInt(r.querySelector('.player-goals').innerText || 0);
    });
    document.getElementById('team-a-score').innerText = scoreA;
    document.getElementById('team-b-score').innerText = scoreB;
}

function closeMatchMode() {
    document.getElementById('match-mode-section').classList.add('hidden');
    window.AppState.editingMatchIndex = null;
    window.AppState.isSwapModeActive = false;
}

function saveMatchResults() {
    const state = window.AppState;
    if (!state.isAdmin) return;

    const teamAEls = document.querySelectorAll('#team-a-players .player-row');
    const teamBEls = document.querySelectorAll('#team-b-players .player-row');
    if (teamAEls.length === 0 || teamBEls.length === 0) return showToast('Mindkét csapatban kell játékos!');

    if (state.editingMatchIndex === null) {
        const matchDateStr = state.nextMatch.date;
        const matchTimeStr = state.nextMatch.startTime || "00:00";
        
        const cleanDateStr = matchDateStr.replace(/\./g, '').trim().replace(/ /g, '-');
        const matchDateTimeString = `${cleanDateStr}T${matchTimeStr}:00`;
        const matchDateTime = new Date(matchDateTimeString);
        const now = new Date();

        if (matchDateTime > now) {
            showToast('Hiba: A meccs kezdési időpontja még nem telt el!');
            return;
        }
    }

    const teamA = [], teamB = [];
    let scoreA = 0, scoreB = 0;
    const participantIdsSet = new Set();

    const swappedOutcomes = {};
    document.querySelectorAll('#team-a-swaps .swap-player-row, #team-b-swaps .swap-player-row').forEach(r => {
        const uid = r.dataset.userid;
        const outcomeSelect = r.querySelector('.swap-outcome-select');
        if (uid && outcomeSelect) {
            swappedOutcomes[uid] = outcomeSelect.value;
        }
    });

    teamAEls.forEach(r => {
        const goals = parseInt(r.querySelector('.player-goals').innerText || 0);
        const isSub = r.dataset.isSubstitute === 'true';
        const uid = r.dataset.userid;
        const entry = { id: isSub ? '' : uid, name: r.dataset.name, goals, isSubstitute: isSub, isSwapped: false };
        if (!isSub && uid && swappedOutcomes[uid]) {
            entry.outcome = swappedOutcomes[uid];
        }
        teamA.push(entry);
        scoreA += goals;
        if (!isSub && uid) participantIdsSet.add(uid);
    });

    document.querySelectorAll('#team-a-swaps .swap-player-row').forEach(r => {
        const goals = parseInt(r.querySelector('.player-goals').innerText || 0);
        const isSub = r.dataset.isSubstitute === 'true';
        const uid = r.dataset.userid;
        const outcome = r.querySelector('.swap-outcome-select')?.value || 'W';
        teamA.push({ id: isSub ? '' : uid, name: r.dataset.name, goals, isSubstitute: isSub, isSwapped: true, outcome });
        scoreA += goals;
        if (!isSub && uid) participantIdsSet.add(uid);
    });

    teamBEls.forEach(r => {
        const goals = parseInt(r.querySelector('.player-goals').innerText || 0);
        const isSub = r.dataset.isSubstitute === 'true';
        const uid = r.dataset.userid;
        const entry = { id: isSub ? '' : uid, name: r.dataset.name, goals, isSubstitute: isSub, isSwapped: false };
        if (!isSub && uid && swappedOutcomes[uid]) {
            entry.outcome = swappedOutcomes[uid];
        }
        teamB.push(entry);
        scoreB += goals;
        if (!isSub && uid) participantIdsSet.add(uid);
    });

    document.querySelectorAll('#team-b-swaps .swap-player-row').forEach(r => {
        const goals = parseInt(r.querySelector('.player-goals').innerText || 0);
        const isSub = r.dataset.isSubstitute === 'true';
        const uid = r.dataset.userid;
        const outcome = r.querySelector('.swap-outcome-select')?.value || 'W';
        teamB.push({ id: isSub ? '' : uid, name: r.dataset.name, goals, isSubstitute: isSub, isSwapped: true, outcome });
        scoreB += goals;
        if (!isSub && uid) participantIdsSet.add(uid);
    });

    const matchRecord = { date: state.editingMatchIndex !== null ? state.matches[state.editingMatchIndex].date : state.nextMatch.date, scoreA, scoreB, teamA, teamB };
    const { db, ref, set } = window.FB;

    if (state.editingMatchIndex !== null) {
        state.matches[state.editingMatchIndex] = matchRecord;
    } else {
        state.matches.push(matchRecord);
        const feeDeduction = -(state.nextMatch.feePerPerson || 1000);
        participantIdsSet.forEach(uid => {
            const ut = state.transactions[uid] || [];
            ut.push({ amount: feeDeduction, date: matchRecord.date, type: 'match' });
            set(ref(db, `transactions/${uid}`), ut);
        });

        state.treasury.push({ amount: -(state.nextMatch.courtFee || 18000), date: matchRecord.date, type: 'expense', note: 'Pályadíj' });
        set(ref(db, 'treasury'), state.treasury);

        const dp = state.nextMatch.date.replace(/\./g, '').trim().split(' ');
        if (dp.length === 3) {
            const d = new Date(dp[0], dp[1] - 1, dp[2]);
            d.setDate(d.getDate() + 7);
            state.nextMatch.date = `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
            state.nextMatch.attendances = {};
            set(ref(db, 'nextMatch'), state.nextMatch);
        }
    }

    set(ref(db, 'matches'), state.matches);
    closeMatchMode();
    showToast('Meccs rögzítve!');
}

window.showToast = function(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'), 3000);
}
