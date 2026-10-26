// Globális Alkalmazás Állapotok
window.AppState = {
    currentUser: null,
    isAdmin: false,
    users: {},
    nextMatch: { date: "2026. 10. 27.", startTime: "09:00", endTime: "10:00", courtFee: 18000, feePerPerson: 1000, attendances: {} },
    matches: [],
    transactions: {},
    treasury: [],
    editingMatchIndex: null,
    currentMatchPage: 0,
    selectedYear: 2026,
    selectedPaymentUsername: null,
    activeTab: 'matches'
};