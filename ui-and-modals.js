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
        state.users = snapshot.val() || {};
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
    });

    onValue(ref(db, 'treasury'), (snapshot) => {
        const val = snapshot.val();
        state.treasury = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        renderApp();
    });
}

function bindEvents() {
    document.getElementById('login-username').addEventListener('input', (e) => checkAdminUsername(e.target.value));
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('go-to-register').addEventListener('click', () => toggleAuthMode('register'));
    document.getElementById('go-to-login').addEventListener('click', () => toggleAuthMode('login'));
    document.getElementById('tri-slider').addEventListener('click', cycleAttendance);
    document.getElementById('user-note').addEventListener('change', (e) => saveAttendanceNote(e.target.value));
    document.getElementById('edit-next-match-btn').addEventListener('click', openEditMatchDateModal);
    document.getElementById('open-match-mode-btn').addEventListener('click', () => openMatchMode());
    document.getElementById('close-match-mode-btn').addEventListener('click', closeMatchMode);
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

    // Navigációs fülek
    document.getElementById('nav-tab-matches').addEventListener('click', () => switchTab('matches'));
    document.getElementById('nav-tab-finances').addEventListener('click', () => switchTab('finances'));
    document.getElementById('nav-tab-standings').addEventListener('click', () => switchTab('standings'));

    // Accordions
    document.getElementById('toggle-my-trans-btn').addEventListener('click', toggleMyTransAccordion);
    document.getElementById('toggle-treasury-btn').addEventListener('click', toggleTreasuryAccordion);

    // Player payment modal
    document.getElementById('close-payment-modal-btn').addEventListener('click', closePaymentModal);
    document.getElementById('save-payment-btn').addEventListener('click', savePayment);
    document.getElementById('btn-amount-minus').addEventListener('click', () => adjustModalAmount(-500));
    document.getElementById('btn-amount-plus').addEventListener('click', () => adjustModalAmount(500));

    // Treasury modal
    document.getElementById('open-treasury-modal-btn').addEventListener('click', openTreasuryModal);
    document.getElementById('close-treasury-modal-btn').addEventListener('click', closeTreasuryModal);
    document.getElementById('save-treasury-btn').addEventListener('click', saveTreasuryTransaction);

    // Edit Email modal
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

function toggleMyTransAccordion() {
    document.getElementById('my-transactions-container').classList.toggle('hidden');
    document.getElementById('my-trans-chevron').classList.toggle('rotate-180');
}

function toggleTreasuryAccordion() {
    document.getElementById('treasury-container').classList.toggle('hidden');
    document.getElementById('treasury-chevron').classList.toggle('rotate-180');
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

function checkAdminUsername(val) {
    const passContainer = document.getElementById('admin-pass-container');
    if (val.trim().toLowerCase() === 'admin') {
        passContainer.classList.remove('hidden');
    } else {
        passContainer.classList.add('hidden');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const state = window.AppState;
    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    const passInput = document.getElementById('login-password').value.trim();

    if (usernameInput === 'admin') {
        if (passInput === 'arsenal') {
            state.currentUser = { username: 'admin', name: 'Juhász Attila (Admin)', admin: true, email: 'juhatti@gmail.com' };
            state.isAdmin = true;
            saveSession();
        } else {
            showToast('Hibás adminisztrátori jelszó!');
        }
        return;
    }

    if (state.users[usernameInput]) {
        state.currentUser = state.users[usernameInput];
        state.isAdmin = state.currentUser.admin === true || state.currentUser.admin === 'yes' || state.currentUser.username === 'juhatti';
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

    if (state.users[username]) {
        showToast('Ez a felhasználónév már foglalt!');
        return;
    }

    const newUser = {
        username,
        name: `${lastName} ${firstName}`,
        email,
        admin: username === 'juhatti' ? 'yes' : 'no'
    };

    const { db, ref, set } = window.FB;
    set(ref(db, `users/${username}`), newUser);
    state.currentUser = newUser;
    state.isAdmin = username === 'juhatti';
    saveSession();
    toggleAuthMode('login');
    showToast('Sikeres regisztráció!');
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
            state.currentUser = parsed.user;
            state.isAdmin = parsed.isAdmin;
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
    if (mode === 'register') {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('register-section').classList.remove('hidden');
    } else {
        document.getElementById('register-section').classList.add('hidden');
        document.getElementById('auth-section').classList.remove('hidden');
    }
}

function openEditEmailModal() {
    const state = window.AppState;
    if (!state.currentUser || state.currentUser.username === 'admin') return;
    const parts = (state.currentUser.name || '').trim().split(/\s+/);
    document.getElementById('edit-lastname').value = parts[0] || '';
    document.getElementById('edit-firstname').value = parts.slice(1).join(' ') || '';
    document.getElementById('edit-email').value = state.currentUser.email || '';
    document.getElementById('edit-username').value = state.currentUser.username || '';
    document.getElementById('edit-email-modal').classList.remove('hidden');
}

function closeEditEmailModal() {
    document.getElementById('edit-email-modal').classList.add('hidden');
}

function saveEditedEmail(e) {
    e.preventDefault();
    const state = window.AppState;
    if (!state.currentUser) return;

    const newEmail = document.getElementById('edit-email').value.trim();
    if (!newEmail) {
        showToast('Kérlek add meg az email címet!');
        return;
    }

    state.currentUser.email = newEmail;
    state.users[state.currentUser.username].email = newEmail;

    const { db, ref, set } = window.FB;
    set(ref(db, `users/${state.currentUser.username}`), state.currentUser);
    saveSession();
    closeEditEmailModal();
    showToast('Email cím sikeresen frissítve!');
}

function cycleAttendance() {
    const state = window.AppState;
    if (!state.currentUser) return;
    const currentAtt = state.nextMatch.attendances[state.currentUser.username] || { status: 'maybe', note: '' };
    let nextStatus = currentAtt.status === 'maybe' ? 'yes' : currentAtt.status === 'yes' ? 'no' : 'maybe';
    updateAttendanceDB(state.currentUser.username, nextStatus, currentAtt.note);
}

function saveAttendanceNote(val) {
    const state = window.AppState;
    if (!state.currentUser) return;
    const currentAtt = state.nextMatch.attendances[state.currentUser.username] || { status: 'maybe', note: '' };
    updateAttendanceDB(state.currentUser.username, currentAtt.status, val.trim());
}

function updateAttendanceDB(username, status, note) {
    const state = window.AppState;
    const userData = state.users[username] || state.currentUser;
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${username}`), { status, note: note || '', name: userData.name });
    document.getElementById('attendance-msg').classList.remove('opacity-0');
}

function setUserStatusAdmin(username, statusVal) {
    const state = window.AppState;
    if (!state.isAdmin) return;
    const att = state.nextMatch.attendances[username] || { note: '', name: state.users[username]?.name || username };
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${username}`), { status: statusVal, note: att.note, name: att.name });
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
    }
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
    const myAtt = state.nextMatch.attendances[state.currentUser.username] || { status: 'maybe', note: '' };
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

    entries.forEach(([uname, att], idx) => {
        if (att.status === 'yes') yesCount++;
        const formattedName = window.formatHungarianName(att.name || uname);
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
            if (state.isAdmin) row.querySelector('.btn-del-sub').addEventListener('click', () => removeGeneralSubstitute(uname));
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
                row.querySelector('.btn-att-yes').addEventListener('click', () => setUserStatusAdmin(uname, 'yes'));
                row.querySelector('.btn-att-no').addEventListener('click', () => setUserStatusAdmin(uname, 'no'));
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
    set(ref(db, `nextMatch/attendances/${subKey}`), { status: 'yes', note: '', name: subName.trim(), isSubstitute: true });
    showToast('Beugró hozzáadva!');
}

function openAddPlayerModal() {
    const state = window.AppState;
    if (!state.isAdmin) return;
    
    const container = document.getElementById('add-player-modal-list');
    container.innerHTML = '';
    
    const currentAttendees = state.nextMatch.attendances || {};
    const unlistedUsers = Object.values(state.users).filter(u => !currentAttendees[u.username]);

    if (unlistedUsers.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Minden regisztrált játékos szerepel már a listán.</p>`;
    } else {
        unlistedUsers.forEach(u => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-gray-50 p-2 rounded-xl text-xs hover:bg-emerald-50 transition border border-gray-100';
            div.innerHTML = `
                <span class="font-semibold text-gray-800">${u.name}</span>
                <button type="button" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs">Hozzáadás</button>
            `;
            div.querySelector('button').addEventListener('click', () => {
                const { db, ref, set } = window.FB;
                set(ref(db, `nextMatch/attendances/${u.username}`), { status: 'yes', note: '', name: u.name });
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
        const teamAScorers = (m.teamA || []).filter(p => p.goals > 0).map(p => `${window.formatHungarianName(p.name)} <span class="bg-emerald-50 text-emerald-800 border px-1.5 py-0.5 rounded text-[10px] font-bold">${p.goals}</span>`).join(', ') || '-';
        const teamBScorers = (m.teamB || []).filter(p => p.goals > 0).map(p => `${window.formatHungarianName(p.name)} <span class="bg-indigo-50 text-indigo-800 border px-1.5 py-0.5 rounded text-[10px] font-bold">${p.goals}</span>`).join(', ') || '-';

        const card = document.createElement('div');
        card.className = 'bg-gray-50 border border-gray-100 p-4 rounded-xl text-center relative shadow-2xs';
        card.innerHTML = `
            ${state.isAdmin ? `<button class="btn-edit-match absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1.5"><i class="fa-solid fa-pen text-xs"></i></button>` : ''}
            <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">${m.date}</div>
            <div class="text-2xl font-black text-gray-800 my-1">${m.scoreA} : ${m.scoreB}</div>
            <div class="text-xs text-gray-500 mt-2 flex justify-between px-4 border-t pt-2">
                <span class="w-1/2 text-left pr-2 text-emerald-700 font-medium">${teamAScorers}</span>
                <span class="w-1/2 text-right pl-2 text-indigo-700 font-medium">${teamBScorers}</span>
            </div>
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

window.renderFinances = function() {
    const state = window.AppState;
    if (!state.currentUser) return;

    const balances = {};
    Object.keys(state.users).forEach(uname => {
        balances[uname] = (state.transactions[uname] || []).reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    });

    const myBal = balances[state.currentUser.username] || 0;
    const myBalBadge = document.getElementById('my-balance-badge');
    document.getElementById('my-balance-amount').innerText = `${myBal > 0 ? '+' : ''}${myBal.toLocaleString()} Ft`;
    myBalBadge.className = `px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs ${myBal >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`;

    const myTransList = document.getElementById('my-transactions-list');
    myTransList.innerHTML = '';
    (state.transactions[state.currentUser.username] || []).slice(-3).reverse().forEach(t => {
        const isPos = t.amount >= 0;
        const typeLabel = t.type === 'match' ? 'Meccs pályadíj' : t.type === 'initial' ? 'Kezdőegyenleg' : 'Befizetés';
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs';
        row.innerHTML = `<div><span class="font-semibold text-gray-800 block">${typeLabel}</span><span class="text-[10px] text-gray-400">${t.date}</span></div><span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${t.amount} Ft</span>`;
        myTransList.appendChild(row);
    });

    const adminFinSec = document.getElementById('admin-finances-container');
    if (state.isAdmin) {
        adminFinSec.classList.remove('hidden');
        const allBalList = document.getElementById('all-users-balances-list');
        allBalList.innerHTML = '';

        const allUsersArr = Object.values(state.users);
        allUsersArr.forEach(u => {
            const bal = balances[u.username] || 0;
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 hover:bg-purple-50/50 cursor-pointer border border-gray-100 transition text-xs';
            row.innerHTML = `<span class="font-semibold text-gray-800">${window.formatHungarianName(u.name)}</span><span class="font-bold px-2 py-0.5 rounded-md text-[11px] ${bal >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${bal >= 0 ? '+' : ''}${bal.toLocaleString()} Ft</span>`;
            row.addEventListener('click', () => openPaymentModal(u.username, u.name, bal));
            allBalList.appendChild(row);
        });
    } else {
        adminFinSec.classList.add('hidden');
    }

    const treasuryBal = state.treasury.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    document.getElementById('treasury-balance-amount').innerText = `${treasuryBal > 0 ? '+' : ''}${treasuryBal.toLocaleString()} Ft`;
    document.getElementById('treasury-balance-badge').className = `px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs ${treasuryBal >= 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`;

    const treasuryList = document.getElementById('treasury-transactions-list');
    treasuryList.innerHTML = '';
    [...state.treasury].slice(-3).reverse().forEach(t => {
        const isPos = t.amount >= 0;
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs';
        row.innerHTML = `<div><span class="font-semibold text-gray-800 block">${t.note || (t.type === 'income' ? 'Bevétel' : 'Kiadás')}</span><span class="text-[10px] text-gray-400">${t.date}</span></div><span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span>`;
        treasuryList.appendChild(row);
    });

    const treasuryModalBtn = document.getElementById('open-treasury-modal-btn');
    if (state.isAdmin) treasuryModalBtn.classList.remove('hidden');
    else treasuryModalBtn.classList.add('hidden');
}

function exportFinancesList() {
    const state = window.AppState;
    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

    let text = `Egyenlegek - ${dateStr}\n\n`;
    
    Object.values(state.users).forEach(u => {
        const bal = (state.transactions[u.username] || []).reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
        text += `${u.name}: ${bal >= 0 ? '+' : ''}${bal.toLocaleString()} Ft\n`;
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

function openPaymentModal(username, name, currentBal) {
    const state = window.AppState;
    if (!state.isAdmin) return;
    state.selectedPaymentUsername = username;
    document.getElementById('modal-user-name').innerText = window.formatHungarianName(name);
    document.getElementById('modal-user-balance').innerText = `${currentBal > 0 ? '+' : ''}${currentBal.toLocaleString()} Ft`;
    document.getElementById('modal-amount-input').value = 1000;
    renderModalPlayerTransactions();
    document.getElementById('payment-modal').classList.remove('hidden');
}

function renderModalPlayerTransactions() {
    const state = window.AppState;
    const container = document.getElementById('modal-user-last-trans');
    container.innerHTML = '';
    const userTrans = state.transactions[state.selectedPaymentUsername] || [];
    [...userTrans].slice(-3).reverse().forEach(t => {
        const origIdx = userTrans.indexOf(t);
        const isPos = t.amount >= 0;
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-50 p-1.5 rounded text-[11px]';
        div.innerHTML = `<div><span class="text-gray-500">${t.date}</span><span class="font-bold ml-1 ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${t.amount} Ft</span></div><button type="button" class="text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded bg-red-50 font-bold"><i class="fa-solid fa-trash text-[10px]"></i></button>`;
        div.querySelector('button').addEventListener('click', () => deletePlayerTransaction(origIdx));
        container.appendChild(div);
    });
}

function deletePlayerTransaction(idx) {
    const state = window.AppState;
    if (!confirm('Biztosan törlöd ezt a tranzakciót?')) return;
    const userTrans = state.transactions[state.selectedPaymentUsername] || [];
    userTrans.splice(idx, 1);
    const { db, ref, set } = window.FB;
    set(ref(db, `transactions/${state.selectedPaymentUsername}`), userTrans);
    document.getElementById('modal-user-balance').innerText = `${userTrans.reduce((s, t) => s + parseInt(t.amount || 0), 0)} Ft`;
    renderModalPlayerTransactions();
    showToast('Tranzakció törölve.');
}

function closePaymentModal() { document.getElementById('payment-modal').classList.add('hidden'); window.AppState.selectedPaymentUsername = null; }
function adjustModalAmount(delta) { const inp = document.getElementById('modal-amount-input'); inp.value = Math.max(500, (parseInt(inp.value) || 0) + delta); }

function savePayment() {
    const state = window.AppState;
    if (!state.isAdmin || !state.selectedPaymentUsername) return;
    const amount = parseInt(document.getElementById('modal-amount-input').value) || 0;
    const type = document.getElementById('modal-trans-type').value;
    if (amount <= 0) return showToast('Érvénytelen összeg!');
    
    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;
    const userTrans = state.transactions[state.selectedPaymentUsername] || [];
    userTrans.push({ amount, date: dateStr, type });

    const { db, ref, set } = window.FB;
    set(ref(db, `transactions/${state.selectedPaymentUsername}`), userTrans);
    closePaymentModal();
    showToast('Befizetés rögzítve!');
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
    document.getElementById('match-mode-section').classList.remove('hidden');
    document.getElementById('match-mode-date-label').innerText = `Dátum: ${matchIndex !== null ? state.matches[matchIndex].date : state.nextMatch.date}`;

    const teamAPaid = document.getElementById('team-a-players');
    const teamBPaid = document.getElementById('team-b-players');
    teamAPaid.innerHTML = ''; teamBPaid.innerHTML = '';

    let activeList = [];
    if (matchIndex !== null) {
        (state.matches[matchIndex].teamA || []).forEach(p => activeList.push({ ...p, team: 'A' }));
        (state.matches[matchIndex].teamB || []).forEach(p => activeList.push({ ...p, team: 'B' }));
    } else {
        activeList = Object.entries(state.nextMatch.attendances || {})
            .filter(([_, d]) => d.status === 'yes')
            .map(([uname, d], idx) => ({ username: uname, name: d.name, team: idx % 2 === 0 ? 'A' : 'B', goals: 0, isSubstitute: d.isSubstitute === true }));
    }

    activeList.forEach(p => renderPlayerRow(p, teamAPaid, teamBPaid));
    updateMatchScores();
}

function renderPlayerRow(p, teamAContainer, teamBContainer) {
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between p-2 bg-white rounded-lg text-xs player-row border border-gray-200 shadow-2xs';
    el.dataset.username = p.username || '';
    el.dataset.name = p.name;
    el.dataset.isSubstitute = p.isSubstitute ? 'true' : 'false';

    el.innerHTML = `
        <div class="flex items-center space-x-1.5">
            ${p.isSubstitute ? '<span class="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Beugró</span>' : ''}
            <span class="font-semibold text-gray-800">${window.formatHungarianName(p.name)}</span>
        </div>
        <div class="flex items-center space-x-2">
            <select class="team-select bg-gray-50 text-xs rounded border border-gray-200 px-2 py-1 font-medium">
                <option value="A" ${p.team === 'A' ? 'selected' : ''}>A Csapat</option>
                <option value="B" ${p.team === 'B' ? 'selected' : ''}>B Csapat</option>
            </select>
            <div class="flex items-center border border-gray-200 rounded bg-white">
                <button type="button" class="btn-minus px-2 py-0.5 text-gray-500 hover:bg-gray-100 font-bold">-</button>
                <span class="player-goals px-2 font-bold text-gray-800">${p.goals || 0}</span>
                <button type="button" class="btn-plus px-2 py-0.5 text-gray-500 hover:bg-gray-100 font-bold">+</button>
            </div>
        </div>
    `;

    el.querySelector('.btn-minus').addEventListener('click', (e) => { const s = e.target.parentElement.querySelector('.player-goals'); s.innerText = Math.max(0, parseInt(s.innerText) - 1); updateMatchScores(); });
    el.querySelector('.btn-plus').addEventListener('click', (e) => { const s = e.target.parentElement.querySelector('.player-goals'); s.innerText = parseInt(s.innerText) + 1; updateMatchScores(); });
    
    el.querySelector('.team-select').addEventListener('change', (e) => {
        if (e.target.value === 'A') teamAContainer.appendChild(el);
        else teamBContainer.appendChild(el);
        updateMatchScores();
    });

    if (p.team === 'A') teamAContainer.appendChild(el);
    else teamBContainer.appendChild(el);
}

function updateMatchScores() {
    let scoreA = 0, scoreB = 0;
    document.querySelectorAll('#team-a-players .player-row').forEach(r => scoreA += parseInt(r.querySelector('.player-goals').innerText || 0));
    document.querySelectorAll('#team-b-players .player-row').forEach(r => scoreB += parseInt(r.querySelector('.player-goals').innerText || 0));
    document.getElementById('team-a-score').innerText = scoreA;
    document.getElementById('team-b-score').innerText = scoreB;
}

function closeMatchMode() { document.getElementById('match-mode-section').classList.add('hidden'); window.AppState.editingMatchIndex = null; }

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
    const participantsUsernames = [];

    teamAEls.forEach(r => {
        const goals = parseInt(r.querySelector('.player-goals').innerText || 0);
        const isSub = r.dataset.isSubstitute === 'true';
        const uname = r.dataset.username;
        teamA.push({ username: isSub ? '' : uname, name: r.dataset.name, goals, isSubstitute: isSub });
        scoreA += goals;
        if (!isSub && uname) participantsUsernames.push(uname);
    });

    teamBEls.forEach(r => {
        const goals = parseInt(r.querySelector('.player-goals').innerText || 0);
        const isSub = r.dataset.isSubstitute === 'true';
        const uname = r.dataset.username;
        teamB.push({ username: isSub ? '' : uname, name: r.dataset.name, goals, isSubstitute: isSub });
        scoreB += goals;
        if (!isSub && uname) participantsUsernames.push(uname);
    });

    const matchRecord = { date: state.editingMatchIndex !== null ? state.matches[state.editingMatchIndex].date : state.nextMatch.date, scoreA, scoreB, teamA, teamB };
    const { db, ref, set } = window.FB;

    if (state.editingMatchIndex !== null) {
        state.matches[state.editingMatchIndex] = matchRecord;
    } else {
        state.matches.push(matchRecord);
        const feeDeduction = -(state.nextMatch.feePerPerson || 1000);
        participantsUsernames.forEach(uname => {
            const ut = state.transactions[uname] || [];
            ut.push({ amount: feeDeduction, date: matchRecord.date, type: 'match' });
            set(ref(db, `transactions/${uname}`), ut);
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