// Global Application State
window.AppState = {
    currentUser: null,
    isAdmin: false,
    users: {},
    nextMatch: { 
        date: "2026. 10. 27.", 
        startTime: "09:00", 
        endTime: "10:00", 
        location: "ELTE Sport Kft Bogdánfy úti sporttelep",
        courtFee: 18000, 
        feePerPerson: 1000, 
        attendances: {} 
    },
    matches: [],
    transactions: {},
    treasury: [],
    editingMatchIndex: null,
    isSwapModeActive: false,
    currentMatchPage: 0,
    currentMyTransPage: 0,
    currentTreasuryPage: 0,
    currentModalTransPage: 0,
    selectedYear: 2026,
    selectedPaymentUserId: null,
    activeTab: 'matches'
};
