/**
 * ============================================================================
 * Campus Ledger — Application Logic (Powered by EDITH AI 2.5)
 * Pure ES6+ JavaScript, zero dependencies.
 *
 * Highlights
 *  - Multi-account login: salted password hashes, lockout after failed tries,
 *    sign-up, switch (re-authenticates), delete (needs that account's password)
 *  - Account database: every account owns its own ledger, goals, reminders,
 *    budgets, notifications and EDITH memory (localStorage key cl_data_<id>)
 *  - EDITH 2.5: intent + entity engine, multi-question answers, follow-ups,
 *    teachable aliases ("teach: chai = food"), unanswered-question log
 *
 * NOTE: everything is stored in the browser (localStorage). That is a demo
 * database — swap load/save helpers for Firebase/Firestore or your own API
 * for real cross-device accounts and real password security.
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Constants & seed data
  // --------------------------------------------------------------------------
  const DEMO_PASSWORD = 'demo1234';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30000;
  const DAY = 86400000;

  const DEFAULT_BUDGET_LIMITS = {
    'Food & Dining': 4500,
    'Travel & Commute': 2000,
    'Books & Academics': 2500,
    'Entertainment & Outings': 1800,
    'Shopping': 2000,
    'Bills & Utilities': 1200,
    'Emergency / Health': 1000
  };

  const CATEGORY_ICONS = {
    'Food & Dining': '🍔',
    'Travel & Commute': '🚕',
    'Books & Academics': '📚',
    'Entertainment & Outings': '🍿',
    'Shopping': '🛍️',
    'Bills & Utilities': '⚡',
    'Emergency / Health': '💊',
    'Allowance': '💰'
  };

  const ROLE_ICONS = { Student: '🎓', Parent: '👨‍💼', Bank: '🏦', Cash: '💵', Shared: '🤝' };

  const NEEDS_CATS = ['Food & Dining', 'Bills & Utilities', 'Books & Academics'];
  const WANTS_CATS = ['Entertainment & Outings', 'Shopping', 'Travel & Commute'];

  const CATEGORY_KEYWORDS = {
    'Food & Dining': ['food', 'dinner', 'lunch', 'breakfast', 'eat', 'eating', 'swiggy', 'zomato', 'canteen', 'chai', 'tea', 'coffee', 'pizza', 'burger', 'biryani', 'snack', 'snacks', 'mess', 'restaurant', 'dining', 'meal', 'khana'],
    'Travel & Commute': ['transport', 'travel', 'commute', 'uber', 'ola', 'rapido', 'cab', 'cabs', 'taxi', 'metro', 'bus', 'train', 'fuel', 'petrol', 'ride', 'rides'],
    'Books & Academics': ['book', 'books', 'academic', 'academics', 'study', 'xerox', 'stationery', 'notes', 'exam', 'tuition', 'library', 'print'],
    'Entertainment & Outings': ['entertainment', 'movie', 'movies', 'cinema', 'pvr', 'outing', 'outings', 'party', 'game', 'games', 'netflix', 'concert', 'fun'],
    'Shopping': ['shopping', 'clothes', 'shirt', 'shoes', 'amazon', 'flipkart', 'myntra', 'gadget', 'gadgets', 'headphones', 'headphone', 'accessories'],
    'Bills & Utilities': ['bill', 'bills', 'utility', 'utilities', 'recharge', 'electricity', 'wifi', 'internet', 'rent', 'subscription'],
    'Emergency / Health': ['health', 'medical', 'medicine', 'doctor', 'emergency', 'hospital', 'pharmacy']
  };

  const KNOWN_MERCHANTS = [
    { k: 'swiggy', n: 'Swiggy', c: 'Food & Dining' },
    { k: 'zomato', n: 'Zomato', c: 'Food & Dining' },
    { k: 'canteen', n: 'Campus Canteen', c: 'Food & Dining' },
    { k: 'dominos?', n: "Domino's", c: 'Food & Dining' },
    { k: 'uber', n: 'Uber Ride', c: 'Travel & Commute' },
    { k: 'ola', n: 'Ola Cabs', c: 'Travel & Commute' },
    { k: 'rapido', n: 'Rapido', c: 'Travel & Commute' },
    { k: 'metro', n: 'Metro Smart Card', c: 'Travel & Commute' },
    { k: 'irctc', n: 'IRCTC', c: 'Travel & Commute' },
    { k: 'books?', n: 'Campus Book Store', c: 'Books & Academics' },
    { k: 'library', n: 'Library', c: 'Books & Academics' },
    { k: 'xerox', n: 'Xerox & Print', c: 'Books & Academics' },
    { k: 'pvr', n: 'PVR Cinemas', c: 'Entertainment & Outings' },
    { k: 'bookmyshow', n: 'BookMyShow', c: 'Entertainment & Outings' },
    { k: 'netflix', n: 'Netflix', c: 'Entertainment & Outings' },
    { k: 'amazon', n: 'Amazon', c: 'Shopping' },
    { k: 'flipkart', n: 'Flipkart', c: 'Shopping' },
    { k: 'myntra', n: 'Myntra', c: 'Shopping' },
    { k: 'airtel', n: 'Airtel', c: 'Bills & Utilities' },
    { k: 'jio', n: 'Jio', c: 'Bills & Utilities' },
    { k: 'electricity', n: 'Electricity Bill', c: 'Bills & Utilities' },
    { k: 'pharmacy|apollo|medplus', n: 'Pharmacy', c: 'Emergency / Health' }
  ];

  const ITEM_PRICES = {
    dinner: 220, lunch: 120, breakfast: 60, coffee: 80, chai: 20, tea: 20, pizza: 350, biryani: 250,
    burger: 150, snacks: 80, movie: 450, headphones: 4000, headphone: 4000, earbuds: 1500, phone: 15000,
    laptop: 45000, shoes: 2000, shirt: 900, jeans: 1500, book: 500, books: 650, cab: 180, uber: 180,
    ride: 150, haircut: 200, gift: 1000, party: 1000
  };

  const DEMO_ACCOUNTS = [
    { id: 'usr-student-01', name: 'Mohit (Student)', email: 'mohit.student@campus.edu', role: 'Student', allowance: 15000, savingsTarget: 3000, icon: '🎓' },
    { id: 'usr-parent-02', name: 'Rajesh (Parent)', email: 'rajesh.parent@family.in', role: 'Parent', allowance: 25000, savingsTarget: 5000, icon: '👨‍💼' },
    { id: 'usr-bank-03', name: 'HDFC Student Savings', email: 'mohit.hdfc@campus.edu', role: 'Bank', allowance: 10000, savingsTarget: 2000, icon: '🏦' }
  ];
  const DEMO_OPENING = { 'usr-student-01': 9485, 'usr-parent-02': 25000, 'usr-bank-03': 8500 };

  const SAMPLE_UPI_NOTIFICATIONS = [
    { app: 'Google Pay', text: '₹240 paid to Swiggy India Ltd.', amount: 240, merchant: 'Swiggy', category: 'Food & Dining', flow: 'debit' },
    { app: 'PhonePe', text: 'Rs. 150 debited for Uber Ride via UPI', amount: 150, merchant: 'Uber Ride', category: 'Travel & Commute', flow: 'debit' },
    { app: 'Paytm', text: 'Paid ₹85 to Campus Canteen', amount: 85, merchant: 'Campus Canteen', category: 'Food & Dining', flow: 'debit' },
    { app: 'CRED', text: '₹650 spent at Sri Ganesh Books Store', amount: 650, merchant: 'Sri Ganesh Books', category: 'Books & Academics', flow: 'debit' },
    { app: 'Google Pay', text: 'You received ₹2,500 from Dad UPI', amount: 2500, merchant: 'Dad Allowance UPI', category: 'Allowance', flow: 'credit' },
    { app: 'Amazon Pay', text: '₹320 debited at Metro Smart Card Recharge', amount: 320, merchant: 'Metro Smart Card', category: 'Travel & Commute', flow: 'debit' }
  ];

  // --------------------------------------------------------------------------
  // Small utilities
  // --------------------------------------------------------------------------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escRx = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fmt = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const cap = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase());
  const clone = o => JSON.parse(JSON.stringify(o));

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  const dataKey = id => 'cl_data_' + id;

  // --------------------------------------------------------------------------
  // Password hashing (SHA-256 + salt; simple fallback if SubtleCrypto missing)
  // --------------------------------------------------------------------------
  function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function makeSalt() {
    try {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return Math.random().toString(16).slice(2, 12);
    }
  }

  async function hashPassword(pw, salt, kind) {
    const data = salt + ':' + pw;
    const useSha = kind ? kind === 'sha256' : !!(window.crypto && crypto.subtle);
    if (useSha && window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        return 'sha256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* fall through */ }
    }
    return 'c53:' + cyrb53(data).toString(16);
  }

  async function verifyPassword(acc, pw) {
    const kind = (acc.passHash || '').startsWith('sha256:') ? 'sha256' : 'c53';
    return (await hashPassword(pw, acc.salt, kind)) === acc.passHash;
  }

  // --------------------------------------------------------------------------
  // Per-account data model
  // --------------------------------------------------------------------------
  function atDaysAgo(n, h, m) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(h, m, 0, 0);
    return Math.min(d.getTime(), Date.now() - 60000);
  }

  function defaultData(opening) {
    const o = Number(opening) || 0;
    return {
      openingBalance: o,
      balanceMode: 'auto',
      manualBalance: o,
      transactions: [],
      budgetLimits: { ...DEFAULT_BUDGET_LIMITS },
      goals: [],
      reminders: [],
      notifications: [],
      unread: 0,
      edith: { aliases: {}, unanswered: [] }
    };
  }

  function normalizeData(raw, opening) {
    const base = defaultData(opening);
    const d = { ...base, ...(raw || {}) };
    d.edith = { ...base.edith, ...((raw && raw.edith) || {}) };
    d.edith.aliases = d.edith.aliases || {};
    d.edith.unanswered = d.edith.unanswered || [];
    ['transactions', 'goals', 'reminders', 'notifications'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    d.budgetLimits = d.budgetLimits || { ...DEFAULT_BUDGET_LIMITS };
    return d;
  }

  function seedStudentData() {
    const maxBack = Math.max(0, new Date().getDate() - 1);
    const b = n => Math.min(n, maxBack);
    const d = defaultData(DEMO_OPENING['usr-student-01']);
    d.transactions = [
      { id: 'tx-1', amount: 220, category: 'Food & Dining', merchant: 'Swiggy', ts: atDaysAgo(0, 13, 15), type: 'debit', isAi: true },
      { id: 'tx-2', amount: 180, category: 'Travel & Commute', merchant: 'Uber Ride', ts: atDaysAgo(0, 10, 30), type: 'debit', isAi: true },
      { id: 'tx-3', amount: 650, category: 'Books & Academics', merchant: 'Sri Ganesh Books', ts: atDaysAgo(b(1), 17, 5), type: 'debit', isAi: true },
      { id: 'tx-4', amount: 75, category: 'Food & Dining', merchant: 'Campus Canteen', ts: atDaysAgo(b(1), 9, 40), type: 'debit', isAi: true },
      { id: 'tx-5', amount: 5000, category: 'Allowance', merchant: 'Parent Transfer UPI', ts: atDaysAgo(b(9), 11, 0), type: 'credit', isAi: false },
      { id: 'tx-6', amount: 450, category: 'Entertainment & Outings', merchant: 'PVR Cinemas', ts: atDaysAgo(b(8), 19, 30), type: 'debit', isAi: true },
      { id: 'tx-7', amount: 340, category: 'Travel & Commute', merchant: 'Metro Smart Card', ts: atDaysAgo(b(7), 8, 20), type: 'debit', isAi: true },
      { id: 'tx-8', amount: 120, category: 'Food & Dining', merchant: 'Zomato Chai', ts: atDaysAgo(b(6), 16, 10), type: 'debit', isAi: true }
    ].sort((a, c) => c.ts - a.ts);
    d.goals = [
      { id: 'g-1', title: 'Sony ANC Headphones', target: 4000, saved: 1800, icon: '🎧' },
      { id: 'g-2', title: 'Semester Exam Books & Notes', target: 2500, saved: 2100, icon: '📚' },
      { id: 'g-3', title: 'Goa Hostel Trip', target: 6000, saved: 2400, icon: '🏖️' }
    ];
    d.reminders = [
      { id: 'r-1', title: 'Hostel Mess Fee Due', amount: 2400, date: '15th Oct' },
      { id: 'r-2', title: 'Library Book Return (No fine)', amount: 0, date: '18th Oct' },
      { id: 'r-3', title: 'Mobile Data Recharge', amount: 299, date: '22nd Oct' }
    ];
    return d;
  }

  // --------------------------------------------------------------------------
  // Application state
  // --------------------------------------------------------------------------
  const state = {
    accounts: [],
    currentId: null,
    isLoggedIn: false,
    data: defaultData(0),
    loginTargetId: null,
    attempts: {},
    activeTab: 'slide-1',
    activeFilter: 'all',
    searchQuery: '',
    dbTab: 'users',
    isDarkMode: lsGet('cl_theme', 'dark') !== 'light',
    isMobileFrame: lsGet('cl_mobileFrame', false) === true,
    ttsEnabled: true,
    chatMessages: [],
    edithCtx: null
  };

  const acct = () => state.accounts.find(a => a.id === state.currentId) || null;
  const D = () => state.data;

  function saveAccounts() { lsSet('cl_accounts', state.accounts); }
  function saveData() { if (state.isLoggedIn && state.currentId) lsSet(dataKey(state.currentId), state.data); }
  function saveSession() { lsSet('cl_session', { isLoggedIn: state.isLoggedIn, lastId: state.currentId }); }
  function savePrefs() { lsSet('cl_theme', state.isDarkMode ? 'dark' : 'light'); lsSet('cl_mobileFrame', state.isMobileFrame); }

  function loadAccountData(acc) {
    let raw = lsGet(dataKey(acc.id), null);
    if (!raw) {
      if (acc.id === 'usr-student-01') raw = seedStudentData();
      else raw = defaultData(DEMO_OPENING[acc.id] != null ? DEMO_OPENING[acc.id] : acc.allowance);
      lsSet(dataKey(acc.id), raw);
    }
    return normalizeData(raw, DEMO_OPENING[acc.id] != null ? DEMO_OPENING[acc.id] : acc.allowance);
  }

  async function bootstrap() {
    let accs = lsGet('cl_accounts', null);
    if (!Array.isArray(accs) || accs.length === 0) accs = clone(DEMO_ACCOUNTS);

    for (const a of accs) {
      a.allowance = Number(a.allowance) || 0;
      a.savingsTarget = Number(a.savingsTarget) || 0;
      a.icon = a.icon || ROLE_ICONS[a.role] || '👤';
      delete a.passwordMasked;
      delete a.balance;
      if (!a.passHash) {
        a.salt = a.salt || makeSalt();
        a.passHash = await hashPassword(DEMO_PASSWORD, a.salt);
      }
    }
    state.accounts = accs;
    saveAccounts();

    accs.forEach(a => { state.data = loadAccountData(a); lsSet(dataKey(a.id), state.data); });

    const sess = lsGet('cl_session', {});
    const last = accs.find(a => a.id === sess.lastId) || accs[0];
    state.currentId = last.id;
    if (sess.isLoggedIn && accs.some(a => a.id === sess.lastId)) {
      state.isLoggedIn = true;
      state.data = loadAccountData(last);
      resetChat();
    } else {
      state.isLoggedIn = false;
      state.data = defaultData(0);
    }
  }

  // --------------------------------------------------------------------------
  // Audio / confetti / toast
  // --------------------------------------------------------------------------
  function playAudioChime(type = 'success') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) { /* autoplay policy */ }
  }

  function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6'];
    const particles = Array.from({ length: 70 }, () => ({
      x: canvas.width / 2, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360, vr: (Math.random() - 0.5) * 10, alpha: 1
    }));
    let frame = 0;
    (function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.alpha -= 0.015; p.rotation += p.vr;
        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }
      frame++;
      if (alive && frame < 120) requestAnimationFrame(render);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // --------------------------------------------------------------------------
  // Date helpers
  // --------------------------------------------------------------------------
  function periodRange(key) {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    switch (key) {
      case 'today': return [sod, sod + DAY];
      case 'yesterday': return [sod - DAY, sod];
      case 'week': return [sod - 6 * DAY, sod + DAY];
      case 'lastmonth': return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()];
      default: return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
    }
  }
  const PERIOD_LABEL = { today: 'today', yesterday: 'yesterday', week: 'in the last 7 days', month: 'this month', lastmonth: 'last month' };

  function inRange(t, key) {
    if (!t.ts) return key === 'month';
    const [a, b] = periodRange(key);
    return t.ts >= a && t.ts < b;
  }
  const monthTx = () => D().transactions.filter(t => inRange(t, 'month'));
  const sum = arr => arr.reduce((s, t) => s + t.amount, 0);

  function formatTxDate(tx) {
    if (!tx.ts) return tx.date || '';
    const d = new Date(tx.ts);
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (tx.ts >= sod) return 'Today, ' + time;
    if (tx.ts >= sod - DAY) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function prettyDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return s || 'Soon';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  // --------------------------------------------------------------------------
  // Financial calculations (per active account)
  // --------------------------------------------------------------------------
  function computeBalance(data) {
    if (data.balanceMode === 'manual') return Math.max(0, Number(data.manualBalance) || 0);
    const credits = data.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debits = data.transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return Math.max(0, (Number(data.openingBalance) || 0) + credits - debits);
  }

  function calculateFinancials() {
    const tx = monthTx();
    const totalExpenses = sum(tx.filter(t => t.type === 'debit'));
    const totalIncome = sum(tx.filter(t => t.type === 'credit'));
    const a = acct();
    const allowance = a ? a.allowance : 0;
    const balance = computeBalance(D());
    const now = new Date();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, totalDays - now.getDate());
    const safeDailyLimit = Math.round(Math.max(0, balance) / daysRemaining);
    return { totalExpenses, totalIncome, allowance, balance, daysRemaining, totalDays, safeDailyLimit };
  }

  function get503020() {
    const fin = calculateFinancials();
    const tx = monthTx().filter(t => t.type === 'debit');
    const needs = sum(tx.filter(t => NEEDS_CATS.includes(t.category)));
    const wants = sum(tx.filter(t => WANTS_CATS.includes(t.category)));
    const base = Math.max(fin.allowance, needs + wants, 1);
    const pNeeds = Math.round((needs / base) * 100);
    const pWants = Math.round((wants / base) * 100);
    const pSavings = Math.max(0, 100 - pNeeds - pWants);
    return { needs, wants, savings: Math.max(0, base - needs - wants), pNeeds, pWants, pSavings };
  }

  const spendByCategory = (key = 'month') => {
    const m = {};
    D().transactions.filter(t => t.type === 'debit' && inRange(t, key)).forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    return m;
  };
  const upcomingDues = () => D().reminders.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  function renderAll() {
    renderThemeAndLayout();
    renderHeader();
    renderSlide1();
    renderSlide2();
    renderSlide3();
    renderSlide4();
    renderLoginAccountPills();
  }

  function renderThemeAndLayout() {
    const html = document.documentElement;
    const appContainer = document.getElementById('appContainer');
    const themeIcon = document.getElementById('themeIcon');
    html.classList.toggle('dark', state.isDarkMode);
    if (themeIcon) themeIcon.textContent = state.isDarkMode ? '☀️' : '🌙';
    if (appContainer) {
      appContainer.classList.toggle('mobile-frame-mode', state.isMobileFrame);
      appContainer.classList.toggle('locked', !state.isLoggedIn);
    }
  }

  function renderHeader() {
    const userGreeting = document.getElementById('userGreeting');
    const authBox = document.getElementById('authHeaderBtnContainer');
    const a = acct();
    if (userGreeting) {
      userGreeting.textContent = state.isLoggedIn && a ? `Hi, ${a.name.split(' ')[0]} 👋` : 'Logged Out';
    }
    if (authBox) {
      if (state.isLoggedIn) {
        authBox.innerHTML = '<button id="headerLogoutBtn" class="btn-icon logout-icon" title="Log Out & Unlink Device">🚪</button>';
        document.getElementById('headerLogoutBtn').addEventListener('click', handleLogout);
      } else {
        authBox.innerHTML = '<button id="headerLoginBtn" class="btn-amber" style="padding: 6px 12px; font-size: 0.75rem;">Sign In</button>';
        document.getElementById('headerLoginBtn').addEventListener('click', () => openLoginModal());
      }
    }
    const badge = document.getElementById('notifBadge');
    if (badge) {
      const n = state.isLoggedIn ? (D().unread || 0) : 0;
      badge.textContent = n > 9 ? '9+' : String(n);
      badge.classList.toggle('hidden', n <= 0);
    }
  }

  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  function renderSlide1() {
    const fin = calculateFinancials();
    const manual = D().balanceMode === 'manual';
    setText('metricBalance', fin.balance.toLocaleString('en-IN'));
    setText('balanceModeLabel', manual ? 'Manual' : 'Auto');
    setText('balanceFootText', manual ? 'Manual Override (Deducts on spend)' : 'Auto-updated via ledger');
    setText('metricAllowance', fin.allowance.toLocaleString('en-IN'));
    setText('metricSpent', fin.totalExpenses.toLocaleString('en-IN'));
    setText('spendPctBadge', `${Math.round((fin.totalExpenses / (fin.allowance || 1)) * 100)}%`);
    setText('metricDailySafe', fin.safeDailyLimit.toLocaleString('en-IN'));
    setText('metricDaysRemaining', fin.daysRemaining);

    // Warn about the worst category at 80% or more of its limit (any category)
    const spent = spendByCategory('month');
    let worst = null;
    Object.entries(D().budgetLimits).forEach(([cat, limit]) => {
      const ratio = limit > 0 ? (spent[cat] || 0) / limit : 0;
      if (ratio >= 0.8 && (!worst || ratio > worst.ratio)) worst = { cat, ratio, spent: spent[cat] || 0, limit };
    });
    const banner = document.getElementById('budgetWarningBanner');
    if (banner) {
      banner.classList.toggle('hidden', !worst);
      if (worst) setText('budgetWarningText', `${worst.cat} has reached ${(worst.ratio * 100).toFixed(0)}% of its limit (${fmt(worst.spent)} / ${fmt(worst.limit)})!`);
    }
    renderTransactionList();
  }

  function renderTransactionList() {
    const container = document.getElementById('txListContainer');
    if (!container) return;
    let list = [...D().transactions];
    if (state.activeFilter !== 'all') list = list.filter(t => t.type === state.activeFilter);
    const q = state.searchQuery.trim().toLowerCase();
    if (q) list = list.filter(t => t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));

    if (!state.isLoggedIn) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-mute);font-size:0.85rem;">Sign in to view your ledger.</div>';
      return;
    }
    if (!list.length) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-mute);font-size:0.85rem;">No transactions found.</div>';
      return;
    }
    container.innerHTML = list.map(tx => {
      const credit = tx.type === 'credit';
      return `
        <div class="tx-item">
          <div class="tx-item-left">
            <div class="tx-category-icon">${CATEGORY_ICONS[tx.category] || '💸'}</div>
            <div>
              <div class="tx-merchant">${esc(tx.merchant)} ${tx.isAi ? '<span class="badge-amber" style="font-size:0.6rem;padding:1px 4px;">EDITH</span>' : ''}</div>
              <div class="tx-meta">${esc(tx.category)} • ${esc(formatTxDate(tx))}</div>
            </div>
          </div>
          <div class="tx-item-right">
            <span class="tx-amount ${credit ? 'text-emerald' : 'text-rose'}">${credit ? '+' : '-'}${fmt(tx.amount)}</span>
            <button class="tx-delete-btn" data-id="${esc(tx.id)}" title="Delete">🗑️</button>
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('.tx-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => deleteTransaction(e.currentTarget.getAttribute('data-id')));
    });
  }

  function renderSlide2() {
    render503020Rule();
    renderDonutChart();
    renderTrendBars();
    renderCategoryBudgets();
  }

  function render503020Rule() {
    const r = get503020();
    const set = (barId, p, label) => {
      const el = document.getElementById(barId);
      if (el) { el.style.width = `${p}%`; el.textContent = p >= 12 ? `${label} ${p}%` : ''; }
    };
    set('barNeeds', r.pNeeds, 'Needs');
    set('barWants', r.pWants, 'Wants');
    set('barSavings', r.pSavings, 'Savings');
    setText('valNeeds', `${fmt(r.needs)} (${r.pNeeds}%)`);
    setText('valWants', `${fmt(r.wants)} (${r.pWants}%)`);
    setText('valSavings', `${fmt(r.savings)} (${r.pSavings}%)`);
  }

  function renderDonutChart() {
    const svg = document.getElementById('categoryDonutSvg');
    const legend = document.getElementById('donutLegend');
    if (!svg || !legend) return;
    const catMap = spendByCategory('month');
    const cats = Object.keys(catMap);
    const total = Object.values(catMap).reduce((s, v) => s + v, 0);
    if (!total) {
      svg.innerHTML = '<circle cx="50" cy="50" r="35" fill="none" stroke="var(--surface-3)" stroke-width="12" />';
      legend.innerHTML = '<div class="text-mute text-xs">No expense data yet</div>';
      return;
    }
    const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6', '#8B5CF6', '#14B8A6'];
    const radius = 35;
    const circ = 2 * Math.PI * radius;
    let offset = 0, circles = '', leg = '';
    cats.forEach((cat, i) => {
      const amt = catMap[cat];
      const pct = amt / total;
      const dash = pct * circ;
      const color = colors[i % colors.length];
      circles += `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)" />`;
      leg += `<div class="legend-item"><div style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${color};"></span><span>${esc(cat)}</span></div><strong>${fmt(amt)} (${Math.round(pct * 100)}%)</strong></div>`;
      offset += dash;
    });
    svg.innerHTML = circles;
    legend.innerHTML = leg;
  }

  function renderTrendBars() {
    const wrap = document.getElementById('trendBarChart');
    if (!wrap) return;
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const start = sod - i * DAY;
      const label = new Date(start).toLocaleDateString('en-US', { weekday: 'short' });
      const value = sum(D().transactions.filter(t => t.type === 'debit' && t.ts && t.ts >= start && t.ts < start + DAY));
      days.push({ label, value });
    }
    const max = Math.max(...days.map(d => d.value), 1);
    wrap.innerHTML = days.map(d => `
      <div class="trend-bar-col">
        <div class="trend-bar" style="height:${Math.round((d.value / max) * 100)}%;" title="${fmt(d.value)}"></div>
        <span class="trend-bar-label">${d.label}</span>
      </div>`).join('');
  }

  function renderCategoryBudgets() {
    const container = document.getElementById('categoryBudgetsContainer');
    if (!container) return;
    const spent = spendByCategory('month');
    container.innerHTML = Object.entries(D().budgetLimits).map(([cat, limit]) => {
      const s = spent[cat] || 0;
      const raw = limit > 0 ? Math.round((s / limit) * 100) : 0;
      const pct = Math.min(100, raw);
      const color = raw >= 85 ? 'rose' : raw >= 70 ? 'amber' : 'green';
      return `
        <div class="cat-budget-card">
          <div class="cat-budget-header">
            <span>${esc(cat)}</span>
            <span class="text-${color === 'green' ? 'emerald' : color}">${fmt(s)} / ${fmt(limit)}</span>
          </div>
          <div class="cat-progress-bg"><div class="cat-progress-fill ${color}" style="width:${pct}%;"></div></div>
          <div style="font-size:0.72rem;color:var(--text-mute);display:flex;justify-content:space-between;align-items:center;">
            <span>${raw}% consumed</span>
            <span>${fmt(Math.max(0, limit - s))} left <button class="tx-delete-btn edit-limit-btn" data-cat="${esc(cat)}" title="Edit limit" style="opacity:.8">✏️</button></span>
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('.edit-limit-btn').forEach(btn => {
      btn.addEventListener('click', e => editBudgetLimit(e.currentTarget.getAttribute('data-cat')));
    });
  }

  function editBudgetLimit(cat) {
    if (!state.isLoggedIn || !(cat in D().budgetLimits)) return;
    const input = prompt(`New monthly limit for ${cat} (₹):`, D().budgetLimits[cat]);
    if (input === null) return;
    const val = parseFloat(input);
    if (!isFinite(val) || val < 0) { showToast('Enter a valid amount'); return; }
    D().budgetLimits[cat] = Math.round(val);
    saveData();
    renderAll();
    showToast(`${cat} limit set to ${fmt(val)}`);
  }

  function renderSlide3() {
    renderChatThread();
    renderGoals();
    renderReminders();
  }

  function formatRich(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function renderChatThread() {
    const thread = document.getElementById('chatMessages');
    if (!thread) return;
    thread.innerHTML = state.chatMessages.map(msg => `
      <div class="chat-bubble ${msg.sender}">
        <div>${msg.sender === 'ai' ? formatRich(msg.text) : esc(msg.text)}</div>
        ${msg.card || ''}
      </div>`).join('');
    thread.scrollTop = thread.scrollHeight;
  }

  function renderGoals() {
    const container = document.getElementById('goalsContainer');
    if (!container) return;
    if (!D().goals.length) {
      container.innerHTML = '<div class="text-mute" style="font-size:0.82rem;">No goals yet. Tap “+ New Goal”.</div>';
      return;
    }
    container.innerHTML = D().goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
      const remaining = Math.max(0, g.target - g.saved);
      return `
        <div class="goal-card">
          <div class="goal-header"><span>${esc(g.icon)} ${esc(g.title)}</span><span class="text-amber">${fmt(g.saved)} / ${fmt(g.target)}</span></div>
          <div class="cat-progress-bg" style="margin:8px 0;"><div class="cat-progress-fill amber" style="width:${pct}%;"></div></div>
          <div class="goal-actions-row">
            <span style="font-size:0.72rem;color:var(--text-mute);">${pct}% (${remaining > 0 ? fmt(remaining) + ' to go' : 'Goal Completed! 🎉'})</span>
            <button class="btn-small-outline add-money-goal-btn" data-id="${esc(g.id)}">+ Add ₹200</button>
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('.add-money-goal-btn').forEach(btn => {
      btn.addEventListener('click', e => addMoneyToGoal(e.currentTarget.getAttribute('data-id'), 200));
    });
  }

  function renderReminders() {
    const container = document.getElementById('remindersContainer');
    if (!container) return;
    if (!D().reminders.length) {
      container.innerHTML = '<div class="text-mute" style="font-size:0.82rem;">No reminders. Tap “+ Add Reminder”.</div>';
      return;
    }
    container.innerHTML = D().reminders.map(r => `
      <div class="reminder-item">
        <div><strong>${esc(r.title)}</strong><div style="font-size:0.72rem;color:var(--text-mute);">Due: ${esc(prettyDate(r.date))}</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${r.amount > 0 ? `<span class="text-amber font-bold">${fmt(r.amount)}</span>` : '<span class="text-mute">Notice</span>'}
          <button class="tx-delete-btn delete-reminder-btn" data-id="${esc(r.id)}">🗑️</button>
        </div>
      </div>`).join('');
    container.querySelectorAll('.delete-reminder-btn').forEach(btn => {
      btn.addEventListener('click', e => deleteReminder(e.currentTarget.getAttribute('data-id')));
    });
  }

  function renderSlide4() {
    renderProfileCard();
    renderAccountsGrid();
    const manual = D().balanceMode === 'manual';
    const auto = document.getElementById('radioAutoBalance');
    const man = document.getElementById('radioManualBalance');
    if (auto) auto.checked = !manual;
    if (man) man.checked = manual;
    document.getElementById('manualBalanceInputGroup')?.classList.toggle('hidden', !manual);
    const field = document.getElementById('manualBalanceField');
    if (field) field.value = D().manualBalance;
    renderDatabaseViewer(state.dbTab);
  }

  function renderProfileCard() {
    const a = acct();
    const on = state.isLoggedIn && a;
    setText('profName', on ? a.name : 'Not signed in');
    setText('profEmail', on ? a.email : 'Sign in to view profile');
    setText('profRoleBadge', on ? `${a.role} Account` : 'Logged out');
    setText('profAvatar', on ? (a.icon || '👤') : '🔒');
  }

  function renderAccountsGrid() {
    const container = document.getElementById('accountsListContainer');
    if (!container) return;
    container.innerHTML = state.accounts.map(acc => {
      const isCurrent = state.isLoggedIn && acc.id === state.currentId;
      const badge = acc.role === 'Student' ? 'badge-amber' : acc.role === 'Parent' ? 'badge-rose' : 'badge-emerald';
      const bal = computeBalance(acc.id === state.currentId && state.isLoggedIn ? D() : normalizeData(lsGet(dataKey(acc.id), null), acc.allowance));
      return `
        <div class="account-card ${isCurrent ? 'active' : ''}">
          <div class="account-card-left">
            <div class="account-card-avatar">${esc(acc.icon || '👤')}</div>
            <div class="account-card-info">
              <div class="account-card-name">${esc(acc.name)}</div>
              <div class="account-card-meta"><span class="${badge}">${esc(acc.role)}</span><span>• Allowance: ${fmt(acc.allowance)}</span></div>
            </div>
          </div>
          <div class="account-card-right">
            <div class="account-card-balance">${fmt(bal)}</div>
            ${isCurrent ? '<span class="account-badge-active">Active</span>' : `
              <div style="display:flex;gap:4px;align-items:center;">
                <button class="account-btn-switch switch-acc-btn" data-id="${esc(acc.id)}">Switch</button>
                ${state.accounts.length > 1 ? `<button class="tx-delete-btn delete-acc-btn" data-id="${esc(acc.id)}" title="Remove Account">🗑️</button>` : ''}
              </div>`}
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('.switch-acc-btn').forEach(btn => {
      btn.addEventListener('click', e => openLoginModal(e.currentTarget.getAttribute('data-id')));
    });
    container.querySelectorAll('.delete-acc-btn').forEach(btn => {
      btn.addEventListener('click', e => deleteAccount(e.currentTarget.getAttribute('data-id')));
    });
  }

  function renderLoginAccountPills() {
    const container = document.getElementById('loginAccountsPillsContainer');
    if (!container) return;
    container.innerHTML = state.accounts.map(acc => `
      <button type="button" class="profile-select-pill ${acc.id === state.loginTargetId ? 'active' : ''}" data-id="${esc(acc.id)}">${esc(acc.icon || '👤')} ${esc(acc.name)}</button>`).join('');
    container.querySelectorAll('.profile-select-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        state.loginTargetId = e.currentTarget.getAttribute('data-id');
        const acc = state.accounts.find(a => a.id === state.loginTargetId);
        const emailInput = document.getElementById('loginEmail');
        if (emailInput && acc) emailInput.value = acc.email;
        container.querySelectorAll('.profile-select-pill').forEach(b => b.classList.toggle('active', b === e.currentTarget));
        setLoginError('');
        document.getElementById('loginPassword')?.focus();
      });
    });
  }

  function renderDatabaseViewer(collection) {
    const viewer = document.getElementById('dbJsonViewer');
    if (!viewer) return;
    state.dbTab = collection;
    let data = {};
    if (collection === 'users') {
      state.accounts.forEach(acc => {
        const live = acc.id === state.currentId && state.isLoggedIn;
        data[`users/${acc.id}`] = {
          uid: acc.id, name: acc.name, email: acc.email, role: acc.role,
          passwordHash: (acc.passHash || '').slice(0, 14) + '… [masked]',
          allowance: acc.allowance,
          balance: computeBalance(live ? D() : normalizeData(lsGet(dataKey(acc.id), null), acc.allowance)),
          deviceLinked: live
        };
      });
    } else if (!state.isLoggedIn) {
      data = { info: 'Sign in to inspect this collection.' };
    } else if (collection === 'budgetPeriods') {
      data = { period: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), activeAccount: acct()?.name, allowance: acct()?.allowance, limits: D().budgetLimits };
    } else if (collection === 'transactions') {
      data = { totalRecords: D().transactions.length, items: D().transactions.slice(0, 5) };
    } else if (collection === 'goals') {
      data = { goals: D().goals, reminders: D().reminders, edithMemory: D().edith };
    }
    viewer.textContent = JSON.stringify(data, null, 2);
  }

  // --------------------------------------------------------------------------
  // Authentication & multi-account management
  // --------------------------------------------------------------------------
  function setLoginError(msg) {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  function openLoginModal(targetId) {
    state.loginTargetId = targetId || state.currentId || state.accounts[0]?.id;
    const acc = state.accounts.find(a => a.id === state.loginTargetId);
    const email = document.getElementById('loginEmail');
    const pw = document.getElementById('loginPassword');
    if (email && acc) email.value = acc.email;
    if (pw) pw.value = '';
    setLoginError('');
    renderLoginAccountPills();
    openModal('loginModal');
    setTimeout(() => pw && pw.focus(), 50);
  }

  async function handleLoginSubmit() {
    const emailInput = document.getElementById('loginEmail');
    const pwInput = document.getElementById('loginPassword');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const pw = pwInput?.value || '';
    const acc = state.accounts.find(a => a.email.toLowerCase() === email) || state.accounts.find(a => a.id === state.loginTargetId);

    if (!acc) { setLoginError('No account found with that email.'); return; }
    if (!pw) { setLoginError('Please enter your password.'); return; }

    const att = state.attempts[acc.id] || { count: 0, until: 0 };
    if (att.until > Date.now()) {
      setLoginError(`Too many attempts. Try again in ${Math.ceil((att.until - Date.now()) / 1000)}s.`);
      return;
    }
    const ok = await verifyPassword(acc, pw);
    if (!ok) {
      att.count += 1;
      if (att.count >= MAX_ATTEMPTS) { att.until = Date.now() + LOCK_MS; att.count = 0; }
      state.attempts[acc.id] = att;
      playAudioChime('alert');
      setLoginError(att.until > Date.now() ? `Too many attempts. Locked for ${LOCK_MS / 1000}s.` : `Wrong password. ${MAX_ATTEMPTS - att.count} attempt(s) left.`);
      if (pwInput) pwInput.value = '';
      return;
    }
    state.attempts[acc.id] = { count: 0, until: 0 };
    loginAs(acc.id);
  }

  function loginAs(id) {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    if (state.isLoggedIn) saveData();
    state.currentId = id;
    state.data = loadAccountData(acc);
    state.isLoggedIn = true;
    state.edithCtx = null;
    resetChat();
    saveSession();
    closeModal('loginModal');
    const pw = document.getElementById('loginPassword');
    if (pw) pw.value = '';
    renderAll();
    playAudioChime('success');
    showToast(`Signed in as ${acc.name} (${acc.role})`);
  }

  function handleLogout() {
    saveData();
    state.isLoggedIn = false;
    state.data = defaultData(0);
    state.chatMessages = [];
    state.edithCtx = null;
    saveSession();
    renderAll();
    playAudioChime('alert');
    showToast('Signed out. All accounts remain safe in the database.');
    openLoginModal(state.currentId);
  }

  async function handleCreateAccount() {
    const val = id => (document.getElementById(id)?.value || '').trim();
    const err = msg => { const el = document.getElementById('addAccountError'); if (el) { el.textContent = msg; el.classList.toggle('hidden', !msg); } };
    const name = val('newAccountName');
    const email = val('newAccountEmail').toLowerCase();
    const role = val('newAccountRole') || 'Student';
    const pw = document.getElementById('newAccountPassword')?.value || '';
    const pw2 = document.getElementById('newAccountPassword2')?.value || '';
    const allowance = parseFloat(val('newAccountAllowance') || '0');
    const balRaw = val('newAccountBalance');
    const balance = balRaw === '' ? allowance : parseFloat(balRaw);

    if (name.length < 2) return err('Enter an account name (min 2 characters).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Enter a valid email address.');
    if (state.accounts.some(a => a.email.toLowerCase() === email)) return err('An account with this email already exists.');
    if (pw.length < 6) return err('Password must be at least 6 characters.');
    if (pw !== pw2) return err('Passwords do not match.');
    if (!isFinite(allowance) || allowance < 0) return err('Enter a valid monthly allowance.');
    if (!isFinite(balance) || balance < 0) return err('Enter a valid starting balance.');

    const salt = makeSalt();
    const acc = {
      id: 'usr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, email, role,
      icon: ROLE_ICONS[role] || '👤',
      allowance, savingsTarget: Math.round(allowance * 0.2),
      salt, passHash: await hashPassword(pw, salt),
      createdAt: new Date().toISOString().slice(0, 10)
    };
    state.accounts.push(acc);
    lsSet(dataKey(acc.id), defaultData(balance));
    saveAccounts();
    err('');
    ['newAccountName', 'newAccountEmail', 'newAccountPassword', 'newAccountPassword2', 'newAccountAllowance', 'newAccountBalance'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    closeModal('addAccountModal');
    closeModal('loginModal');
    loginAs(acc.id);
    showToast(`Account "${name}" created and saved to the database`);
  }

  async function deleteAccount(id) {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc || id === state.currentId) return;
    if (state.accounts.length <= 1) { showToast('At least one account must remain.'); return; }
    if (!confirm(`Permanently delete "${acc.name}" and ALL its data (transactions, goals, reminders)?`)) return;
    const pw = prompt(`Enter the password for ${acc.name} to confirm:`);
    if (pw === null) return;
    if (!(await verifyPassword(acc, pw))) { showToast('Wrong password. Account not deleted.'); return; }
    state.accounts = state.accounts.filter(a => a.id !== id);
    lsRemove(dataKey(id));
    saveAccounts();
    renderAll();
    showToast('Account deleted.');
  }

  // --------------------------------------------------------------------------
  // Ledger mutations
  // --------------------------------------------------------------------------
  function addTransactionToLedger(tx) {
    tx.ts = tx.ts || Date.now();
    D().transactions.unshift(tx);
    if (D().balanceMode === 'manual') {
      D().manualBalance = tx.type === 'debit' ? Math.max(0, D().manualBalance - tx.amount) : D().manualBalance + tx.amount;
    }
    saveData();
    renderAll();
  }

  function deleteTransaction(id) {
    const tx = D().transactions.find(t => t.id === id);
    if (tx && D().balanceMode === 'manual') {
      D().manualBalance = tx.type === 'debit' ? D().manualBalance + tx.amount : Math.max(0, D().manualBalance - tx.amount);
    }
    D().transactions = D().transactions.filter(t => t.id !== id);
    saveData();
    renderAll();
    showToast('Transaction deleted');
  }

  function addMoneyToGoal(id, amount) {
    const goal = D().goals.find(g => g.id === id);
    if (!goal) return;
    const before = goal.saved;
    goal.saved = Math.min(goal.target, goal.saved + amount);
    saveData();
    renderSlide3();
    showToast(`Added ${fmt(goal.saved - before)} to ${goal.title}`);
    if (before < goal.target && goal.saved >= goal.target) {
      playAudioChime('success');
      launchConfetti();
      showToast(`🎉 Goal Complete: ${goal.title}!`);
    }
  }

  function deleteReminder(id) {
    D().reminders = D().reminders.filter(r => r.id !== id);
    saveData();
    renderSlide3();
    showToast('Reminder removed');
  }

  // --------------------------------------------------------------------------
  // SMS / notification parsing
  // --------------------------------------------------------------------------
  function classifySmsText(text) {
    const lower = text.toLowerCase();
    const m = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i)
      || text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr|rupees)\b/i)
      || text.match(/(?:debited|credited|spent|paid)\s+(?:by|for|of)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const parsed = m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
    const amount = isFinite(parsed) && parsed > 0 ? parsed : null;

    const type = /credited|received|deposited|refund|cashback|salary|allowance/.test(lower) ? 'credit' : 'debit';

    let merchant = null, category = null, known = false;
    const aliases = (D() && D().edith && D().edith.aliases) || {};
    for (const [w, c] of Object.entries(aliases)) {
      if (new RegExp('\\b' + escRx(w) + '\\b').test(lower)) { merchant = cap(w); category = c; known = true; break; }
    }
    if (!known) {
      for (const km of KNOWN_MERCHANTS) {
        if (new RegExp('\\b(?:' + km.k + ')\\b').test(lower)) { merchant = km.n; category = km.c; known = true; break; }
      }
    }
    if (!known) {
      const g = text.match(/(?:\bat|\bto|\bfor|\bfrom)\s+([A-Za-z][A-Za-z0-9 &.'-]{1,25}?)(?=\s+(?:via|on|ref|upi|using|a\/c)\b|[.,]|$)/i);
      merchant = g ? g[1].trim() : 'UPI Payment';
      category = findCategory(lower, false) || 'Shopping';
      known = !!findCategory(lower, false);
    }
    if (type === 'credit' && /dad|mom|parent|allowance|family/.test(lower)) { merchant = 'Family Allowance UPI'; category = 'Allowance'; known = true; }
    if (type === 'credit' && category !== 'Allowance') category = 'Allowance';
    return { amount, merchant, category, type, known };
  }

  function handleIncomingNotification(app, text, amount, merchant, category, type) {
    if (!state.isLoggedIn) { showToast('Sign in first to record transactions.'); openLoginModal(); return; }
    if (!amount) { showToast("Couldn't find an amount in that text. Include e.g. 'Rs 250'."); return; }

    const banner = document.getElementById('headsUpBanner');
    if (banner) {
      setText('bannerApp', app);
      setText('bannerText', text);
      banner.classList.remove('hidden');
      clearTimeout(handleIncomingNotification._t);
      handleIncomingNotification._t = setTimeout(() => banner.classList.add('hidden'), 5000);
    }
    playAudioChime('success');

    D().notifications.unshift({ app, text, amount, type: type || 'debit', ts: Date.now() });
    D().notifications = D().notifications.slice(0, 30);
    D().unread = (D().unread || 0) + 1;

    addTransactionToLedger({
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amount, category: category || 'Shopping', merchant: merchant || 'UPI Payment',
      type: type || 'debit', isAi: true
    });
    showToast(`Captured: ${text.slice(0, 32)}${text.length > 32 ? '…' : ''}`);
  }

  function renderNotifications() {
    const list = document.getElementById('notifListContainer');
    if (!list) return;
    const items = state.isLoggedIn ? D().notifications : [];
    list.innerHTML = items.length ? items.map(n => `
      <div class="notif-item">
        <div><strong>${esc(n.app)}</strong><div class="text-mute" style="font-size:0.75rem;">${esc(n.text)}</div></div>
        <div class="${n.type === 'credit' ? 'text-emerald' : 'text-rose'}" style="font-weight:800;">${n.type === 'credit' ? '+' : '-'}${fmt(n.amount)}</div>
      </div>`).join('') : '<div class="text-mute" style="font-size:0.85rem;text-align:center;padding:16px;">No notifications yet. Try the ⚡ UPI Alert button.</div>';
  }

  // --------------------------------------------------------------------------
  // EDITH 2.5 — entity extraction
  // --------------------------------------------------------------------------
  function findCategory(t, useAliases = true) {
    if (useAliases && D() && D().edith) {
      for (const [w, c] of Object.entries(D().edith.aliases)) {
        if (new RegExp('\\b' + escRx(w) + '\\b').test(t)) return c;
      }
    }
    const tokens = new Set(t.match(/[a-z]+/g) || []);
    let best = null, bestN = 0;
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      const n = kws.filter(k => tokens.has(k)).length;
      if (n > bestN) { best = cat; bestN = n; }
    }
    return best;
  }

  function parseAmount(t) {
    const cleaned = t.replace(/\b(?:last|past|next)\s+\d+\s*(?:days?|weeks?|months?)\b/g, ' ').replace(/\b\d+\s*(?:days?|weeks?|months?)\b/g, ' ');
    const m = cleaned.match(/(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:(k|thousand|lakh|lac)\b)?/i);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n)) return null;
    const mult = (m[2] || '').toLowerCase();
    if (mult === 'k' || mult === 'thousand') n *= 1000;
    else if (mult === 'lakh' || mult === 'lac') n *= 100000;
    return n > 0 ? n : null;
  }

  function parsePeriod(t) {
    if (/\byesterday\b/.test(t)) return 'yesterday';
    if (/\b(today|tonight|this morning|this afternoon)\b/.test(t)) return 'today';
    if (/\b(this week|last 7 days|past 7 days|past week|last week|weekly)\b|\bweek\b/.test(t)) return 'week';
    if (/\b(last month|previous month)\b/.test(t)) return 'lastmonth';
    if (/\b(month|monthly)\b/.test(t)) return 'month';
    return null;
  }

  function findItem(t) {
    const tokens = t.match(/[a-z]+/g) || [];
    const known = tokens.find(w => ITEM_PRICES[w] != null);
    if (known) return known;
    const m = t.match(/\b(?:buy|get|order|purchase|afford|spend on|have|take|eat)\s+(?:a|an|the|some|new|my|any)?\s*([a-z][a-z' -]{1,28}?)(?=\s+(?:tonight|today|now|this|for|worth|please|tomorrow|at|from|\d)|$|[?.!,])/);
    if (m) {
      const w = m[1].trim();
      if (!/^(it|that|this|them|something|anything|one)$/.test(w)) return w;
    }
    return null;
  }

  function extractEntities(t) {
    return { amount: parseAmount(t), period: parsePeriod(t), cat: findCategory(t), item: findItem(t) };
  }

  // --------------------------------------------------------------------------
  // EDITH 2.5 — intent detection
  // --------------------------------------------------------------------------
  const RX = {
    greet: /^(hi|hello|hey|hii+|namaste|yo|good (morning|afternoon|evening))\b/,
    teach: /^(teach|learn|remember)\b/,
    learned: /what (have you|did you) (learn|learnt)|your memory|what do you know about me/,
    help: /\b(help|what can you (do|answer)|how do you work|commands|features)\b/,
    afford: /\b(can|could|should|shall|may|will) (i|we)\b.*\b(buy|afford|get|order|purchase|spend|eat|go|have|take)\b|\bafford\b|\bworth (it|buying)\b|\bis it (ok|okay|fine|safe) to\b/,
    forecast: /\b(forecast|predict|projection|project)\b|end of (the )?month|run out|last (till|until|me)|will .*last|enough money|month end/,
    rule: /50.?30.?20|\bneeds\b.*\bwants\b/,
    balance: /\bbalance\b|how much (money )?(do i have|is left|left|remains?)|money left|\bremaining\b|\bbacha\b|\bbaki\b/,
    daily: /\b(daily|per day|each day|a day|safe (limit|rate)|today'?s? (limit|budget))\b/,
    biggest: /\b(biggest|largest|highest|top|most expensive|maximum)\b/,
    recent: /\b(recent|latest|history)\b|last (few |\d+ )?(transactions?|payments?|expenses?)/,
    income: /\b(income|received|credited|earned|pocket money)\b|how much (did i get|allowance)/,
    goals: /\b(goals?|target|saved|savings goal)\b/,
    reminders: /\b(reminders?|due|upcoming|deadline|fees?)\b|bills? due/,
    budget: /\b(budgets?|limits?|over ?budget|exceed|overspend|overspent|cap)\b/,
    account: /\b(accounts?|profile|who am i|logged in|which user)\b/,
    summary: /\b(summary|overview|report|status|how am i doing|insights?|analysis|analy[sz]e)\b/,
    tips: /\b(save|saving|savings|tips?|advice|suggest|suggestions|reduce|cut down|cut back|economi[sz]e|frugal)\b/,
    spend: /\b(spent|spend|spending|expenses?|expenditure|kharch|kharcha|cost me|paid)\b|how much|\bkitna\b/,
    thanks: /\b(thanks|thank you|thx|great|awesome|nice|cool)\b/
  };

  function detectIntent(t, ent) {
    if (RX.greet.test(t)) return 'greet';
    if (RX.teach.test(t)) return 'teach';
    if (RX.learned.test(t)) return 'learned';
    if (/^(i |just |i've |ive )?(spent|paid|bought|add|log|record|had|got|received)\b/.test(t) && ent.amount) return 'addTx';
    if (RX.help.test(t)) return 'help';
    if (RX.afford.test(t)) return 'afford';
    if (RX.forecast.test(t)) return 'forecast';
    if (RX.rule.test(t)) return 'rule';
    if (RX.balance.test(t) && !/\bspent\b/.test(t)) return 'balance';
    if (RX.daily.test(t)) return 'daily';
    if (RX.biggest.test(t)) return 'biggest';
    if (RX.recent.test(t)) return 'recent';
    if (RX.goals.test(t)) return 'goals';
    if (RX.reminders.test(t)) return 'reminders';
    if (RX.budget.test(t)) return 'budget';
    if (RX.income.test(t)) return 'income';
    if (RX.account.test(t)) return 'account';
    if (RX.summary.test(t)) return 'summary';
    if (RX.tips.test(t)) return 'tips';
    if (RX.spend.test(t) || ent.cat) return 'spend';
    if (RX.thanks.test(t) && t.split(' ').length <= 5) return 'thanks';
    if (ent.item && ITEM_PRICES[ent.item] != null) return 'afford';
    return null;
  }

  function splitQuestions(q) {
    const parts = q.split(/[?;\n]+|\s+(?:and then|then|also|plus)\s+|\s+and\s+(?=(?:how|what|can|should|show|tell|am i|do i|is |when|which|why|list|will|where|spend|spent|spending|balance|budget|goals?|my |forecast|summary|saving|savings|dues|reminders?|income|biggest|recent|daily|safe))/i)
      .map(s => s && s.trim()).filter(s => s && s.length > 1);
    return parts.length ? parts : [q.trim()];
  }

  // --------------------------------------------------------------------------
  // EDITH 2.5 — answer builders
  // --------------------------------------------------------------------------
  const verdict = (kind, title, inner) => `<div class="verdict-card ${kind}"><strong>${title}</strong><div style="margin-top:4px;">${inner}</div></div>`;
  const ul = rows => '<ul style="padding-left:18px;line-height:1.6;">' + rows.map(r => `<li>${r}</li>`).join('') + '</ul>';

  function topGroups(txs, keyFn, n = 3) {
    const m = {};
    txs.forEach(t => { const k = keyFn(t); m[k] = (m[k] || 0) + t.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  function runIntent(intent, ent, t) {
    const fin = calculateFinancials();
    const first = (acct()?.name || 'there').split(' ')[0];
    const label = PERIOD_LABEL[ent.period || 'month'];

    switch (intent) {
      case 'greet':
        return { reply: `Hi ${first}! Your balance is ${fmt(fin.balance)} with a safe limit of ${fmt(fin.safeDailyLimit)}/day. Ask me anything — or several things at once!`, card: null };

      case 'thanks':
        return { reply: 'Happy to help! Ask me anything else about your money.', card: null };

      case 'help': {
        const card = verdict('safe', '🤖 What EDITH can do', ul([
          '<strong>Afford it?</strong> “Can I buy ₹1,500 shoes?”',
          '<strong>Spending:</strong> “How much on food this week?”',
          '<strong>Balance &amp; limits:</strong> “Balance? Daily limit? Budget status?”',
          '<strong>Forecast:</strong> “Will my money last till month end?”',
          '<strong>Goals, dues, tips, summary, biggest expense, recent transactions</strong>',
          '<strong>Add entries:</strong> “I spent 150 on chai”',
          '<strong>Teach me:</strong> “teach: maggi = food”',
          '<strong>Multi-questions:</strong> “Balance and spending on transport?”'
        ]));
        return { reply: 'Here is what I can do — I also understand several questions in one message.', card };
      }

      case 'teach': {
        const m = t.match(/^(?:teach|learn|remember)\s*(?:that|:)?\s*(.+?)\s*(?:=|->|→|\bas\b|\bmeans\b|\bis\b)\s*(.+)$/);
        if (!m) return { reply: 'Teach me like this: *teach: maggi = food* (categories: food, transport, books, entertainment, shopping, bills, health).', card: null };
        const word = m[1].replace(/["']/g, '').trim();
        const cat = findCategory(m[2], false);
        if (!word || word.length > 30 || /^\d+$/.test(word)) return { reply: 'Please give me a short word or merchant name to learn.', card: null };
        if (!cat) return { reply: `I couldn't map "${m[2]}" to a category. Try food, transport, books, entertainment, shopping, bills or health.`, card: null };
        D().edith.aliases[word] = cat;
        saveData();
        return { reply: `Learned! From now on "${word}" means **${cat}** — in chat, SMS parsing and the classifier.`, card: verdict('safe', '🧠 EDITH learned something new', `<strong>${esc(word)}</strong> → ${esc(cat)}`) };
      }

      case 'learned': {
        const al = Object.entries(D().edith.aliases);
        const un = D().edith.unanswered;
        const rows = al.map(([w, c]) => `<strong>${esc(w)}</strong> → ${esc(c)}`);
        const card = verdict('safe', '🧠 EDITH memory', (rows.length ? ul(rows) : 'No custom words yet.') + (un.length ? `<div style="margin-top:6px;">Questions I couldn't answer yet: ${un.slice(-5).map(esc).join(' • ')}</div>` : ''));
        return { reply: `I know ${al.length} custom word(s) and have ${un.length} unanswered question(s) logged.`, card };
      }

      case 'addTx': {
        const credit = /\b(received|got|credited|income|allowance)\b/.test(t);
        const cat = credit ? 'Allowance' : (ent.cat || 'Shopping');
        const kw = (t.match(/\b(?:on|for|at|to|from)\s+(?:a|an|the|my)?\s*([a-z][a-z ]{1,20})/) || [])[1];
        const merchant = cap((kw || ent.item || cat).trim().replace(/\s+(today|yesterday|tonight)$/, ''));
        addTransactionToLedger({ id: `tx-${Date.now()}`, amount: ent.amount, category: cat, merchant, type: credit ? 'credit' : 'debit', isAi: true });
        const f2 = calculateFinancials();
        return {
          reply: `Recorded ${credit ? '+' : '-'}${fmt(ent.amount)} under **${cat}** (${merchant}). New balance: ${fmt(f2.balance)}.`,
          card: verdict(credit ? 'safe' : 'caution', '✅ Ledger updated', ul([`${esc(merchant)} — ${fmt(ent.amount)}`, `Balance now ${fmt(f2.balance)}; safe rate ${fmt(f2.safeDailyLimit)}/day`, 'Wrong entry? Delete it from the Ledger.']))
        };
      }

      case 'afford': {
        let cost = ent.amount, est = false;
        const item = ent.item;
        if (!cost && item && ITEM_PRICES[item] != null) { cost = ITEM_PRICES[item]; est = true; }
        if (!cost) return { reply: 'How much does it cost? Try: *“Can I buy ₹1,500 shoes?”*', card: null };
        const dues = upcomingDues();
        const reserve = dues + 500;
        const after = fin.balance - cost;
        const newDaily = Math.max(0, Math.round(after / fin.daysRemaining));
        const cat = ent.cat || (item ? findCategory(item) : null);
        const rows = [
          `Price${est ? ' (typical estimate)' : ''}: <strong>${fmt(cost)}</strong>${item ? ' — ' + esc(item) : ''}`,
          `Balance ${fmt(fin.balance)} → <strong>${after < 0 ? 'short by ' + fmt(-after) : fmt(after)}</strong> after buying`,
          `Safe daily rate ${fmt(fin.safeDailyLimit)} → <strong>${fmt(newDaily)}</strong> for ${fin.daysRemaining} days`
        ];
        if (dues) rows.push(`Upcoming dues to keep aside: ${fmt(dues)}`);
        let catOver = false;
        if (cat && D().budgetLimits[cat]) {
          const left = D().budgetLimits[cat] - (spendByCategory('month')[cat] || 0);
          rows.push(`${esc(cat)} budget left: ${fmt(Math.max(0, left))}`);
          if (cost > left) catOver = true;
        }
        const goal = item && D().goals.find(g => g.title.toLowerCase().includes(item.split(' ')[0]));
        if (goal) rows.push(`Goal “${esc(goal.title)}”: ${fmt(goal.saved)} of ${fmt(goal.target)} saved already`);

        let kind, title, advice, reply;
        if (after < 0) {
          kind = 'danger'; title = '🔴 Not affordable';
          advice = 'You do not have enough balance. Add it to Savings Goals instead.';
          reply = `No — ${fmt(cost)} is more than your balance of ${fmt(fin.balance)}.`;
        } else if (after < reserve) {
          kind = 'danger'; title = '🔴 Not advised';
          advice = `It would leave ${fmt(after)}, below the ${fmt(reserve)} you need for dues and a safety buffer.`;
          reply = `I'd skip it. After buying you'd have ${fmt(after)}, less than the ${fmt(reserve)} buffer for upcoming dues.`;
        } else if (cost > fin.balance * 0.3 || newDaily < fin.safeDailyLimit * 0.5 || catOver) {
          kind = 'caution'; title = '🟡 Possible, but it hurts';
          advice = catOver ? 'It exceeds that category budget for the month.' : 'It takes a big bite out of your daily budget. Consider saving for it over a few weeks.';
          reply = `You can afford it, but it cuts your daily limit from ${fmt(fin.safeDailyLimit)} to ${fmt(newDaily)}${catOver ? ' and exceeds your category budget' : ''}.`;
        } else {
          kind = 'safe'; title = '🟢 Safe to buy';
          advice = 'It fits comfortably within your budget.';
          reply = `Yes! ${fmt(cost)} is comfortably affordable. Your daily limit would stay around ${fmt(newDaily)}.`;
        }
        return { reply, card: verdict(kind, title, ul(rows) + `<em>${advice}</em>`) };
      }

      case 'spend': {
        const key = ent.period || 'month';
        const txs = D().transactions.filter(x => x.type === 'debit' && inRange(x, key) && (!ent.cat || x.category === ent.cat));
        const total = sum(txs);
        if (!txs.length) return { reply: `No ${ent.cat ? ent.cat + ' ' : ''}spending recorded ${label}.`, card: null };
        const rows = [`Total: <strong>${fmt(total)}</strong> across ${txs.length} payment(s)`];
        topGroups(txs, x => x.merchant).forEach(([m, v]) => rows.push(`${esc(m)}: ${fmt(v)}`));
        if (!ent.cat) rows.push('Top categories: ' + topGroups(txs, x => x.category).map(([c, v]) => `${esc(c)} ${fmt(v)}`).join(', '));
        if (ent.cat && key === 'month' && D().budgetLimits[ent.cat]) {
          const lim = D().budgetLimits[ent.cat];
          rows.push(`Budget: ${fmt(total)} of ${fmt(lim)} (${Math.round((total / lim) * 100)}%)`);
        }
        let tip = '';
        if (ent.cat === 'Travel & Commute' && txs.some(x => /uber|ola|rapido|cab/i.test(x.merchant))) tip = '<em>💡 A Metro Smart Card instead of cabs can save ~₹700/month.</em>';
        return { reply: `You spent ${fmt(total)}${ent.cat ? ' on ' + ent.cat : ''} ${label} (${txs.length} payments).`, card: verdict('safe', `${CATEGORY_ICONS[ent.cat] || '📊'} ${esc(ent.cat || 'All')} spending ${label}`, ul(rows) + tip) };
      }

      case 'balance': {
        const rows = [`Balance: <strong>${fmt(fin.balance)}</strong> (${D().balanceMode === 'manual' ? 'manual override' : 'auto from ledger'})`, `Safe daily limit: ${fmt(fin.safeDailyLimit)} for ${fin.daysRemaining} days`];
        const dues = upcomingDues();
        if (dues) rows.push(`Upcoming dues: ${fmt(dues)} → free after dues ${fmt(Math.max(0, fin.balance - dues))}`);
        return { reply: `Your balance is ${fmt(fin.balance)}; you can safely spend about ${fmt(fin.safeDailyLimit)}/day.`, card: verdict('safe', '💰 Balance snapshot', ul(rows)) };
      }

      case 'daily': {
        const today = sum(D().transactions.filter(x => x.type === 'debit' && inRange(x, 'today')));
        const left = fin.safeDailyLimit - today;
        return {
          reply: `Your safe limit is ${fmt(fin.safeDailyLimit)}/day. You've spent ${fmt(today)} today, so ${left >= 0 ? fmt(left) + ' is left' : 'you are over by ' + fmt(-left)}.`,
          card: verdict(left >= 0 ? 'safe' : 'caution', '📅 Daily limit', ul([`Safe limit: ${fmt(fin.safeDailyLimit)}`, `Spent today: ${fmt(today)}`, `${left >= 0 ? 'Left today' : 'Over by'}: ${fmt(Math.abs(left))}`]))
        };
      }

      case 'forecast': {
        const day = new Date().getDate();
        const spent = fin.totalExpenses;
        const avg = spent / Math.max(1, day);
        const projectedTotal = Math.round(avg * fin.totalDays);
        const endBalance = fin.balance - avg * fin.daysRemaining;
        const runOut = avg > 0 ? Math.floor(fin.balance / avg) : Infinity;
        const dues = upcomingDues();
        const kind = endBalance < 0 ? 'danger' : endBalance < dues ? 'caution' : 'safe';
        const rows = [`Average spend: ${fmt(avg)}/day so far`, `Projected month total: ${fmt(projectedTotal)}`, `Projected balance at month end: <strong>${fmt(Math.max(0, endBalance))}</strong>`];
        if (isFinite(runOut) && runOut < fin.daysRemaining) rows.push(`⚠️ Money could run out in ~${runOut} day(s)`);
        return {
          reply: endBalance < 0 ? `At this pace you'd run out in about ${runOut} days. Try to keep spending under ${fmt(fin.safeDailyLimit)}/day.` : `At your current pace you'd end the month with about ${fmt(endBalance)}.`,
          card: verdict(kind, '🔮 Month-end forecast', ul(rows))
        };
      }

      case 'biggest': {
        const key = ent.period || 'month';
        const txs = D().transactions.filter(x => x.type === 'debit' && inRange(x, key) && (!ent.cat || x.category === ent.cat)).sort((a, b) => b.amount - a.amount).slice(0, 3);
        if (!txs.length) return { reply: `No expenses found ${label}.`, card: null };
        return { reply: `Your biggest expense ${label} was ${fmt(txs[0].amount)} at ${txs[0].merchant}.`, card: verdict('safe', '🏆 Biggest expenses', ul(txs.map(x => `${esc(x.merchant)} — ${fmt(x.amount)} (${esc(x.category)})`))) };
      }

      case 'recent': {
        const txs = D().transactions.slice(0, 5);
        if (!txs.length) return { reply: 'No transactions yet.', card: null };
        return { reply: `Your last ${txs.length} transactions are below.`, card: verdict('safe', '🧾 Recent transactions', ul(txs.map(x => `${x.type === 'credit' ? '+' : '-'}${fmt(x.amount)} ${esc(x.merchant)} — ${esc(formatTxDate(x))}`))) };
      }

      case 'income': {
        const key = ent.period || 'month';
        const txs = D().transactions.filter(x => x.type === 'credit' && inRange(x, key));
        const total = sum(txs);
        if (!txs.length) return { reply: `No income recorded ${label}.`, card: null };
        return { reply: `You received ${fmt(total)} ${label}.`, card: verdict('safe', '💵 Income', ul(txs.map(x => `${esc(x.merchant)} — ${fmt(x.amount)}`))) };
      }

      case 'goals': {
        let goals = D().goals;
        if (ent.item) { const f = goals.filter(g => g.title.toLowerCase().includes(ent.item.split(' ')[0])); if (f.length) goals = f; }
        if (!goals.length) return { reply: 'You have no savings goals yet. Add one from the Goals section.', card: null };
        const rows = goals.map(g => {
          const left = Math.max(0, g.target - g.saved);
          const pct = g.target ? Math.round((g.saved / g.target) * 100) : 0;
          return `${esc(g.icon)} ${esc(g.title)}: ${pct}% — ${left ? fmt(left) + ' to go (~' + Math.ceil(left / 500) + ' weeks at ₹500/week)' : 'done 🎉'}`;
        });
        return { reply: `You have ${goals.length} goal(s); ${fmt(sum(goals.map(g => ({ amount: g.saved }))))} saved so far.`, card: verdict('safe', '🎯 Savings goals', ul(rows)) };
      }

      case 'reminders': {
        if (!D().reminders.length) return { reply: 'No reminders set.', card: null };
        const dues = upcomingDues();
        return {
          reply: `You have ${D().reminders.length} reminder(s) with ${fmt(dues)} due in total.`,
          card: verdict(dues > fin.balance ? 'danger' : 'safe', '⏰ Upcoming dues', ul(D().reminders.map(r => `${esc(r.title)} — ${r.amount > 0 ? fmt(r.amount) : 'notice'} (${esc(prettyDate(r.date))})`)))
        };
      }

      case 'budget': {
        const spent = spendByCategory('month');
        const rows = Object.entries(D().budgetLimits).map(([c, lim]) => ({ c, s: spent[c] || 0, lim, p: lim ? Math.round(((spent[c] || 0) / lim) * 100) : 0 })).sort((a, b) => b.p - a.p);
        const hot = rows.filter(r => r.p >= 70);
        const list = (ent.cat ? rows.filter(r => r.c === ent.cat) : rows.slice(0, 4));
        return {
          reply: hot.length ? `${hot.length} categor${hot.length > 1 ? 'ies are' : 'y is'} above 70% of budget — watch ${hot[0].c} (${hot[0].p}%).` : 'All categories are comfortably within budget.',
          card: verdict(hot.length ? 'caution' : 'safe', '📊 Budget status', ul(list.map(r => `${esc(r.c)}: ${fmt(r.s)} / ${fmt(r.lim)} (${r.p}%)`)))
        };
      }

      case 'rule': {
        const r = get503020();
        return { reply: `Needs ${r.pNeeds}%, wants ${r.pWants}%, savings ${r.pSavings}% (target 50/30/20).`, card: verdict(r.pWants > 30 || r.pNeeds > 50 ? 'caution' : 'safe', '⚖️ 50/30/20 check', ul([`Needs: ${fmt(r.needs)} (${r.pNeeds}%)`, `Wants: ${fmt(r.wants)} (${r.pWants}%)`, `Savings: ${fmt(r.savings)} (${r.pSavings}%)`])) };
      }

      case 'account': {
        const a = acct();
        const others = state.accounts.filter(x => x.id !== a.id);
        return {
          reply: `You're signed in as ${a.name} (${a.role}). There ${others.length === 1 ? 'is' : 'are'} ${others.length} other account(s) on this device.`,
          card: verdict('safe', '👤 Accounts', ul([`Active: ${esc(a.name)} — ${fmt(fin.balance)}`].concat(others.map(o => `${esc(o.name)} — ${fmt(computeBalance(normalizeData(lsGet(dataKey(o.id), null), o.allowance)))}`)).concat(['Switch from the Account &amp; DB tab (password required).'])))
        };
      }

      case 'summary': {
        const txs = monthTx().filter(x => x.type === 'debit');
        const top = topGroups(txs, x => x.category);
        const rows = [`Spent: ${fmt(fin.totalExpenses)} of ${fmt(fin.allowance)} allowance (${Math.round((fin.totalExpenses / (fin.allowance || 1)) * 100)}%)`, `Income: ${fmt(fin.totalIncome)}`, `Balance: ${fmt(fin.balance)} • safe ${fmt(fin.safeDailyLimit)}/day`];
        if (top.length) rows.push('Top categories: ' + top.map(([c, v]) => `${esc(c)} ${fmt(v)}`).join(', '));
        if (D().reminders.length) rows.push(`Dues ahead: ${fmt(upcomingDues())}`);
        return { reply: `This month you've spent ${fmt(fin.totalExpenses)} and have ${fmt(fin.balance)} left.`, card: verdict('safe', '📋 Monthly summary', ul(rows)) };
      }

      case 'tips': {
        const txs = monthTx().filter(x => x.type === 'debit');
        const tips = [];
        const delivery = txs.filter(x => /swiggy|zomato/i.test(x.merchant));
        if (delivery.length) tips.push(`<strong>Cut food delivery:</strong> ${delivery.length} orders cost ${fmt(sum(delivery))}. Skipping half saves ~${fmt(sum(delivery) / 2)}.`);
        const cabs = txs.filter(x => /uber|ola|rapido/i.test(x.merchant));
        if (cabs.length) tips.push(`<strong>Use the Metro card:</strong> ${cabs.length} cab ride(s) cost ${fmt(sum(cabs))}.`);
        const spent = spendByCategory('month');
        const hot = Object.entries(D().budgetLimits).filter(([c, l]) => l && (spent[c] || 0) / l >= 0.7);
        if (hot.length) tips.push(`<strong>Watch ${esc(hot[0][0])}:</strong> already ${Math.round(((spent[hot[0][0]] || 0) / hot[0][1]) * 100)}% of its budget.`);
        const near = D().goals.filter(g => g.saved < g.target).sort((a, b) => (b.saved / b.target) - (a.saved / a.target))[0];
        if (near) tips.push(`<strong>Finish a goal:</strong> ${fmt(near.target - near.saved)} more completes “${esc(near.title)}”.`);
        tips.push('<strong>24-hour rule:</strong> wait a day before buying clothes or tech.');
        tips.push(`<strong>Pay yourself first:</strong> move unspent daily budget (${fmt(fin.safeDailyLimit)}) into Goals.`);
        return { reply: `Here are ${tips.length} personalised ways to save, based on your own spending.`, card: verdict('safe', '💡 EDITH saving protocol', ul(tips.slice(0, 5))) };
      }

      default:
        return null;
    }
  }

  function answerOne(raw) {
    const t = raw.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
    let ent = extractEntities(t);
    let intent = detectIntent(t, ent);

    // Follow-ups: "what about transport?", "and yesterday?", "what about 5000?"
    if (!intent && state.edithCtx && (ent.cat || ent.period || ent.amount)) {
      intent = state.edithCtx.intent;
      const prev = state.edithCtx.ent;
      ent = { amount: ent.amount || prev.amount, period: ent.period || prev.period, cat: ent.cat || prev.cat, item: ent.item || prev.item };
    }
    if (!intent) return null;

    const result = runIntent(intent, ent, t);
    if (result && !['greet', 'thanks', 'help', 'teach', 'learned', 'addTx'].includes(intent)) state.edithCtx = { intent, ent };
    return result;
  }

  function answerQuery(query) {
    const parts = splitQuestions(query);
    const results = [];
    parts.forEach(p => {
      const r = answerOne(p);
      if (r) results.push(r);
      else {
        const un = D().edith.unanswered;
        if (!un.includes(p)) { un.push(p); D().edith.unanswered = un.slice(-30); saveData(); }
        results.push({
          reply: `I'm not sure about "${p}" yet. Try asking about balance, spending, budgets, goals, dues or "Can I buy ₹500 shoes?". You can also teach me: *teach: maggi = food*.`,
          card: null
        });
      }
    });
    if (results.length === 1) return results[0];
    return {
      reply: results.map((r, i) => `**${i + 1}.** ${r.reply}`).join('\n'),
      card: results.map(r => r.card || '').join('')
    };
  }

  function resetChat() {
    const first = (acct()?.name || 'there').split(' ')[0];
    state.chatMessages = [{
      sender: 'ai',
      text: `👋 Greetings ${first}! I am **EDITH** (AI 2.5), your campus financial intelligence system.\n\nAsk me anything, even several things at once: *"Balance and spending on food this week?"*, *"Can I buy ₹4,000 headphones?"*, *"Will my money last till month end?"* — or type **help**.`
    }];
  }

  function handleSendChat(customQuery = null) {
    if (!state.isLoggedIn) { showToast('Sign in to chat with EDITH'); openLoginModal(); return; }
    const input = document.getElementById('chatInput');
    const query = (customQuery || (input ? input.value : '')).trim();
    if (!query) return;
    if (input) input.value = '';
    state.chatMessages.push({ sender: 'user', text: query });
    renderChatThread();

    setTimeout(() => {
      if (!state.isLoggedIn) return;
      const result = answerQuery(query);
      state.chatMessages.push({ sender: 'ai', text: result.reply, card: result.card });
      renderChatThread();
      if (state.ttsEnabled && window.speechSynthesis && window.SpeechSynthesisUtterance) {
        window.speechSynthesis.cancel();
        const plain = result.reply.replace(/\*\*?/g, '').replace(/\n/g, '. ');
        const u = new SpeechSynthesisUtterance(plain);
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }
    }, 350);
  }

  // --------------------------------------------------------------------------
  // Modal helpers
  // --------------------------------------------------------------------------
  function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

  // --------------------------------------------------------------------------
  // Event listeners
  // --------------------------------------------------------------------------
  function initEventListeners() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    const requireLogin = fn => (...a) => { if (!state.isLoggedIn) { showToast('Please sign in first.'); openLoginModal(); return; } fn(...a); };

    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget.getAttribute('data-target');
        state.activeTab = target;
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelectorAll('.tab-slide').forEach(s => s.classList.remove('active'));
        document.getElementById(target)?.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    on('themeToggleBtn', 'click', () => { state.isDarkMode = !state.isDarkMode; savePrefs(); renderThemeAndLayout(); });
    on('frameToggleBtn', 'click', () => { state.isMobileFrame = !state.isMobileFrame; savePrefs(); renderThemeAndLayout(); });
    on('aiBackBtn', 'click', () => document.querySelector('.nav-tab[data-target="slide-1"]')?.click());

    on('quickUpiBtn', 'click', requireLogin(() => {
      const s = SAMPLE_UPI_NOTIFICATIONS[Math.floor(Math.random() * SAMPLE_UPI_NOTIFICATIONS.length)];
      handleIncomingNotification(s.app, s.text, s.amount, s.merchant, s.category, s.flow);
    }));
    on('bannerDismissBtn', 'click', () => document.getElementById('headsUpBanner')?.classList.add('hidden'));

    // Notification bell
    on('notifBellBtn', 'click', requireLogin(() => {
      renderNotifications();
      openModal('notifModal');
      D().unread = 0;
      saveData();
      renderHeader();
    }));
    on('closeNotifModalBtn', 'click', () => closeModal('notifModal'));
    on('clearNotifBtn', 'click', () => { D().notifications = []; D().unread = 0; saveData(); renderNotifications(); renderHeader(); });

    // Balance mode
    on('editBalanceBtn', 'click', () => document.querySelector('.nav-tab[data-target="slide-4"]')?.click());
    on('radioAutoBalance', 'change', requireLogin(() => { D().balanceMode = 'auto'; saveData(); renderAll(); showToast('Switched to Automatic Ledger Balance'); }));
    on('radioManualBalance', 'change', requireLogin(() => {
      D().balanceMode = 'manual';
      D().manualBalance = computeBalance({ ...D(), balanceMode: 'auto' });
      saveData(); renderAll(); showToast('Switched to Manual Balance Override (deducts on spend)');
    }));
    on('saveManualBalanceBtn', 'click', requireLogin(() => {
      const val = parseFloat(document.getElementById('manualBalanceField')?.value || '');
      if (!isFinite(val) || val < 0) { showToast('Enter a valid balance'); return; }
      D().manualBalance = val;
      D().balanceMode = 'manual';
      saveData(); renderAll(); playAudioChime('success');
      showToast(`Manual balance set to ${fmt(val)}. New expenses will cut from this.`);
    }));

    on('safeLogoutBtn', 'click', requireLogin(handleLogout));
    on('switchProfileBtn', 'click', () => openLoginModal());

    document.querySelectorAll('.db-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        renderDatabaseViewer(e.currentTarget.getAttribute('data-db'));
      });
    });
    on('copyDbJsonBtn', 'click', () => {
      const text = document.getElementById('dbJsonViewer')?.textContent || '';
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
      showToast('Database JSON copied to clipboard');
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.activeFilter = e.currentTarget.getAttribute('data-filter');
        renderTransactionList();
      });
    });
    on('txSearchInput', 'input', e => { state.searchQuery = e.target.value; renderTransactionList(); });

    // Sensors
    on('webOtpBtn', 'click', requireLogin(async () => {
      if ('credentials' in navigator && 'OTPCredential' in window) {
        showToast('Waiting for incoming Android SMS via WebOTP...');
        try {
          const content = await navigator.credentials.get({ otp: { transport: ['sms'] }, signal: new AbortController().signal });
          if (content && content.code) {
            const parsed = classifySmsText(content.code);
            showToast(`WebOTP SMS captured: ${content.code}`);
            if (parsed.amount) handleIncomingNotification('WebOTP SMS', content.code, parsed.amount, parsed.merchant, parsed.category, parsed.type);
          }
        } catch (err) { showToast('WebOTP timed out or cancelled'); }
      } else {
        showToast('WebOTP works on Android Chrome. Simulating a demo SMS...');
        setTimeout(() => handleIncomingNotification('SMS Gateway', 'A/c debited by Rs 220 for Swiggy UPI ref 492102', 220, 'Swiggy', 'Food & Dining', 'debit'), 1000);
      }
    }));

    on('readClipboardBtn', 'click', requireLogin(async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('unsupported');
        const text = await navigator.clipboard.readText();
        if (!text.trim()) { showToast('Clipboard is empty. Copy an SMS or alert first!'); return; }
        const p = classifySmsText(text);
        handleIncomingNotification('Clipboard Sensor', text, p.amount, p.merchant, p.category, p.type);
      } catch (err) { showToast('Clipboard permission needed. Use the paste box instead!'); }
    }));

    on('parseSmsBtn', 'click', requireLogin(() => {
      const box = document.getElementById('smsInputBox');
      const text = (box?.value || '').trim();
      if (!text) { showToast('Paste SMS text first!'); return; }
      const p = classifySmsText(text);
      handleIncomingNotification('SMS Parser', text, p.amount, p.merchant, p.category, p.type);
      if (p.amount && box) box.value = '';
    }));
    on('smsInputBox', 'keydown', e => { if (e.key === 'Enter') document.getElementById('parseSmsBtn')?.click(); });

    document.querySelectorAll('.pill-tag').forEach(pill => {
      pill.addEventListener('click', requireLogin(e => {
        const text = e.currentTarget.getAttribute('data-text');
        const p = classifySmsText(text);
        handleIncomingNotification('Preset SMS', text, p.amount, p.merchant, p.category, p.type);
      }));
    });

    on('merchantTestBtn', 'click', () => {
      const text = (document.getElementById('merchantTestInput')?.value || '').trim();
      const res = document.getElementById('merchantTestResult');
      if (!text || !res) return;
      const p = classifySmsText(text);
      res.classList.remove('hidden');
      res.innerHTML = `
        <strong>EDITH Classification Preview:</strong><br>
        Merchant: <code>${esc(p.merchant)}</code><br>
        Category: <strong>${esc(p.category)}</strong><br>
        Confidence: ${p.known ? '<span class="text-emerald">High (rule / learned match)</span>' : '<span class="text-amber">Low — defaulted. Teach EDITH: “teach: word = category”</span>'}`;
    });

    // Voice
    let recognition = null;
    const micBtn = document.getElementById('micBtn');
    const micLabel = document.getElementById('micLabel');
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';
      recognition.onstart = () => { micBtn?.classList.add('listening'); if (micLabel) micLabel.textContent = 'EDITH is Listening...'; };
      recognition.onresult = e => { const tr = e.results[0][0].transcript; if (micLabel) micLabel.textContent = `"${tr}"`; handleSendChat(tr); };
      const reset = () => { micBtn?.classList.remove('listening'); if (micLabel) micLabel.textContent = 'Tap to Speak with EDITH'; };
      recognition.onend = reset;
      recognition.onerror = reset;
    }
    micBtn?.addEventListener('click', () => {
      if (!recognition) { showToast('Speech recognition is not supported in this browser. Type below!'); return; }
      try { recognition.start(); } catch (e) { recognition.stop(); }
    });
    on('ttsVoiceToggle', 'change', e => { state.ttsEnabled = e.target.checked; if (!e.target.checked && window.speechSynthesis) window.speechSynthesis.cancel(); });

    document.querySelectorAll('.chip-btn').forEach(chip => chip.addEventListener('click', e => handleSendChat(e.currentTarget.getAttribute('data-query'))));
    on('sendChatBtn', 'click', () => handleSendChat());
    on('chatInput', 'keydown', e => { if (e.key === 'Enter') handleSendChat(); });

    // Modals
    [['openAddTxModalBtn', 'addTxModal'], ['openAddGoalModalBtn', 'addGoalModal'], ['openAddReminderModalBtn', 'addReminderModal']].forEach(([btn, modal]) => on(btn, 'click', requireLogin(() => openModal(modal))));
    on('openBridgeModalBtn', 'click', () => openModal('bridgeModal'));
    on('closeAddTxModalBtn', 'click', () => closeModal('addTxModal'));
    on('closeAddGoalModalBtn', 'click', () => closeModal('addGoalModal'));
    on('closeAddReminderModalBtn', 'click', () => closeModal('addReminderModal'));
    on('closeBridgeModalBtn', 'click', () => closeModal('bridgeModal'));

    const closeLogin = () => { if (state.isLoggedIn) closeModal('loginModal'); else showToast('Sign in to continue.'); };
    on('loginCloseBtn', 'click', closeLogin);
    on('loginBackBtn', 'click', closeLogin);

    // Multi-account
    const openAdd = () => { const e = document.getElementById('addAccountError'); if (e) e.classList.add('hidden'); openModal('addAccountModal'); };
    on('openAddAccountModalBtn', 'click', openAdd);
    on('openCreateFromLoginBtn', 'click', openAdd);
    on('closeAddAccountModalBtn', 'click', () => closeModal('addAccountModal'));
    on('addAccountBackBtn', 'click', () => closeModal('addAccountModal'));
    on('saveAccountBtn', 'click', handleCreateAccount);
    on('submitLoginBtn', 'click', handleLoginSubmit);
    on('loginPassword', 'keydown', e => { if (e.key === 'Enter') handleLoginSubmit(); });
    on('loginEmail', 'keydown', e => { if (e.key === 'Enter') handleLoginSubmit(); });

    // Close modals with Escape / overlay click (login modal stays while logged out)
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => { if (m.id !== 'loginModal' || state.isLoggedIn) m.classList.add('hidden'); });
    });
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('mousedown', e => {
      if (e.target === m && (m.id !== 'loginModal' || state.isLoggedIn)) m.classList.add('hidden');
    }));

    // Add transaction
    let txType = 'debit';
    on('txTypeDebit', 'click', () => { txType = 'debit'; document.getElementById('txTypeDebit')?.classList.add('active'); document.getElementById('txTypeCredit')?.classList.remove('active'); });
    on('txTypeCredit', 'click', () => { txType = 'credit'; document.getElementById('txTypeCredit')?.classList.add('active'); document.getElementById('txTypeDebit')?.classList.remove('active'); });
    on('saveTxBtn', 'click', requireLogin(() => {
      const amount = parseFloat(document.getElementById('newTxAmount')?.value || '0');
      const merchant = (document.getElementById('newTxMerchant')?.value || '').trim() || 'Manual Entry';
      const category = document.getElementById('newTxCategory')?.value || 'Food & Dining';
      if (!isFinite(amount) || amount <= 0) { showToast('Please enter a valid amount'); return; }
      addTransactionToLedger({ id: `tx-${Date.now()}`, amount, merchant, category: txType === 'credit' ? 'Allowance' : category, type: txType, isAi: false });
      closeModal('addTxModal');
      ['newTxAmount', 'newTxMerchant'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      playAudioChime('success');
      showToast(`Transaction recorded: ${txType === 'debit' ? '-' : '+'}${fmt(amount)}`);
    }));

    on('saveGoalBtn', 'click', requireLogin(() => {
      const title = (document.getElementById('newGoalTitle')?.value || '').trim() || 'New Goal';
      const target = parseFloat(document.getElementById('newGoalTarget')?.value || '');
      const initial = parseFloat(document.getElementById('newGoalInitial')?.value || '0') || 0;
      if (!isFinite(target) || target <= 0) { showToast('Enter a valid target amount'); return; }
      D().goals.push({ id: `g-${Date.now()}`, title, target, saved: Math.min(Math.max(0, initial), target), icon: '🎯' });
      saveData(); closeModal('addGoalModal'); renderSlide3(); playAudioChime('success'); showToast('Goal created');
      ['newGoalTitle', 'newGoalTarget'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }));

    on('saveReminderBtn', 'click', requireLogin(() => {
      const title = (document.getElementById('newReminderTitle')?.value || '').trim() || 'New Reminder';
      const amount = parseFloat(document.getElementById('newReminderAmount')?.value || '0') || 0;
      const date = document.getElementById('newReminderDate')?.value || 'Soon';
      D().reminders.push({ id: `r-${Date.now()}`, title, amount: Math.max(0, amount), date });
      saveData(); closeModal('addReminderModal'); renderSlide3(); playAudioChime('success'); showToast('Reminder added');
      ['newReminderTitle', 'newReminderAmount'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }));

    on('simulateBridgeTestBtn', 'click', requireLogin(() => {
      closeModal('bridgeModal');
      handleIncomingNotification('MacroDroid Webhook', 'PhonePe: Paid ₹340 to DMRC Metro Smart Card', 340, 'Metro Smart Card', 'Travel & Commute', 'debit');
    }));

    // Export (never includes password hashes)
    on('exportJsonBtn', 'click', requireLogin(() => {
      const a = acct();
      const payload = { account: { id: a.id, name: a.name, email: a.email, role: a.role, allowance: a.allowance }, data: D(), exportedAt: new Date().toISOString() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'campus_ledger_export.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Ledger JSON exported');
    }));

    on('resetDemoBtn', 'click', async () => {
      if (!confirm('Reset EVERYTHING (all accounts, passwords and data) back to the demo defaults?')) return;
      try { Object.keys(localStorage).filter(k => k.startsWith('cl_')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
      await bootstrap();
      state.isDarkMode = true;
      savePrefs();
      renderAll();
      openLoginModal(state.currentId);
      showToast(`Reset to demo data. Demo password: ${DEMO_PASSWORD}`);
    });
  }

  // --------------------------------------------------------------------------
  // Entry point
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    await bootstrap();
    initEventListeners();
    renderAll();
    if (!state.isLoggedIn) openLoginModal(state.currentId);
    console.log('🎓 Campus Ledger (EDITH AI 2.5) initialized.');
  });
})();
