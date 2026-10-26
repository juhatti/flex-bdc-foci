let currentUser = null;
let isAdmin = false;
let users = {};
let nextMatch = { date: "2026. 10. 27.", startTime: "09:00", endTime: "10:00", attendances: {} };
let matches = [];
let editingMatchIndex = null;
let currentMatchPage = 0;
let selectedYear = 2026;

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
        }
        renderApp();
    });

    onValue(ref(db, 'matches'), (snapshot) => {
        const val = snapshot.val();
        matches = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
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
            currentUser = { username: 'admin', name: 'Juhász Attila (Admin)', admin: true };
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
        renderStandings();
    } else {
        dashSec.classList.add('hidden');
        userHeader.classList.add('hidden');
        authSec.classList.remove('hidden');
    }
}

function renderNextMatchCard() {
    document.getElementById('next-match-date-display').innerText = `${nextMatch.date} ${nextMatch.startTime} - ${nextMatch.endTime}`;

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
            // Beugró sora admin nézetben (nincs státusz váltó gomb, helyette törlés, nincs megjegyzés, lila badge)
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
            // Normál jelentkező sora
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

function renderStandings() {
    const tbody = document.getElementById('standings-tbody');
    tbody.innerHTML = '';

    const statsMap = {};
    Object.values(users).forEach(u => {
        statsMap[u.username] = { username: u.username, name: u.name, M: 0, W: 0, D: 0, L: 0, P: 0, G: 0, form: [], matchesList: [] };
    });

    matches.forEach(m => {
        if (m.date && !m.date.startsWith(selectedYear.toString())) {
            return;
        }

        const scoreA = parseInt(m.scoreA);
        const scoreB = parseInt(m.scoreB);

        const processTeam = (teamArr, myScore, oppScore) => {
            if (!teamArr) return;
            teamArr.forEach(p => {
                if (p.isSubstitute) return;
                if (!statsMap[p.username]) return;
                
                const st = statsMap[p.username];
                st.M++;
                st.G += parseInt(p.goals || 0);

                let outcome = 'D';
                if (myScore > oppScore) { st.W++; st.P += 3; outcome = 'W'; }
                else if (myScore === oppScore) { st.D++; st.P += 1; outcome = 'D'; }
                else { st.L++; outcome = 'L'; }

                st.form.push(outcome);
                st.matchesList.push({ outcome, goals: parseInt(p.goals || 0) });
            });
        };

        processTeam(m.teamA, scoreA, scoreB);
        processTeam(m.teamB, scoreB, scoreA);
    });

    const sorted = Object.values(statsMap).filter(s => s.M > 0).sort((a, b) => b.P - a.P || b.G - a.G);

    let maxGoals = 0;
    sorted.forEach(st => {
        if (st.G > maxGoals) maxGoals = st.G;
    });

    sorted.forEach((st, idx) => {
        let streakBadge = '';
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
            if (scoreStreak >= 2) streakBadge = `<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 shadow-2xs">🔥${scoreStreak}</span>`;
            else if (droughtStreak >= 2) streakBadge = `<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 shadow-2xs">❄️${droughtStreak}</span>`;
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

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/80 transition';
        tr.innerHTML = `
            <td class="py-3 px-3 text-xs text-gray-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3 font-semibold text-gray-800">${formatHungarianName(st.name)}${topScorerBadge}${streakBadge}</td>
            <td class="py-3 px-2 text-center text-xs hidden sm:table-cell">${st.M}</td>
            <td class="py-3 px-2 text-center text-xs hidden md:table-cell">${st.W}</td>
            <td class="py-3 px-2 text-center text-xs hidden md:table-cell">${st.D}</td>
            <td class="py-3 px-2 text-center text-xs hidden md:table-cell">${st.L}</td>
            <td class="py-3 px-2 text-center text-sm font-bold text-gray-900">${st.P}</td>
            <td class="py-3 px-2 text-center text-sm font-bold text-gray-900">${st.G}</td>
            <td class="py-3 px-2 text-center text-xs text-gray-500 hidden lg:table-cell">${pm}</td>
            <td class="py-3 px-2 text-center text-xs text-gray-500 hidden lg:table-cell">${gm}</td>
            <td class="py-3 px-3 text-center whitespace-nowrap hidden sm:table-cell">${formHtml}</td>
        `;
        tbody.appendChild(tr);
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

    teamAEls.forEach(row => {
        const goals = parseInt(row.querySelector('.player-goals').innerText || 0);
        const isSub = row.dataset.isSubstitute === 'true';
        teamA.push({
            username: isSub ? '' : row.dataset.username,
            name: row.dataset.name,
            goals,
            isSubstitute: isSub
        });
        scoreA += goals;
    });

    teamBEls.forEach(row => {
        const goals = parseInt(row.querySelector('.player-goals').innerText || 0);
        const isSub = row.dataset.isSubstitute === 'true';
        teamB.push({
            username: isSub ? '' : row.dataset.username,
            name: row.dataset.name,
            goals,
            isSubstitute: isSub
        });
        scoreB += goals;
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
    showToast('Meccs sikeresen rögzítve!');
}

function openEditMatchDateModal() {
    document.getElementById('edit-date-modal').classList.remove('hidden');
}

function closeEditMatchDateModal() {
    document.getElementById('edit-date-modal').classList.add('hidden');
}

function saveNextMatchDateModal() {
    const dateVal = document.getElementById('modal-match-date').value;
    const startVal = document.getElementById('modal-match-start').value;
    const endVal = document.getElementById('modal-match-end').value;

    if (dateVal) {
        nextMatch.date = dateVal.replace(/-/g, '. ') + '.';
    }
    if (startVal) nextMatch.startTime = startVal;
    if (endVal) nextMatch.endTime = endVal;

    const { db, ref, set } = window.FB;
    set(ref(db, 'nextMatch'), nextMatch);
    closeEditMatchDateModal();
    showToast('Időpont frissítve!');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 3000);
}