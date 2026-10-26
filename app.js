let currentUser = null;
let isAdmin = false;
let users = {};
let nextMatch = { date: "2026. 10. 27.", startTime: "09:00", endTime: "10:00", courtFee: 18000, feePerPerson: 1000, attendances: {} };
let matches = [];
let transactions = {};
let treasury = [];
let editingMatchIndex = null;
let currentMatchPage = 0;
let selectedYear = 2026;
let selectedPaymentUsername = null;

window.addEventListener('DOMContentLoaded', () => {
    initFirebaseListeners();
    bindEvents();
    checkAutoLogin();
});

function initFirebaseListeners() {
    if (!window.FB) return;
    const { db, ref, onValue } = window.FB;

    onValue(ref(db, 'users'), (snapshot) => {
        users = snapshot.val() || {};
        renderApp();
    });

    onValue(ref(db, 'nextMatch'), (snapshot) => {
        const val = snapshot.val();
        if (val) {
            nextMatch = val;
            if (!nextMatch.attendances) nextMatch.attendances = {};
            if (!nextMatch.courtFee) nextMatch.courtFee = 18000;
            if (!nextMatch.feePerPerson) nextMatch.feePerPerson = 1000;
        }
        renderApp();
    });

    onValue(ref(db, 'matches'), (snapshot) => {
        const val = snapshot.val();
        matches = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        renderApp();
    });

    onValue(ref(db, 'transactions'), (snapshot) => {
        transactions = snapshot.val() || {};
        renderApp();
    });

    onValue(ref(db, 'treasury'), (snapshot) => {
        const val = snapshot.val();
        treasury = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
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
    document.getElementById('save-match-results-btn').addEventListener('click', saveMatchResults);
    document.getElementById('prev-match-btn').addEventListener('click', prevMatchPage);
    document.getElementById('next-match-btn').addEventListener('click', nextMatchPage);
    document.getElementById('close-date-modal-btn').addEventListener('click', closeEditMatchDateModal);
    document.getElementById('save-date-modal-btn').addEventListener('click', saveNextMatchDateModal);

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

function toggleMyTransAccordion() {
    const container = document.getElementById('my-transactions-container');
    const chevron = document.getElementById('my-trans-chevron');
    container.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
}

function toggleTreasuryAccordion() {
    const container = document.getElementById('treasury-container');
    const chevron = document.getElementById('treasury-chevron');
    container.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
}

window.selectYear = function(year) {
    selectedYear = year;
    document.getElementById('selected-year-label').innerText = year;
    document.getElementById('year-dropdown-menu').classList.add('hidden');
    renderStandings();
}

function formatHungarianName(fullName) {
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
    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    const passInput = document.getElementById('login-password').value.trim();

    if (usernameInput === 'admin') {
        if (passInput === 'arsenal') {
            currentUser = { username: 'admin', name: 'Juhász Attila (Admin)', admin: true, email: 'juhatti@gmail.com' };
            isAdmin = true;
            saveSession();
        } else {
            showToast('Hibás adminisztrátori jelszó!');
        }
        return;
    }

    if (users[usernameInput]) {
        currentUser = users[usernameInput];
        isAdmin = currentUser.admin === true || currentUser.admin === 'yes' || currentUser.username === 'juhatti';
        saveSession();
    } else {
        showToast('Nem található ilyen felhasználónév!');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const lastName = document.getElementById('reg-lastname').value.trim();
    const firstName = document.getElementById('reg-firstname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();

    if (users[username]) {
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
    currentUser = newUser;
    isAdmin = username === 'juhatti';
    saveSession();
    toggleAuthMode('login');
    showToast('Sikeres regisztráció!');
}

function saveSession() {
    localStorage.setItem('flex_foci_user', JSON.stringify({ user: currentUser, isAdmin }));
    renderApp();
    showToast(`Üdvözlünk, ${currentUser.name}!`);
}

function checkAutoLogin() {
    const saved = localStorage.getItem('flex_foci_user');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            currentUser = parsed.user;
            isAdmin = parsed.isAdmin;
        } catch(e) {
            localStorage.removeItem('flex_foci_user');
        }
    }
    renderApp();
}

function logout() {
    currentUser = null;
    isAdmin = false;
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
    if (!currentUser || currentUser.username === 'admin') return;
    const parts = (currentUser.name || '').trim().split(/\s+/);
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';

    document.getElementById('edit-lastname').value = lastName;
    document.getElementById('edit-firstname').value = firstName;
    document.getElementById('edit-email').value = currentUser.email || '';
    document.getElementById('edit-username').value = currentUser.username || '';
    document.getElementById('edit-email-modal').classList.remove('hidden');
}

function closeEditEmailModal() {
    document.getElementById('edit-email-modal').classList.add('hidden');
}

function saveEditedEmail(e) {
    e.preventDefault();
    if (!currentUser) return;

    const newEmail = document.getElementById('edit-email').value.trim();
    if (!newEmail) {
        showToast('Kérlek add meg az email címet!');
        return;
    }

    currentUser.email = newEmail;
    users[currentUser.username].email = newEmail;

    const { db, ref, set } = window.FB;
    set(ref(db, `users/${currentUser.username}`), currentUser);
    saveSession();
    closeEditEmailModal();
    showToast('Email cím sikeresen frissítve!');
}

function cycleAttendance() {
    if (!currentUser) return;
    const currentAtt = nextMatch.attendances[currentUser.username] || { status: 'maybe', note: '' };
    let nextStatus = 'maybe';
    if (currentAtt.status === 'maybe') nextStatus = 'yes';
    else if (currentAtt.status === 'yes') nextStatus = 'no';
    else nextStatus = 'maybe';

    updateAttendanceDB(currentUser.username, nextStatus, currentAtt.note);
}

function saveAttendanceNote(val) {
    if (!currentUser) return;
    const currentAtt = nextMatch.attendances[currentUser.username] || { status: 'maybe', note: '' };
    updateAttendanceDB(currentUser.username, currentAtt.status, val.trim());
}

function updateAttendanceDB(username, status, note) {
    const userData = users[username] || currentUser;
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${username}`), {
        status: status,
        note: note || '',
        name: userData.name
    });
    document.getElementById('attendance-msg').classList.remove('opacity-0');
}

function setUserStatusAdmin(username, statusVal) {
    if (!isAdmin) return;
    const att = nextMatch.attendances[username] || { note: '', name: users[username]?.name || username };
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${username}`), {
        status: statusVal,
        note: att.note,
        name: att.name
    });
}

function renderApp() {
    const authSec = document.getElementById('auth-section');
    const dashSec = document.getElementById('dashboard-section');
    const userHeader = document.getElementById('user-header-info');
    const adminBadge = document.getElementById('admin-badge');
    const adminControls = document.getElementById('admin-controls');
    const editMatchBtn = document.getElementById('edit-next-match-btn');

    if (currentUser) {
        authSec.classList.add('hidden');
        document.getElementById('register-section').classList.add('hidden');
        dashSec.classList.remove('hidden');
        userHeader.classList.remove('hidden');
        
        document.getElementById('logged-user-name').innerText = currentUser.name;
        if (isAdmin) {
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
        renderStandings();
    } else {
        dashSec.classList.add('hidden');
        userHeader.classList.add('hidden');
        authSec.classList.remove('hidden');
    }
}

function renderNextMatchCard() {
    document.getElementById('next-match-date-display').innerText = `${nextMatch.date} ${nextMatch.startTime} - ${nextMatch.endTime}`;
    
    const fee = nextMatch.courtFee || 18000;
    const perPerson = nextMatch.feePerPerson || 1000;
    document.getElementById('next-match-fee-info').innerHTML = `
        <span>${fee.toLocaleString()} Ft</span>
        <span>•</span>
        <span><i class="fa-solid fa-user text-gray-300 mr-0.5"></i> ${perPerson.toLocaleString()} Ft / fő</span>
    `;

    if (!currentUser) return;
    const myAtt = nextMatch.attendances[currentUser.username] || { status: 'maybe', note: '' };
    const thumb = document.getElementById('slider-thumb');
    const noteInput = document.getElementById('user-note');

    thumb.className = 'tri-slider-thumb';
    if (myAtt.status === 'no') thumb.classList.add('pos-left');
    else if (myAtt.status === 'maybe') thumb.classList.add('pos-mid');
    else if (myAtt.status === 'yes') thumb.classList.add('pos-right');

    noteInput.value = myAtt.note || '';
}

function renderAttendeesList() {
    const container = document.getElementById('attendees-list');
    container.innerHTML = '';

    let yesCount = 0;
    const entries = Object.entries(nextMatch.attendances || {});

    entries.forEach(([uname, att], idx) => {
        if (att.status === 'yes') yesCount++;
        const formattedName = formatHungarianName(att.name || uname);
        const isSub = att.isSubstitute === true;

        let iconHtml = '';
        if (att.status === 'yes') {
            iconHtml = `<span class="text-emerald-500 bg-emerald-50 p-1.5 rounded-lg"><i class="fa-solid fa-square-check"></i></span>`;
        } else if (att.status === 'no') {
            iconHtml = `<span class="text-red-500 bg-red-50 p-1.5 rounded-lg"><i class="fa-solid fa-square-xmark"></i></span>`;
        } else {
            iconHtml = `<span class="text-amber-500 bg-amber-50 p-1.5 rounded-lg"><i class="fa-solid fa-circle-question"></i></span>`;
        }

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
                    ${isAdmin ? `<button class="btn-del-sub text-xs px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg transition" title="Beugró törlése"><i class="fa-solid fa-trash mr-1"></i> Törlés</button>` : ''}
                    <span class="text-emerald-500 bg-emerald-50 p-1.5 rounded-lg"><i class="fa-solid fa-square-check"></i></span>
                </div>
            `;
            if (isAdmin) {
                row.querySelector('.btn-del-sub').addEventListener('click', () => removeGeneralSubstitute(uname));
            }
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
                    ${isAdmin ? `
                        <button class="btn-att-yes text-xs px-2 py-1 rounded ${att.status === 'yes' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}">✓</button>
                        <button class="btn-att-no text-xs px-2 py-1 rounded ${att.status === 'no' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}">✕</button>
                    ` : ''}
                    ${iconHtml}
                </div>
            `;
            if (isAdmin) {
                row.querySelector('.btn-att-yes').addEventListener('click', () => setUserStatusAdmin(uname, 'yes'));
                row.querySelector('.btn-att-no').addEventListener('click', () => setUserStatusAdmin(uname, 'no'));
            }
        }

        container.appendChild(row);
    });

    const badgeContainer = document.getElementById('attending-badge-container');
    document.getElementById('attending-count').innerText = yesCount;
    if (yesCount < 8) {
        badgeContainer.className = 'border rounded-xl px-4 py-2 text-center transition-colors bg-red-50 border-red-100 text-red-700';
    } else if (yesCount <= 9) {
        badgeContainer.className = 'border rounded-xl px-4 py-2 text-center transition-colors bg-amber-50 border-amber-100 text-amber-700';
    } else {
        badgeContainer.className = 'border rounded-xl px-4 py-2 text-center transition-colors bg-emerald-50 border-emerald-100 text-emerald-700';
    }
}

function addGeneralSubstitute() {
    const subName = prompt('Add meg a beugró nevét:', 'Beugró Játékos');
    if (!subName || !subName.trim()) return;

    const subKey = 'sub_' + Date.now();
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${subKey}`), {
        status: 'yes',
        note: '',
        name: subName.trim(),
        isSubstitute: true
    });
    showToast('Beugró hozzáadva a jelentkezőkhöz!');
}

function removeGeneralSubstitute(subKey) {
    if (!confirm('Biztosan törlöd ezt a beugrót?')) return;
    const { db, ref, set } = window.FB;
    set(ref(db, `nextMatch/attendances/${subKey}`), null);
    showToast('Beugró törölve.');
}

function renderLastMatches() {
    const container = document.getElementById('last-matches-container');
    const paginationContainer = document.getElementById('match-pagination');
    container.innerHTML = '';

    const reversedMatches = [...matches].reverse();
    const pageSize = 3;
    const totalPages = Math.ceil(reversedMatches.length / pageSize) || 1;

    if (currentMatchPage >= totalPages) currentMatchPage = totalPages - 1;
    if (currentMatchPage < 0) currentMatchPage = 0;

    const startIdx = currentMatchPage * pageSize;
    const pageMatches = reversedMatches.slice(startIdx, startIdx + pageSize);

    if (reversedMatches.length > pageSize) {
        paginationContainer.classList.remove('hidden');
        document.getElementById('match-page-indicator').innerText = `${currentMatchPage + 1} / ${totalPages}`;
        document.getElementById('prev-match-btn').disabled = currentMatchPage === 0;
        document.getElementById('next-match-btn').disabled = currentMatchPage >= totalPages - 1;
    } else {
        paginationContainer.classList.add('hidden');
    }

    if (pageMatches.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Még nincsenek rögzített meccsek.</p>`;
        return;
    }

    pageMatches.forEach((m) => {
        const actualIndex = matches.indexOf(m);
        const teamAScorers = (m.teamA || []).filter(p => p.goals > 0).map(p => `${formatHungarianName(p.name)} <span class="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">${p.goals}</span>`).join(', ') || '-';
        const teamBScorers = (m.teamB || []).filter(p => p.goals > 0).map(p => `${formatHungarianName(p.name)} <span class="bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold">${p.goals}</span>`).join(', ') || '-';

        const card = document.createElement('div');
        card.className = 'bg-gray-50 border border-gray-100 p-4 rounded-xl text-center relative shadow-2xs';
        card.innerHTML = `
            ${isAdmin ? `<button class="btn-edit-match absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1.5" title="Múltbéli meccs szerkesztése"><i class="fa-solid fa-pen text-xs"></i></button>` : ''}
            <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">${m.date}</div>
            <div class="text-2xl font-black text-gray-800 my-1">${m.scoreA} : ${m.scoreB}</div>
            <div class="text-xs text-gray-500 mt-2 flex justify-between px-4 border-t border-gray-200/60 pt-2">
                <span class="w-1/2 text-left pr-2 text-emerald-700 font-medium">${teamAScorers}</span>
                <span class="w-1/2 text-right pl-2 text-indigo-700 font-medium">${teamBScorers}</span>
            </div>
        `;

        if (isAdmin) {
            card.querySelector('.btn-edit-match').addEventListener('click', () => openMatchMode(actualIndex));
        }

        container.appendChild(card);
    });
}

function prevMatchPage() {
    if (currentMatchPage > 0) {
        currentMatchPage--;
        renderLastMatches();
    }
}

function nextMatchPage() {
    const pageSize = 3;
    const totalPages = Math.ceil(matches.length / pageSize);
    if (currentMatchPage < totalPages - 1) {
        currentMatchPage++;
        renderLastMatches();
    }
}

// PÉNZÜGYEK & KASSZA RENDERELÉSE
function renderFinances() {
    if (!currentUser) return;

    const balances = {};
    Object.keys(users).forEach(uname => {
        const userTrans = transactions[uname] || [];
        balances[uname] = userTrans.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    });

    const myBal = balances[currentUser.username] || 0;
    const myBalBadge = document.getElementById('my-balance-badge');
    const myBalAmount = document.getElementById('my-balance-amount');

    myBalAmount.innerText = `${myBal > 0 ? '+' : ''}${myBal.toLocaleString()} Ft`;
    if (myBal >= 0) {
        myBalBadge.className = 'px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs bg-emerald-50 border-emerald-200 text-emerald-800';
    } else {
        myBalBadge.className = 'px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs bg-red-50 border-red-200 text-red-800';
    }

    const myTransList = document.getElementById('my-transactions-list');
    myTransList.innerHTML = '';
    const myUserTrans = (transactions[currentUser.username] || []).slice(-3).reverse();

    if (myUserTrans.length === 0) {
        myTransList.innerHTML = `<p class="text-xs text-gray-400 py-2">Még nincs tranzakciód.</p>`;
    } else {
        myUserTrans.forEach(t => {
            const isPos = t.amount >= 0;
            let typeLabel = 'Befizetés';
            if (t.type === 'match') typeLabel = 'Meccs pályadíj';
            else if (t.type === 'initial') typeLabel = 'Kezdőegyenleg';

            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs';
            row.innerHTML = `
                <div>
                    <span class="font-semibold text-gray-800 block">${typeLabel}</span>
                    <span class="text-[10px] text-gray-400">${t.date}</span>
                </div>
                <span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${t.amount} Ft</span>
            `;
            myTransList.appendChild(row);
        });
    }

    // Admin játékos névsora
    const adminFinSec = document.getElementById('admin-finances-container');
    if (isAdmin) {
        adminFinSec.classList.remove('hidden');
        const allBalList = document.getElementById('all-users-balances-list');
        allBalList.innerHTML = '';

        const lastMatch = matches.length > 0 ? matches[matches.length - 1] : null;
        const recentUsernames = new Set();
        if (lastMatch) {
            (lastMatch.teamA || []).forEach(p => { if (p.username) recentUsernames.add(p.username); });
            (lastMatch.teamB || []).forEach(p => { if (p.username) recentUsernames.add(p.username); });
        }

        const allUsersArr = Object.values(users);
        const recentUsers = allUsersArr.filter(u => recentUsernames.has(u.username));
        const otherUsers = allUsersArr.filter(u => !recentUsernames.has(u.username));

        const renderUserRow = (u) => {
            const bal = balances[u.username] || 0;
            const isPos = bal >= 0;
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 hover:bg-purple-50/50 cursor-pointer border border-gray-100 transition text-xs';
            row.innerHTML = `
                <span class="font-semibold text-gray-800">${formatHungarianName(u.name)}</span>
                <span class="font-bold px-2 py-0.5 rounded-md text-[11px] ${isPos ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                    ${isPos ? '+' : ''}${bal.toLocaleString()} Ft
                </span>
            `;
            row.addEventListener('click', () => openPaymentModal(u.username, u.name, bal));
            allBalList.appendChild(row);
        };

        if (recentUsers.length > 0) {
            recentUsers.forEach(renderUserRow);
        }

        if (recentUsers.length > 0 && otherUsers.length > 0) {
            const hr = document.createElement('hr');
            hr.className = 'my-2 border-gray-200';
            allBalList.appendChild(hr);
        }

        if (otherUsers.length > 0) {
            otherUsers.forEach(renderUserRow);
        }
    } else {
        adminFinSec.classList.add('hidden');
    }

    // Csapatkassza Szekció
    const treasuryBal = treasury.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    const treasuryBadge = document.getElementById('treasury-balance-badge');
    const treasuryAmount = document.getElementById('treasury-balance-amount');

    treasuryAmount.innerText = `${treasuryBal > 0 ? '+' : ''}${treasuryBal.toLocaleString()} Ft`;
    if (treasuryBal >= 0) {
        treasuryBadge.className = 'px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs bg-amber-50 border-amber-200 text-amber-800';
    } else {
        treasuryBadge.className = 'px-4 py-2 rounded-xl text-center border font-bold text-sm shadow-2xs bg-red-50 border-red-200 text-red-800';
    }

    const treasuryList = document.getElementById('treasury-transactions-list');
    treasuryList.innerHTML = '';
    const lastTreasury = [...treasury].slice(-3).reverse();

    const treasuryModalBtn = document.getElementById('open-treasury-modal-btn');
    if (isAdmin) {
        treasuryModalBtn.classList.remove('hidden');
    } else {
        treasuryModalBtn.classList.add('hidden');
    }

    if (lastTreasury.length === 0) {
        treasuryList.innerHTML = `<p class="text-xs text-gray-400 py-2">Még nincs kassza mozgás.</p>`;
    } else {
        lastTreasury.forEach(t => {
            const isPos = t.amount >= 0;
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs';
            row.innerHTML = `
                <div>
                    <span class="font-semibold text-gray-800 block">${t.note || (t.type === 'income' ? 'Bevétel' : 'Kiadás')}</span>
                    <span class="text-[10px] text-gray-400">${t.date}</span>
                </div>
                <span class="font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span>
            `;
            treasuryList.appendChild(row);
        });
    }
}

// MODALOK & TÖRLÉSEK KEZELÉSE
function openPaymentModal(username, name, currentBal) {
    if (!isAdmin) return;
    selectedPaymentUsername = username;
    document.getElementById('modal-user-name').innerText = formatHungarianName(name);
    document.getElementById('modal-user-balance').innerText = `${currentBal > 0 ? '+' : ''}${currentBal.toLocaleString()} Ft`;
    document.getElementById('modal-amount-input').value = 1000;
    document.getElementById('modal-trans-type').value = 'payment';

    renderModalPlayerTransactions();
    document.getElementById('payment-modal').classList.remove('hidden');
}

function renderModalPlayerTransactions() {
    const lastTransContainer = document.getElementById('modal-user-last-trans');
    lastTransContainer.innerHTML = '';
    const userTrans = transactions[selectedPaymentUsername] || [];
    const last3 = [...userTrans].slice(-3).reverse();

    if (last3.length === 0) {
        lastTransContainer.innerHTML = `<span class="text-[11px] text-gray-400 italic">Nincs még tranzakció.</span>`;
        return;
    }

    last3.forEach((t) => {
        const originalIndex = userTrans.indexOf(t);
        const isPos = t.amount >= 0;
        let typeLabel = 'Befizetés';
        if (t.type === 'match') typeLabel = 'Meccs';
        else if (t.type === 'initial') typeLabel = 'Kezdő';

        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-50 p-1.5 rounded text-[11px]';
        div.innerHTML = `
            <div>
                <span class="text-gray-500">${t.date} (${typeLabel})</span>
                <span class="font-bold ml-1 ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${t.amount} Ft</span>
            </div>
            <button type="button" class="btn-del-player-trans text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded bg-red-50 font-bold" title="Tranzakció törlése">
                <i class="fa-solid fa-trash text-[10px]"></i>
            </button>
        `;

        div.querySelector('.btn-del-player-trans').addEventListener('click', () => {
            deletePlayerTransaction(originalIndex);
        });

        lastTransContainer.appendChild(div);
    });
}

function deletePlayerTransaction(index) {
    if (!confirm('Biztosan törlöd ezt a tranzakciót?')) return;
    const userTrans = transactions[selectedPaymentUsername] || [];
    userTrans.splice(index, 1);
    transactions[selectedPaymentUsername] = userTrans;

    const { db, ref, set } = window.FB;
    set(ref(db, `transactions/${selectedPaymentUsername}`), userTrans);
    
    // Frissítjük a modal egyenleget és listát
    const newBal = userTrans.reduce((sum, t) => sum + parseInt(t.amount || 0), 0);
    document.getElementById('modal-user-balance').innerText = `${newBal > 0 ? '+' : ''}${newBal.toLocaleString()} Ft`;
    renderModalPlayerTransactions();
    showToast('Tranzakció törölve.');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
    selectedPaymentUsername = null;
}

function adjustModalAmount(delta) {
    const input = document.getElementById('modal-amount-input');
    let val = parseInt(input.value) || 0;
    val = Math.max(500, val + delta);
    input.value = val;
}

function savePayment() {
    if (!isAdmin || !selectedPaymentUsername) return;

    const amount = parseInt(document.getElementById('modal-amount-input').value) || 0;
    const type = document.getElementById('modal-trans-type').value;

    if (amount <= 0) {
        showToast('Kérlek adj meg egy érvényes összeget!');
        return;
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

    const userTrans = transactions[selectedPaymentUsername] || [];
    userTrans.push({
        amount: amount,
        date: dateStr,
        type: type
    });

    const { db, ref, set } = window.FB;
    set(ref(db, `transactions/${selectedPaymentUsername}`), userTrans);
    closePaymentModal();
    showToast('Befizetés sikeresen rögzítve!');
}

function openTreasuryModal() {
    if (!isAdmin) return;
    document.getElementById('treasury-amount-input').value = 10000;
    document.getElementById('treasury-note-input').value = '';
    document.getElementById('treasury-trans-type').value = 'income';
    
    renderModalTreasuryTransactions();
    document.getElementById('treasury-modal').classList.remove('hidden');
}

function renderModalTreasuryTransactions() {
    const lastTransContainer = document.getElementById('modal-treasury-last-trans');
    lastTransContainer.innerHTML = '';
    const last3 = [...treasury].slice(-3).reverse();

    if (last3.length === 0) {
        lastTransContainer.innerHTML = `<span class="text-[11px] text-gray-400 italic">Nincs még kassza mozgás.</span>`;
        return;
    }

    last3.forEach((t) => {
        const originalIndex = treasury.indexOf(t);
        const isPos = t.amount >= 0;

        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-50 p-1.5 rounded text-[11px]';
        div.innerHTML = `
            <div>
                <span class="text-gray-500">${t.date} (${t.note || 'Mozgás'})</span>
                <span class="font-bold ml-1 ${isPos ? 'text-emerald-600' : 'text-red-600'}">${isPos ? '+' : ''}${parseInt(t.amount).toLocaleString()} Ft</span>
            </div>
            <button type="button" class="btn-del-treasury-trans text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded bg-red-50 font-bold" title="Mozgás törlése">
                <i class="fa-solid fa-trash text-[10px]"></i>
            </button>
        `;

        div.querySelector('.btn-del-treasury-trans').addEventListener('click', () => {
            deleteTreasuryTransaction(originalIndex);
        });

        lastTransContainer.appendChild(div);
    });
}

function deleteTreasuryTransaction(index) {
    if (!confirm('Biztosan törlöd ezt a kassza mozgást?')) return;
    treasury.splice(index, 1);

    const { db, ref, set } = window.FB;
    set(ref(db, 'treasury'), treasury);

    renderModalTreasuryTransactions();
    showToast('Kassza mozgás törölve.');
}

function closeTreasuryModal() {
    document.getElementById('treasury-modal').classList.add('hidden');
}

function saveTreasuryTransaction() {
    if (!isAdmin) return;

    const type = document.getElementById('treasury-trans-type').value;
    let amount = parseInt(document.getElementById('treasury-amount-input').value) || 0;
    const note = document.getElementById('treasury-note-input').value.trim() || (type === 'income' ? 'Bevétel' : 'Kiadás');

    if (amount <= 0) {
        showToast('Kérlek adj meg egy érvényes összeget!');
        return;
    }

    if (type === 'expense') {
        amount = -amount;
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

    const newTreasury = [...treasury, { amount, date: dateStr, type, note }];

    const { db, ref, set } = window.FB;
    set(ref(db, 'treasury'), newTreasury);
    closeTreasuryModal();
    showToast('Kassza mozgás rögzítve!');
}

function renderStandings() {
    const tbody = document.getElementById('standings-tbody');
    tbody.innerHTML = '';

    const statsMap = {};
    Object.values(users).forEach(u => {
        statsMap[u.username] = { username: u.username, name: u.name, M: 0, W: 0, D: 0, L: 0, P: 0, G: 0, goalsAgainst: 0, maxGoalsInSingleMatch: 0, form: [], matchesList: [] };
    });

    const filteredMatches = matches.filter(m => m.date && m.date.startsWith(selectedYear.toString()));

    filteredMatches.forEach(m => {
        const scoreA = parseInt(m.scoreA);
        const scoreB = parseInt(m.scoreB);

        const processTeam = (teamArr, myScore, oppScore) => {
            if (!teamArr) return;
            teamArr.forEach(p => {
                if (p.isSubstitute) return;
                if (!statsMap[p.username]) return;
                
                const st = statsMap[p.username];
                const goalsThisMatch = parseInt(p.goals || 0);
                st.M++;
                st.G += goalsThisMatch;
                st.goalsAgainst += oppScore;

                if (goalsThisMatch > st.maxGoalsInSingleMatch) {
                    st.maxGoalsInSingleMatch = goalsThisMatch;
                }

                let outcome = 'D';
                if (myScore > oppScore) { st.W++; st.P += 3; outcome = 'W'; }
                else if (myScore === oppScore) { st.D++; st.P += 1; outcome = 'D'; }
                else { st.L++; outcome = 'L'; }

                st.form.push(outcome);
                st.matchesList.push({ outcome, goals: goalsThisMatch });
            });
        };

        processTeam(m.teamA, scoreA, scoreB);
        processTeam(m.teamB, scoreB, scoreA);
    });

    const sorted = Object.values(statsMap).filter(s => s.M > 0).sort((a, b) => b.P - a.P || b.G - a.G);

    let maxGoals = Math.max(...sorted.map(s => s.G), 0);

    sorted.forEach((st, idx) => {
        let streakBadge = '-';
        if (st.matchesList.length >= 2) {
            let scoreStreak = 0;
            let droughtStreak = 0;
            for (let i = st.matchesList.length - 1; i >= 0; i--) {
                if (st.matchesList[i].goals > 0) {
                    if (droughtStreak > 0) break;
                    scoreStreak++;
                } else {
                    if (scoreStreak > 0) break;
                    droughtStreak++;
                }
            }
            if (scoreStreak >= 2) streakBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 shadow-2xs">🔥${scoreStreak}</span>`;
            else if (droughtStreak >= 2) streakBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 shadow-2xs">❄️${droughtStreak}</span>`;
        }

        let topScorerBadge = '';
        if (maxGoals > 0 && st.G === maxGoals) {
            topScorerBadge = `<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-300 text-yellow-900 border border-yellow-400 shadow-2xs" title="Gólkirály">👑</span>`;
        }

        const pm = (st.P / st.M).toFixed(2);
        const gm = (st.G / st.M).toFixed(2);

        const last3 = st.form.slice(-3);
        let formHtml = '';
        last3.forEach(f => {
            if (f === 'W') formHtml += `<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mx-0.5"></span>`;
            else if (f === 'D') formHtml += `<span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mx-0.5"></span>`;
            else formHtml += `<span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mx-0.5"></span>`;
        });

        const isMe = currentUser && currentUser.username === st.username;
        const rowBgClass = isMe ? 'bg-emerald-50/80 font-bold border-l-4 border-emerald-500' : 'hover:bg-gray-50/80';

        const tr = document.createElement('tr');
        tr.className = `${rowBgClass} transition`;
        tr.innerHTML = `
            <td class="py-3 px-3 text-xs text-gray-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3 font-semibold text-gray-800">${formatHungarianName(st.name)}${topScorerBadge}</td>
            <td class="py-3 px-2 text-center text-xs hidden sm:table-cell">${st.M}</td>
            <td class="py-3 px-2 text-center text-xs hidden md:table-cell">${st.W}</td>
            <td class="py-3 px-2 text-center text-xs hidden md:table-cell">${st.D}</td>
            <td class="py-3 px-2 text-center text-xs hidden md:table-cell">${st.L}</td>
            <td class="py-3 px-2 text-center text-sm font-bold text-gray-900">${st.P}</td>
            <td class="py-3 px-2 text-center text-sm font-bold text-gray-900">${st.G}</td>
            <td class="py-3 px-2 text-center text-xs text-gray-500 hidden lg:table-cell">${pm}</td>
            <td class="py-3 px-2 text-center text-xs text-gray-500 hidden lg:table-cell">${gm}</td>
            <td class="py-3 px-2 text-center">${streakBadge}</td>
            <td class="py-3 px-3 text-center whitespace-nowrap hidden sm:table-cell">${formHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    renderAwards(sorted, filteredMatches);
}

function renderAwards(sortedPlayers, filteredMatches) {
    const container = document.getElementById('awards-container');
    container.innerHTML = '';

    if (sortedPlayers.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 col-span-full text-center py-4">Még nincsenek adatok a különdíjakhoz.</p>`;
        return;
    }

    const maxPoints = Math.max(...sortedPlayers.map(p => p.P));
    const champions = sortedPlayers.filter(p => p.P === maxPoints);
    const championNames = champions.map(c => formatHungarianName(c.name)).join(', ');

    const maxGoals = Math.max(...sortedPlayers.map(p => p.G));
    const topScorers = sortedPlayers.filter(p => p.G === maxGoals && p.G > 0);
    const topScorerNames = topScorers.length > 0 ? topScorers.map(s => formatHungarianName(s.name)).join(', ') : '-';

    const validPM = sortedPlayers.filter(s => s.M >= 2);
    const bestPMPlayer = validPM.length > 0 ? [...validPM].sort((a, b) => (b.P / b.M) - (a.P / a.M))[0] : sortedPlayers[0];

    const validGM = sortedPlayers.filter(s => s.M >= 2);
    const bestGMPlayer = validGM.length > 0 ? [...validGM].sort((a, b) => (b.G / b.M) - (a.G / a.M))[0] : sortedPlayers[0];

    const bestSingleMatchScorer = [...sortedPlayers].sort((a, b) => b.maxGoalsInSingleMatch - a.maxGoalsInSingleMatch)[0];
    const mostWinsPlayer = [...sortedPlayers].sort((a, b) => b.W - a.W)[0];

    const validDefenders = sortedPlayers.filter(s => s.M >= 2);
    const bestDefender = validDefenders.length > 0 
        ? [...validDefenders].sort((a, b) => (a.goalsAgainst / a.M) - (b.goalsAgainst / b.M))[0]
        : sortedPlayers[0];

    const validWinRate = sortedPlayers.filter(s => s.M >= 2);
    const bestWinRate = validWinRate.length > 0
        ? [...validWinRate].sort((a, b) => (b.W / b.M) - (a.W / a.M))[0]
        : sortedPlayers[0];

    let bestStreakPlayer = sortedPlayers[0];
    let maxStreak = -1;
    sortedPlayers.forEach(p => {
        let currentStreak = 0;
        let maxPStreak = 0;
        p.matchesList.forEach(m => {
            if (m.outcome === 'W') {
                currentStreak++;
                if (currentStreak > maxPStreak) maxPStreak = currentStreak;
            } else {
                currentStreak = 0;
            }
        });
        if (maxPStreak > maxStreak) {
            maxStreak = maxPStreak;
            bestStreakPlayer = p;
        }
    });

    let highestScoringMatch = null;
    let lowestScoringMatch = null;
    let biggestMarginMatch = null;

    if (filteredMatches.length > 0) {
        highestScoringMatch = [...filteredMatches].sort((a, b) => (parseInt(b.scoreA) + parseInt(b.scoreB)) - (parseInt(a.scoreA) + parseInt(a.scoreB)))[0];
        lowestScoringMatch = [...filteredMatches].sort((a, b) => (parseInt(a.scoreA) + parseInt(a.scoreB)) - (parseInt(b.scoreA) + parseInt(b.scoreB)))[0];
        biggestMarginMatch = [...filteredMatches].sort((a, b) => Math.abs(parseInt(b.scoreA) - parseInt(b.scoreB)) - Math.abs(parseInt(a.scoreA) - parseInt(a.scoreB)))[0];
    }

    const awardsList = [
        {
            title: "🏆 Bajnok",
            definition: "A tabella éllovasa",
            name: championNames,
            value: `${maxPoints} pont`,
            color: "bg-amber-50 text-amber-800 border-amber-200"
        },
        {
            title: "👑 Gólkirály",
            definition: "Legtöbb gólt lövő játékos",
            name: topScorerNames,
            value: `${maxGoals} gól`,
            color: "bg-yellow-50 text-yellow-800 border-yellow-200"
        },
        {
            title: "📈 Legjobb P/M",
            definition: "A legmagasabb pont/meccs átlaggal rendelkező játékos (min. 2 meccs)",
            name: formatHungarianName(bestPMPlayer.name),
            value: `${(bestPMPlayer.P / bestPMPlayer.M).toFixed(2)} P/M`,
            color: "bg-emerald-50 text-emerald-800 border-emerald-200"
        },
        {
            title: "⚽ Legjobb G/M",
            definition: "A legmagasabb gól/meccs átlaggal rendelkező játékos (min. 2 meccs)",
            name: formatHungarianName(bestGMPlayer.name),
            value: `${(bestGMPlayer.G / bestGMPlayer.M).toFixed(2)} G/M`,
            color: "bg-teal-50 text-teal-800 border-teal-200"
        },
        {
            title: "🎯 Mesterlövész",
            definition: "A legtöbb gólt szerző játékos egyetlen mérkőzésen",
            name: formatHungarianName(bestSingleMatchScorer.name),
            value: `${bestSingleMatchScorer.maxGoalsInSingleMatch} gól egy meccsen`,
            color: "bg-red-50 text-red-800 border-red-200"
        },
        {
            title: "🥇 A Gyűjtő",
            definition: "A legtöbb győztes mérkőzéssel rendelkező játékos",
            name: formatHungarianName(mostWinsPlayer.name),
            value: `${mostWinsPlayer.W} győztes meccs`,
            color: "bg-indigo-50 text-indigo-800 border-indigo-200"
        },
        {
            title: "🛡️ A Fal",
            definition: "A legkevesebb kapott gól/meccs átlagú játékos (min. 2 meccs)",
            name: formatHungarianName(bestDefender.name),
            value: `${(bestDefender.goalsAgainst / bestDefender.M).toFixed(2)} gól/meccs`,
            color: "bg-blue-50 text-blue-800 border-blue-200"
        },
        {
            title: "🧱 Győzelmi Garancia",
            definition: "A legmagasabb győzelmi aránnyal rendelkező játékos (min. 2 meccs)",
            name: formatHungarianName(bestWinRate.name),
            value: `${Math.round((bestWinRate.W / bestWinRate.M) * 100)}% győzelem`,
            color: "bg-cyan-50 text-cyan-800 border-cyan-200"
        },
        {
            title: "🔥 Megállíthatatlan",
            definition: "A leghosszabb zsinórbeli győzelmi széria",
            name: formatHungarianName(bestStreakPlayer.name),
            value: `${maxStreak} győzelem zsinórban`,
            color: "bg-orange-50 text-orange-800 border-orange-200"
        }
    ];

    if (highestScoringMatch) {
        awardsList.push({
            title: "🎆 Leggólgazdagabb",
            definition: "A legtöbb gól egyetlen mérkőzésen",
            name: `${highestScoringMatch.date}`,
            value: `Végeredmény: ${highestScoringMatch.scoreA} : ${highestScoringMatch.scoreB} (${parseInt(highestScoringMatch.scoreA) + parseInt(highestScoringMatch.scoreB)} gól)`,
            color: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200"
        });
    }

    if (lowestScoringMatch) {
        awardsList.push({
            title: "🔒 Leggólszegényebb",
            definition: "A legkevesebb gól egyetlen mérkőzésen",
            name: `${lowestScoringMatch.date}`,
            value: `Végeredmény: ${lowestScoringMatch.scoreA} : ${lowestScoringMatch.scoreB} (${parseInt(lowestScoringMatch.scoreA) + parseInt(lowestScoringMatch.scoreB)} gól)`,
            color: "bg-slate-100 text-slate-800 border-slate-200"
        });
    }

    if (biggestMarginMatch) {
        const diff = Math.abs(parseInt(biggestMarginMatch.scoreA) - parseInt(biggestMarginMatch.scoreB));
        awardsList.push({
            title: "💥 Legnagyobb kiütés",
            definition: "A legnagyobb gólkülönbségű mérkőzés",
            name: `${biggestMarginMatch.date}`,
            value: `Végeredmény: ${biggestMarginMatch.scoreA} : ${biggestMarginMatch.scoreB} (${diff} gól különbség)`,
            color: "bg-rose-50 text-rose-800 border-rose-200"
        });
    }

    awardsList.forEach(award => {
        const card = document.createElement('div');
        card.className = `award-card p-4 rounded-xl border ${award.color} flex flex-col justify-between cursor-pointer shadow-2xs`;
        card.tabIndex = 0;
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-1">
                    <span class="text-xs font-bold uppercase tracking-wider">${award.title}</span>
                    <i class="fa-solid fa-circle-question text-xs opacity-60"></i>
                </div>
                <div class="text-base font-black mt-1 leading-snug">${award.name}</div>
            </div>
            <div class="text-xs font-semibold opacity-90 mt-2 pt-2 border-t border-black/5">${award.value}</div>
            
            <!-- Tooltip -->
            <div class="award-tooltip absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 p-2.5 bg-gray-900 text-white text-[11px] rounded-xl shadow-xl pointer-events-none text-center z-30">
                ${award.definition}
                <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function openMatchMode(matchIndex = null) {
    if (!isAdmin) return;
    editingMatchIndex = matchIndex;
    const sec = document.getElementById('match-mode-section');
    sec.classList.remove('hidden');

    const dateLabel = document.getElementById('match-mode-date-label');
    const matchDate = matchIndex !== null ? matches[matchIndex].date : nextMatch.date;
    dateLabel.innerText = `Dátum: ${matchDate}`;

    const teamAPaid = document.getElementById('team-a-players');
    const teamBPaid = document.getElementById('team-b-players');
    teamAPaid.innerHTML = '';
    teamBPaid.innerHTML = '';

    let existingMatch = matchIndex !== null ? matches[matchIndex] : null;
    let activeList = [];

    if (existingMatch) {
        (existingMatch.teamA || []).forEach(p => activeList.push({ username: p.username, name: p.name, team: 'A', goals: p.goals, isSubstitute: p.isSubstitute }));
        (existingMatch.teamB || []).forEach(p => activeList.push({ username: p.username, name: p.name, team: 'B', goals: p.goals, isSubstitute: p.isSubstitute }));
    } else {
        activeList = Object.entries(nextMatch.attendances || {})
            .filter(([_, d]) => d.status === 'yes')
            .map(([uname, d], idx) => ({ 
                username: uname, 
                name: d.name, 
                team: idx % 2 === 0 ? 'A' : 'B', 
                goals: 0, 
                isSubstitute: d.isSubstitute === true 
            }));
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
            <span class="font-semibold text-gray-800">${formatHungarianName(p.name)}</span>
        </div>
        <div class="flex items-center space-x-2">
            <select class="team-select bg-gray-50 text-xs rounded border border-gray-200 px-2 py-1 text-gray-800 font-medium">
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

    el.querySelector('.btn-minus').addEventListener('click', (e) => changeGoals(e.target, -1));
    el.querySelector('.btn-plus').addEventListener('click', (e) => changeGoals(e.target, 1));

    const selectEl = el.querySelector('.team-select');
    selectEl.addEventListener('change', (e) => {
        if (e.target.value === 'A') teamAContainer.appendChild(el);
        else teamBContainer.appendChild(el);
        updateMatchScores();
    });

    if (p.team === 'A') teamAContainer.appendChild(el);
    else teamBContainer.appendChild(el);
}

function changeGoals(btn, delta) {
    const goalsSpan = btn.parentElement.querySelector('.player-goals');
    let current = parseInt(goalsSpan.innerText) || 0;
    current = Math.max(0, current + delta);
    goalsSpan.innerText = current;
    updateMatchScores();
}

function updateMatchScores() {
    let scoreA = 0;
    let scoreB = 0;

    document.querySelectorAll('#team-a-players .player-row').forEach(row => {
        scoreA += parseInt(row.querySelector('.player-goals').innerText || 0);
    });

    document.querySelectorAll('#team-b-players .player-row').forEach(row => {
        scoreB += parseInt(row.querySelector('.player-goals').innerText || 0);
    });

    document.getElementById('team-a-score').innerText = scoreA;
    document.getElementById('team-b-score').innerText = scoreB;
}

function closeMatchMode() {
    document.getElementById('match-mode-section').classList.add('hidden');
    editingMatchIndex = null;
}

function saveMatchResults() {
    if (!isAdmin) return;

    const teamAEls = document.querySelectorAll('#team-a-players .player-row');
    const teamBEls = document.querySelectorAll('#team-b-players .player-row');

    if (teamAEls.length === 0 || teamBEls.length === 0) {
        showToast('Hiba: Mindkét csapatban kell lennie legalább egy játékosnak!');
        return;
    }

    const matchDateStr = editingMatchIndex !== null ? matches[editingMatchIndex].date : nextMatch.date;
    const cleanDateStr = matchDateStr.replace(/\./g, '').trim().replace(/ /g, '-');
    const matchDateObj = new Date(cleanDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (editingMatchIndex === null && matchDateObj > today) {
        showToast('Hiba: Csak olyan meccs menthető, amelynek dátuma a múltban van!');
        return;
    }

    const teamA = [];
    const teamB = [];
    let scoreA = 0;
    let scoreB = 0;
    const participantsUsernames = [];

    teamAEls.forEach(row => {
        const goals = parseInt(row.querySelector('.player-goals').innerText || 0);
        const isSub = row.dataset.isSubstitute === 'true';
        const uname = row.dataset.username;
        teamA.push({
            username: isSub ? '' : uname,
            name: row.dataset.name,
            goals,
            isSubstitute: isSub
        });
        scoreA += goals;
        if (!isSub && uname) participantsUsernames.push(uname);
    });

    teamBEls.forEach(row => {
        const goals = parseInt(row.querySelector('.player-goals').innerText || 0);
        const isSub = row.dataset.isSubstitute === 'true';
        const uname = row.dataset.username;
        teamB.push({
            username: isSub ? '' : uname,
            name: row.dataset.name,
            goals,
            isSubstitute: isSub
        });
        scoreB += goals;
        if (!isSub && uname) participantsUsernames.push(uname);
    });

    const matchRecord = {
        date: matchDateStr,
        scoreA,
        scoreB,
        teamA,
        teamB
    };

    const { db, ref, set } = window.FB;

    if (editingMatchIndex !== null) {
        matches[editingMatchIndex] = matchRecord;
    } else {
        matches.push(matchRecord);

        const feeDeduction = -(nextMatch.feePerPerson || 1000);
        participantsUsernames.forEach(uname => {
            const userTrans = transactions[uname] || [];
            userTrans.push({
                amount: feeDeduction,
                date: matchDateStr,
                type: 'match'
            });
            set(ref(db, `transactions/${uname}`), userTrans);
        });

        const courtFeeAmount = -(nextMatch.courtFee || 18000);
        const newTreasury = [...treasury, {
            amount: courtFeeAmount,
            date: matchDateStr,
            type: 'expense',
            note: 'Pályadíj'
        }];
        set(ref(db, 'treasury'), newTreasury);

        const dateParts = nextMatch.date.replace(/\./g, '').trim().split(' ');
        if (dateParts.length === 3) {
            const currentD = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            currentD.setDate(currentD.getDate() + 7);
            const newYear = currentD.getFullYear();
            const newMonth = String(currentD.getMonth() + 1).padStart(2, '0');
            const newDay = String(currentD.getDate()).padStart(2, '0');
            
            nextMatch.date = `${newYear}. ${newMonth}. ${newDay}.`;
            nextMatch.attendances = {};
            set(ref(db, 'nextMatch'), nextMatch);
        }
    }

    set(ref(db, 'matches'), matches);
    closeMatchMode();
    showToast('Meccs rögzítve, pénzügyek frissítve!');
}

function openEditMatchDateModal() {
    document.getElementById('modal-match-fee').value = nextMatch.courtFee || 18000;
    document.getElementById('modal-match-fee-person').value = nextMatch.feePerPerson || 1000;
    document.getElementById('edit-date-modal').classList.remove('hidden');
}

function closeEditMatchDateModal() {
    document.getElementById('edit-date-modal').classList.add('hidden');
}

function saveNextMatchDateModal() {
    const dateVal = document.getElementById('modal-match-date').value;
    const startVal = document.getElementById('modal-match-start').value;
    const endVal = document.getElementById('modal-match-end').value;
    const feeVal = document.getElementById('modal-match-fee').value;
    const feePersonVal = document.getElementById('modal-match-fee-person').value;

    if (dateVal) {
        nextMatch.date = dateVal.replace(/-/g, '. ') + '.';
    }
    if (startVal) nextMatch.startTime = startVal;
    if (endVal) nextMatch.endTime = endVal;
    if (feeVal) nextMatch.courtFee = parseInt(feeVal) || 18000;
    if (feePersonVal) nextMatch.feePerPerson = parseInt(feePersonVal) || 1000;

    const { db, ref, set } = window.FB;
    set(ref(db, 'nextMatch'), nextMatch);
    closeEditMatchDateModal();
    showToast('Beállítások frissítve!');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 3000);
}