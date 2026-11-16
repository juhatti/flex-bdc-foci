window.renderStandings = function() {
    const state = window.AppState;
    const tbody = document.getElementById('standings-tbody');
    tbody.innerHTML = '';

    const statsMap = {};
    Object.values(state.users).forEach(u => {
        const uid = String(u.id);
        statsMap[uid] = { id: uid, username: u.username, name: u.name, M: 0, W: 0, D: 0, L: 0, P: 0, G: 0, goalsAgainst: 0, maxGoalsInSingleMatch: 0, form: [], matchesList: [] };
    });

    const filteredMatches = state.matches.filter(m => m.date && m.date.startsWith(state.selectedYear.toString()));

    filteredMatches.forEach(m => {
        const scoreA = parseInt(m.scoreA), scoreB = parseInt(m.scoreB);
        const processTeam = (teamArr, myScore, oppScore) => {
            if (!teamArr) return;
            teamArr.forEach(p => {
                const pid = String(p.id || p.username || '');
                if (p.isSubstitute || !statsMap[pid]) return;
                const st = statsMap[pid];
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

        const championBadge = (idx === 0) ? `<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-300 text-amber-900 border border-amber-400" title="Első helyezett">🏆</span>` : '';
        const topScorerBadge = (maxGoals > 0 && st.G === maxGoals) ? `<span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-300 text-yellow-900 border border-yellow-400" title="Gólkirály">👑</span>` : '';
        const pm = (st.P / st.M).toFixed(2);
        const gm = (st.G / st.M).toFixed(2);

        let formHtml = '';
        st.form.slice(-3).forEach(f => {
            formHtml += `<span class="inline-block w-2.5 h-2.5 rounded-full ${f === 'W' ? 'bg-emerald-500' : f === 'D' ? 'bg-amber-400' : 'bg-red-500'} mx-0.5"></span>`;
        });

        const isMe = state.currentUser && String(state.currentUser.id) === st.id;
        const tr = document.createElement('tr');
        tr.className = `${isMe ? 'bg-emerald-50/80 font-bold border-l-4 border-emerald-500' : 'hover:bg-gray-50/80'} transition`;
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
};
