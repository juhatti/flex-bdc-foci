window.renderStandings = function() {
    const state = window.AppState;
    const tbody = document.getElementById('standings-tbody');
    tbody.innerHTML = '';

    const statsMap = {};
    Object.values(state.users).forEach(u => {
        statsMap[u.username] = { username: u.username, name: u.name, M: 0, W: 0, D: 0, L: 0, P: 0, G: 0, goalsAgainst: 0, maxGoalsInSingleMatch: 0, form: [], matchesList: [] };
    });

    const filteredMatches = state.matches.filter(m => m.date && m.date.startsWith(state.selectedYear.toString()));

    filteredMatches.forEach(m => {
        const scoreA = parseInt(m.scoreA), scoreB = parseInt(m.scoreB);
        const processTeam = (teamArr, myScore, oppScore) => {
            if (!teamArr) return;
            teamArr.forEach(p => {
                if (p.isSubstitute || !statsMap[p.username]) return;
                const st = statsMap[p.username];
                const goals = parseInt(p.goals || 0);
                st.M++; st.G += goals; st.goalsAgainst += oppScore;
                if (goals > st.maxGoalsInSingleMatch) st.maxGoalsInSingleMatch = goals;

                let outcome = 'D';
                if (myScore > oppScore) { st.W++; st.P += 3; outcome = 'W'; }
                else if (myScore === oppScore) { st.D++; st.P += 1; outcome = 'D'; }
                else { st.L++; outcome = 'L'; }

                st.form.push(outcome);
                st.matchesList.push({ outcome, goals });
            });
        };
        processTeam(m.teamA, scoreA, scoreB);
        processTeam(m.teamB, scoreB, scoreA);
    });

    const sorted = Object.values(statsMap).filter(s => s.M > 0).sort((a, b) => b.P - a.P || b.G - a.G);
    const maxGoals = Math.max(...sorted.map(s => s.G), 0);

    sorted.forEach((st, idx) => {
        let streakBadge = '-';
        if (st.matchesList.length >= 2) {
            let sStreak = 0, dStreak = 0;
            for (let i = st.matchesList.length - 1; i >= 0; i--) {
                if (st.matchesList[i].goals > 0) { if (dStreak > 0) break; sStreak++; }
                else { if (sStreak > 0) break; dStreak++; }
            }
            if (sStreak >= 2) streakBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">🔥${sStreak}</span>`;
            else if (dStreak >= 2) streakBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">❄️${dStreak}</span>`;
        }

        const topScorerBadge = (maxGoals > 0 && st.G === maxGoals) ? `<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-300 text-yellow-900 border border-yellow-400" title="Gólkirály">👑</span>` : '';
        const pm = (st.P / st.M).toFixed(2);
        const gm = (st.G / st.M).toFixed(2);

        let formHtml = '';
        st.form.slice(-3).forEach(f => {
            formHtml += `<span class="inline-block w-2.5 h-2.5 rounded-full ${f === 'W' ? 'bg-emerald-500' : f === 'D' ? 'bg-amber-400' : 'bg-red-500'} mx-0.5"></span>`;
        });

        const isMe = state.currentUser && state.currentUser.username === st.username;
        const tr = document.createElement('tr');
        tr.className = `${isMe ? 'bg-emerald-50/80 font-bold border-l-4 border-emerald-500' : 'hover:bg-gray-50/80'} transition`;
        tr.innerHTML = `
            <td class="py-3 px-3 text-xs text-gray-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3 font-semibold text-gray-800">${window.formatHungarianName(st.name)}${topScorerBadge}</td>
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
};

function renderAwards(sortedPlayers, filteredMatches) {
    const container = document.getElementById('awards-container');
    container.innerHTML = '';

    if (sortedPlayers.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 col-span-full text-center py-4">Még nincsenek adatok a különdíjakhoz.</p>`;
        return;
    }

    const maxPoints = Math.max(...sortedPlayers.map(p => p.P));
    const championNames = sortedPlayers.filter(p => p.P === maxPoints).map(c => window.formatHungarianName(c.name)).join(', ');
    const maxGoals = Math.max(...sortedPlayers.map(p => p.G));
    const topScorerNames = sortedPlayers.filter(p => p.G === maxGoals && p.G > 0).map(s => window.formatHungarianName(s.name)).join(', ') || '-';

    const validPlayers = sortedPlayers.filter(s => s.M >= 2);
    const bestPM = validPlayers.length ? [...validPlayers].sort((a, b) => (b.P / b.M) - (a.P / a.M))[0] : sortedPlayers[0];
    const bestGM = validPlayers.length ? [...validPlayers].sort((a, b) => (b.G / b.M) - (a.G / a.M))[0] : sortedPlayers[0];
    const bestSingleMatchScorer = [...sortedPlayers].sort((a, b) => b.maxGoalsInSingleMatch - a.maxGoalsInSingleMatch)[0];
    const mostWins = [...sortedPlayers].sort((a, b) => b.W - a.W)[0];
    const bestDefender = validPlayers.length ? [...validPlayers].sort((a, b) => (a.goalsAgainst / a.M) - (b.goalsAgainst / b.M))[0] : sortedPlayers[0];
    const bestWinRate = validPlayers.length ? [...validPlayers].sort((a, b) => (b.W / b.M) - (a.W / a.M))[0] : sortedPlayers[0];

    let bestStreakPlayer = sortedPlayers[0], maxStreak = -1;
    sortedPlayers.forEach(p => {
        let cur = 0, maxP = 0;
        p.matchesList.forEach(m => { if (m.outcome === 'W') { cur++; if (cur > maxP) maxP = cur; } else cur = 0; });
        if (maxP > maxStreak) { maxStreak = maxP; bestStreakPlayer = p; }
    });

    const awardsList = [
        { title: "🏆 Bajnok", def: "A tabella éllovasa", name: championNames, val: `${maxPoints} pont`, color: "bg-amber-50 text-amber-800 border-amber-200" },
        { title: "👑 Gólkirály", def: "Legtöbb gólt lövő játékos", name: topScorerNames, val: `${maxGoals} gól`, color: "bg-yellow-50 text-yellow-800 border-yellow-200" },
        { title: "📈 Legjobb P/M", def: "Legmagasabb pont/meccs átlag (min. 2 meccs)", name: window.formatHungarianName(bestPM.name), val: `${(bestPM.P / bestPM.M).toFixed(2)} P/M`, color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
        { title: "⚽ Legjobb G/M", def: "Legmagasabb gól/meccs átlag (min. 2 meccs)", name: window.formatHungarianName(bestGM.name), val: `${(bestGM.G / bestGM.M).toFixed(2)} G/M`, color: "bg-teal-50 text-teal-800 border-teal-200" },
        { title: "🎯 Mesterlövész", def: "Legtöbb gól egyetlen mérkőzésen", name: window.formatHungarianName(bestSingleMatchScorer.name), val: `${bestSingleMatchScorer.maxGoalsInSingleMatch} gól`, color: "bg-red-50 text-red-800 border-red-200" },
        { title: "🥇 A Gyűjtő", def: "Legtöbb győztes mérkőzés", name: window.formatHungarianName(mostWins.name), val: `${mostWins.W} győzelem`, color: "bg-indigo-50 text-indigo-800 border-indigo-200" },
        { title: "🛡️ A Fal", def: "Legkevesebb kapott gól/meccs (min. 2 meccs)", name: window.formatHungarianName(bestDefender.name), val: `${(bestDefender.goalsAgainst / bestDefender.M).toFixed(2)} gól/meccs`, color: "bg-blue-50 text-blue-800 border-blue-200" },
        { title: "🧱 Győzelmi Garancia", def: "Legmagasabb győzelmi arány (min. 2 meccs)", name: window.formatHungarianName(bestWinRate.name), val: `${Math.round((bestWinRate.W / bestWinRate.M) * 100)}%`, color: "bg-cyan-50 text-cyan-800 border-cyan-200" },
        { title: "🔥 Megállíthatatlan", def: "Leghosszabb győzelmi széria", name: window.formatHungarianName(bestStreakPlayer.name), val: `${maxStreak} zsinórban`, color: "bg-orange-50 text-orange-800 border-orange-200" }
    ];

    awardsList.forEach(a => {
        const card = document.createElement('div');
        card.className = `award-card p-4 rounded-xl border ${a.color} flex flex-col justify-between cursor-pointer shadow-2xs relative`;
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-1"><span class="text-xs font-bold uppercase tracking-wider">${a.title}</span><i class="fa-solid fa-circle-question text-xs opacity-60"></i></div>
                <div class="text-base font-black mt-1 leading-snug">${a.name}</div>
            </div>
            <div class="text-xs font-semibold opacity-90 mt-2 pt-2 border-t border-black/5">${a.val}</div>
            <div class="award-tooltip absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 p-2.5 bg-gray-900 text-white text-[11px] rounded-xl shadow-xl text-center">${a.def}</div>
        `;
        container.appendChild(card);
    });
}