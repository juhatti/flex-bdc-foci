// Render Standings Table & Góllövőlista
window.renderStandings = function() {
    const state = window.AppState;
    const tbody = document.getElementById('standings-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const statsMap = {};
    Object.values(state.users).filter(u => u.pending !== true).forEach(u => {
        const uid = String(u.id);
        statsMap[uid] = { 
            id: uid, 
            username: u.username, 
            name: u.name, 
            M: 0, 
            W: 0, 
            D: 0, 
            L: 0, 
            P: 0, 
            G: 0, 
            goalsAgainst: 0, 
            maxGoalsInSingleMatch: 0, 
            form: [], 
            matchesList: [] 
        };
    });

    const filteredMatches = state.matches.filter(m => m.date && m.date.startsWith(state.selectedYear.toString()));

    filteredMatches.forEach(m => {
        const scoreA = parseInt(m.scoreA || 0);
        const scoreB = parseInt(m.scoreB || 0);
        const defaultOutcomeA = scoreA > scoreB ? 'W' : scoreA === scoreB ? 'D' : 'L';
        const defaultOutcomeB = scoreB > scoreA ? 'W' : scoreB === scoreA ? 'D' : 'L';

        const matchPlayerSummary = {};

        const collectTeamEntries = (teamArr, defaultOutcome, oppScore) => {
            if (!teamArr) return;
            teamArr.forEach(p => {
                const pid = String(p.id || p.username || '');
                if (p.isSubstitute || !statsMap[pid]) return;

                const goals = parseInt(p.goals || 0);
                if (!matchPlayerSummary[pid]) {
                    matchPlayerSummary[pid] = {
                        goals: 0,
                        oppScore: oppScore,
                        outcome: p.outcome || defaultOutcome
                    };
                }
                matchPlayerSummary[pid].goals += goals;
                if (p.outcome) {
                    matchPlayerSummary[pid].outcome = p.outcome;
                }
            });
        };

        collectTeamEntries(m.teamA, defaultOutcomeA, scoreB);
        collectTeamEntries(m.teamB, defaultOutcomeB, scoreA);

        Object.entries(matchPlayerSummary).forEach(([pid, summary]) => {
            const st = statsMap[pid];
            st.M++;
            st.G += summary.goals;
            st.goalsAgainst += summary.oppScore;
            if (summary.goals > st.maxGoalsInSingleMatch) {
                st.maxGoalsInSingleMatch = summary.goals;
            }

            const outcome = summary.outcome;
            if (outcome === 'W') {
                st.W++;
                st.P += 3;
            } else if (outcome === 'D') {
                st.D++;
                st.P += 1;
            } else {
                st.L++;
            }

            st.form.push(outcome);
            st.matchesList.push({ outcome, goals: summary.goals });
        });
    });

    const isScorers = state.standingsMode === 'scorers';

    let sorted = Object.values(statsMap).filter(s => s.M > 0);
    if (isScorers) {
        sorted.sort((a, b) => b.G - a.G || b.P - a.P);
    } else {
        sorted.sort((a, b) => b.P - a.P || b.G - a.G);
    }

    const maxGoals = Math.max(...sorted.map(s => s.G), 0);

    sorted.forEach((st, idx) => {
        let streakBadge = '-';
        if (st.matchesList.length >= 2) {
            let sStreak = 0, dStreak = 0;
            for (let i = st.matchesList.length - 1; i >= 0; i--) {
                if (st.matchesList[i].goals > 0) {
                    if (dStreak > 0) break;
                    sStreak++;
                } else {
                    if (sStreak > 0) break;
                    dStreak++;
                }
            }
            if (sStreak >= 2) streakBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">\uD83D\udd25' + sStreak + '</span>';
            else if (dStreak >= 2) streakBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-750">\u2744\ufe0f' + dStreak + '</span>';
        }

        const championBadge = (!isScorers && idx === 0) ? '<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-300 text-amber-900 border border-amber-400" title="Els\u0151 helyezett">\uD83C\udfc6</span>' : '';
        const topScorerBadge = (maxGoals > 0 && st.G === maxGoals) ? '<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-300 text-yellow-900 border border-yellow-400" title="G\u00f3lkir\u00e1ly">\uD83D\udc51</span>' : '';
        const pm = (st.P / st.M).toFixed(2);
        const gm = (st.G / st.M).toFixed(2);

        let formHtml = '';
        st.form.slice(-3).forEach(f => {
            formHtml += '<span class="inline-block w-2.5 h-2.5 rounded-full ' + (f === 'W' ? 'bg-emerald-500' : f === 'D' ? 'bg-amber-400' : 'bg-red-500') + ' mx-0.5"></span>';
        });

        const isMe = state.currentUser && String(state.currentUser.id) === st.id;
        const tr = document.createElement('tr');
        tr.className = (isMe ? 'bg-emerald-50/80 font-bold border-l-4 border-emerald-500' : 'hover:bg-gray-50/80') + ' transition';
        tr.innerHTML = `
            <td class="py-3 px-3 text-xs text-gray-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3 font-semibold text-gray-800">${window.formatHungarianName(st.name)}${championBadge}${topScorerBadge}</td>
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

    renderLoginWidget();
};

window.setStandingsMode = function(mode) {
    window.AppState.standingsMode = mode;
    const sliderThumb = document.getElementById('standings-slider-thumb');
    const btnStandings = document.getElementById('slider-tab-standings');
    const btnScorers = document.getElementById('slider-tab-scorers');

    if (sliderThumb) {
        if (mode === 'standings') {
            sliderThumb.style.transform = 'translateX(0%)';
            if (btnStandings) { btnStandings.classList.add('text-gray-900', 'font-bold'); btnStandings.classList.remove('text-gray-500'); }
            if (btnScorers) { btnScorers.classList.add('text-gray-500'); btnScorers.classList.remove('text-gray-900', 'font-bold'); }
        } else {
            sliderThumb.style.transform = 'translateX(100%)';
            if (btnScorers) { btnScorers.classList.add('text-gray-900', 'font-bold'); btnScorers.classList.remove('text-gray-500'); }
            if (btnStandings) { btnStandings.classList.add('text-gray-500'); btnStandings.classList.remove('text-gray-900', 'font-bold'); }
        }
    }
    window.renderStandings();
    renderLoginWidget();
};

function renderLoginWidget() {
    const state = window.AppState;
    const container = document.getElementById('login-widget-container');
    if (!container) return;

    if (state.currentUser) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    let prevMatchHtml = '';
    const lastMatch = state.matches && state.matches.length > 0 ? state.matches[state.matches.length - 1] : null;
    if (lastMatch) {
        prevMatchHtml = `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center mb-4">
                <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Előző Meccs</span>
                <div class="text-xs font-semibold text-gray-600 mb-1">${lastMatch.date}</div>
                <div class="text-xl font-black text-gray-800">${lastMatch.scoreA} : ${lastMatch.scoreB}</div>
            </div>
        `;
    } else {
        prevMatchHtml = `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center mb-4">
                <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Előző Meccs</span>
                <div class="text-xs text-gray-400">Még nincs rögzített meccs</div>
            </div>
        `;
    }

    const statsMap = {};
    Object.values(state.users).filter(u => u.pending !== true).forEach(u => {
        const uid = String(u.id);
        statsMap[uid] = { id: uid, name: u.name, M: 0, P: 0, G: 0 };
    });

    const filteredMatches = state.matches.filter(m => m.date && m.date.startsWith(state.selectedYear.toString()));
    filteredMatches.forEach(m => {
        const scoreA = parseInt(m.scoreA || 0);
        const scoreB = parseInt(m.scoreB || 0);
        const defA = scoreA > scoreB ? 'W' : scoreA === scoreB ? 'D' : 'L';
        const defB = scoreB > scoreA ? 'W' : scoreB === scoreA ? 'D' : 'L';
        const matchSummary = {};

        const processTeam = (teamArr, defOutcome) => {
            if (!teamArr) return;
            teamArr.forEach(p => {
                const pid = String(p.id || p.username || '');
                if (p.isSubstitute || !statsMap[pid]) return;
                if (!matchSummary[pid]) matchSummary[pid] = { goals: 0, outcome: p.outcome || defOutcome };
                matchSummary[pid].goals += parseInt(p.goals || 0);
                if (p.outcome) matchSummary[pid].outcome = p.outcome;
            });
        };
        processTeam(m.teamA, defA);
        processTeam(m.teamB, defB);

        Object.entries(matchSummary).forEach(([pid, sum]) => {
            const st = statsMap[pid];
            st.M++;
            st.G += sum.goals;
            if (sum.outcome === 'W') st.P += 3;
            else if (sum.outcome === 'D') st.P += 1;
        });
    });

    const isScorers = state.standingsMode === 'scorers';
    let sorted = Object.values(statsMap).filter(s => s.M > 0);
    if (isScorers) {
        sorted.sort((a, b) => b.G - a.G || b.P - a.P);
    } else {
        sorted.sort((a, b) => b.P - a.P || b.G - a.G);
    }

    let rowsHtml = '';
    if (sorted.length === 0) {
        rowsHtml = '<tr><td colspan="5" class="py-4 text-center text-xs text-gray-400">Nincs még adat</td></tr>';
    } else {
        sorted.forEach((st, idx) => {
            rowsHtml += `
                <tr class="border-b border-gray-50 hover:bg-gray-50/50">
                    <td class="py-2.5 px-2 text-xs font-bold text-gray-400">${idx + 1}</td>
                    <td class="py-2.5 px-2 font-semibold text-gray-800 text-xs truncate max-w-[120px]">${window.formatHungarianName(st.name)}</td>
                    <td class="py-2.5 px-2 text-center text-xs text-gray-600">${st.M}</td>
                    <td class="py-2.5 px-2 text-center text-xs font-bold text-gray-900">${st.P}</td>
                    <td class="py-2.5 px-2 text-center text-xs font-bold text-gray-900">${st.G}</td>
                </tr>
            `;
        });
    }

    container.innerHTML = `
        ${prevMatchHtml}
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-hidden">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-sm font-bold text-gray-800">${isScorers ? 'Góllövőlista' : 'Tabella'}</h3>
                <div class="bg-gray-100 p-0.5 rounded-xl flex relative text-xs font-semibold w-40">
                    <div id="login-slider-thumb" class="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-white rounded-lg shadow-sm transition-transform duration-200 ${isScorers ? 'translate-x-full' : 'translate-x-0'}"></div>
                    <button type="button" onclick="setStandingsMode('standings')" class="flex-1 py-1 text-center relative z-10 ${!isScorers ? 'text-gray-900 font-bold' : 'text-gray-500'}">Tabella</button>
                    <button type="button" onclick="setStandingsMode('scorers')" class="flex-1 py-1 text-center relative z-10 ${isScorers ? 'text-gray-900 font-bold' : 'text-gray-500'}">Gólok</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100">
                        <tr>
                            <th class="py-2 px-2">#</th>
                            <th class="py-2 px-2">Név</th>
                            <th class="py-2 px-2 text-center">M</th>
                            <th class="py-2 px-2 text-center">P</th>
                            <th class="py-2 px-2 text-center">G</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50 text-gray-700">${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
}
