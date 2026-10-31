'use strict';

/* ============================== Константы ============================== */

const STORE_KEY = 'monetka.v1';
const COLORS = ['#f03e3e', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#82c91e', '#fab005', '#fd7e14', '#a9672f', '#868e96'];
const FREQ = { none: 'Не повторять', daily: 'Каждый день', weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год' };
const ACC_TYPES = { card: 'Карта', cash: 'Наличные', bank: 'Банковский счёт', savings: 'Накопления', credit: 'Кредитка' };
const ACC_ICONS = { card: 'credit-card', cash: 'banknote', bank: 'landmark', savings: 'piggy-bank', credit: 'credit-card' };
const TX_TYPES = { expense: 'Расход', income: 'Доход', transfer: 'Перевод' };
const PERIODS = { this: 'Этот месяц', prev: 'Прошлый месяц', '3m': '3 месяца', year: 'Этот год', lastyear: 'Прошлый год', custom: 'Свой период' };
// Для данных, сохранённых старой версией с эмодзи вместо векторных иконок.
const EMOJI_TO_ICON = {
  '🛒': 'shopping-cart', '☕': 'utensils', '🚌': 'bus', '⛽': 'car', '🏠': 'house', '💡': 'lightbulb', '📱': 'smartphone',
  '💊': 'heart-pulse', '👕': 'shirt', '🎬': 'film', '🎁': 'gift', '📚': 'graduation-cap', '✈️': 'plane', '🔁': 'repeat',
  '📦': 'package', '💼': 'banknote', '💻': 'laptop', '📈': 'percent', '💰': 'circle-dollar-sign', '🏷️': 'tag',
  '🏖️': 'plane', '🛟': 'piggy-bank', '🎯': 'target',
};

/* ============================== Утилиты ============================== */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const nowStamp = () => { const d = new Date(); return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const monthOf = (s) => s.slice(0, 7);
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const monthEnd = (mk) => { const [y, m] = mk.split('-').map(Number); return `${mk}-${pad(daysInMonth(y, m))}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseAmount = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const round2 = (n) => Math.round(n * 100) / 100;
const $ = (sel, root = document) => root.querySelector(sel);

function icon(name, cls = '') {
  return ICONS[name] ? `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>` : '';
}
const glyph = (name) => (ICONS[name] ? icon(name) : esc(name || '?'));
const badge = (iconName, color, size = '') => `<span class="cico ${size}" style="background:${color}">${glyph(iconName)}</span>`;

function shiftMonth(mk, delta) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
  return s[0].toUpperCase() + s.slice(1);
}

const shortDate = (s) => parseISO(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: monthOf(s).slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' });

function dayLabel(s) {
  const t = today();
  if (s === t) return 'Сегодня';
  if (s === addDays(t, -1)) return 'Вчера';
  if (s === addDays(t, 1)) return 'Завтра';
  const d = parseISO(s);
  const opts = { day: 'numeric', month: 'long', weekday: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('ru-RU', opts);
}

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const fmt = (amount) => money.format(round2(amount));

function fmtShort(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${round2(n / 1e6)} млн`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} тыс`;
  return String(Math.round(n));
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

/* ============================== Данные ============================== */

function defaultCategories() {
  const exp = [
    ['Продукты', 'shopping-cart', '#fd7e14'], ['Кафе и рестораны', 'utensils', '#f03e3e'], ['Транспорт', 'bus', '#fab005'],
    ['Авто', 'car', '#15aabf'], ['Жильё', 'house', '#a9672f'], ['Коммунальные', 'lightbulb', '#82c91e'],
    ['Связь и интернет', 'smartphone', '#228be6'], ['Здоровье', 'heart-pulse', '#e64980'], ['Одежда', 'shirt', '#be4bdb'],
    ['Развлечения', 'film', '#7950f2'], ['Подарки', 'gift', '#f03e3e'], ['Образование', 'graduation-cap', '#4c6ef5'],
    ['Путешествия', 'plane', '#15aabf'], ['Подписки', 'repeat', '#868e96'], ['Работа', 'briefcase', '#4c6ef5'], ['Прочее', 'package', '#868e96'],
  ];
  const inc = [['Зарплата', 'banknote', '#12b886'], ['Подработка', 'laptop', '#40c057'], ['Подарки', 'gift', '#e64980'], ['Проценты', 'percent', '#228be6'], ['Прочее', 'circle-dollar-sign', '#82c91e']];
  return [
    ...exp.map(([name, ic, color]) => ({ id: uid(), type: 'expense', name, icon: ic, color })),
    ...inc.map(([name, ic, color]) => ({ id: uid(), type: 'income', name, icon: ic, color })),
  ];
}

function emptyDb() {
  return {
    version: 2,
    accounts: [],
    categories: defaultCategories(),
    transactions: [],
    budgets: [],
    recurring: [],
    labels: [],
    goals: [],
    debts: [],
    reminders: [],
    notified: {},
    settings: { theme: 'auto' },
  };
}

function demoDb() {
  const d = emptyDb();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const between = (a, b) => Math.round(a + rnd() * (b - a));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const cat = (name, type = 'expense') => d.categories.find((c) => c.name === name && c.type === type).id;

  const card = { id: uid(), name: 'Основная карта', type: 'card', initial: 42000, color: '#4c6ef5' };
  const cash = { id: uid(), name: 'Наличные', type: 'cash', initial: 6000, color: '#12b886' };
  const save = { id: uid(), name: 'Накопления', type: 'savings', initial: 140000, color: '#be4bdb' };
  d.accounts.push(card, cash, save);

  const work = { id: uid(), name: 'Работа', color: '#228be6' };
  const family = { id: uid(), name: 'Семья', color: '#e64980' };
  const vacation = { id: uid(), name: 'Отпуск', color: '#fd7e14' };
  d.labels.push(work, family, vacation);

  const tx = (type, accountId, amount, categoryId, date, note = '', labels) =>
    d.transactions.push({ id: uid(), type, accountId, amount, categoryId, date, note, ...(labels ? { labels } : {}) });

  const workNotes = [
    ['Такси на встречу с клиентом', 450, 1400], ['Канцелярия для офиса', 300, 1800], ['Обед с клиентом', 1800, 4500],
    ['Курьерская доставка документов', 350, 900], ['Печать презентации', 200, 700], ['Парковка у бизнес-центра', 200, 600],
    ['Билеты на конференцию', 3500, 9000], ['Подписка на сервис для работы', 590, 1490], ['Кофе на переговорах', 300, 900],
  ];

  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const s = iso(day);
    const dom = day.getDate();
    const weekday = day.getDay() > 0 && day.getDay() < 6;
    if (dom === 5) tx('income', card.id, 95000, cat('Зарплата', 'income'), s, 'Зарплата');
    if (dom === 20) tx('income', card.id, 40000, cat('Зарплата', 'income'), s, 'Аванс');
    if (dom === 1) tx('expense', card.id, 35000, cat('Жильё'), s, 'Аренда квартиры');
    if (dom === 10) tx('expense', card.id, between(4800, 6900), cat('Коммунальные'), s, 'ЖКУ за прошлый месяц');
    if (dom === 15) tx('expense', card.id, 650, cat('Связь и интернет'), s, 'Мобильная связь');
    if (dom === 12) tx('expense', card.id, 399, cat('Подписки'), s, 'Музыкальный сервис');
    if (dom === 6) d.transactions.push({ id: uid(), type: 'transfer', accountId: card.id, toAccountId: save.id, amount: 9200, date: s, note: 'Откладываю' });
    if (dom === 18 && day.getMonth() % 2 === 0) tx('income', card.id, between(8000, 15000), cat('Подработка', 'income'), s, 'Проект по договору');
    if (rnd() < 0.45) tx('expense', rnd() < 0.8 ? card.id : cash.id, between(600, 3800), cat('Продукты'), s, pick(['Супермаркет', 'Рынок', 'Продукты у дома', '']));
    if (rnd() < 0.25) tx('expense', rnd() < 0.6 ? card.id : cash.id, between(250, 1800), cat('Кафе и рестораны'), s, pick(['Кофе', 'Ужин', 'Пицца с друзьями']));
    if (weekday && rnd() < 0.7) tx('expense', card.id, between(1, 3) * 63, cat('Транспорт'), s, 'Метро');
    if (weekday && rnd() < 0.22) { const [note, a, b] = pick(workNotes); tx('expense', card.id, between(a, b), cat('Работа'), s, note, [work.id]); }
    if (rnd() < 0.06) tx('expense', card.id, between(1500, 4200), cat('Авто'), s, 'Бензин');
    if (rnd() < 0.07) tx('expense', card.id, between(500, 3500), cat('Развлечения'), s, pick(['Кино', 'Концерт', 'Боулинг']));
    if (rnd() < 0.04) tx('expense', card.id, between(800, 4500), cat('Здоровье'), s, 'Аптека');
    if (rnd() < 0.03) tx('expense', card.id, between(2500, 9000), cat('Одежда'), s, pick(['Куртка', 'Кроссовки', 'Футболки']));
    if (rnd() < 0.02) tx('expense', cash.id, between(1000, 5000), cat('Подарки'), s, 'Подарок на день рождения', [family.id]);
    if (dom === 8 || dom === 25) d.transactions.push({ id: uid(), type: 'transfer', accountId: card.id, toAccountId: cash.id, amount: 8000, date: s, note: 'Снял наличные' });
  }

  d.budgets.push(
    { id: uid(), categoryId: null, limit: 150000 },
    { id: uid(), categoryId: cat('Продукты'), limit: 35000 },
    { id: uid(), categoryId: cat('Кафе и рестораны'), limit: 9000 },
    { id: uid(), categoryId: cat('Работа'), limit: 10000 },
    { id: uid(), categoryId: cat('Транспорт'), limit: 4000 },
  );

  const t = today();
  const next = (dom) => iso(new Date(end.getFullYear(), end.getMonth() + 1, dom));
  d.recurring.push(
    { id: uid(), freq: 'monthly', day: 1, next: next(1), active: true, remind: true, template: { type: 'expense', accountId: card.id, amount: 35000, categoryId: cat('Жильё'), note: 'Аренда квартиры' } },
    { id: uid(), freq: 'monthly', day: 12, next: next(12), active: true, remind: true, template: { type: 'expense', accountId: card.id, amount: 399, categoryId: cat('Подписки'), note: 'Музыкальный сервис' } },
  );

  const inMonths = (n) => iso(new Date(end.getFullYear(), end.getMonth() + n, 1));
  d.goals.push(
    { id: uid(), name: 'Отпуск на море', icon: 'plane', color: '#15aabf', target: 150000, saved: 62000, deadline: inMonths(7) },
    { id: uid(), name: 'Новый ноутбук', icon: 'laptop', color: '#7950f2', target: 120000, saved: 18000, deadline: inMonths(10) },
    { id: uid(), name: 'Подушка безопасности', icon: 'piggy-bank', color: '#40c057', target: 300000, saved: 300000, deadline: '', done: true },
  );
  d.debts.push(
    { id: uid(), kind: 'lent', person: 'Алексей', amount: 15000, date: addDays(t, -40), due: addDays(t, 5), note: 'На ремонт машины', payments: [{ id: uid(), date: addDays(t, -10), amount: 5000 }] },
    { id: uid(), kind: 'borrowed', person: 'Мама', amount: 30000, date: addDays(t, -70), due: '', note: '', payments: [{ id: uid(), date: addDays(t, -35), amount: 10000 }, { id: uid(), date: addDays(t, -5), amount: 10000 }] },
  );
  const dom20 = end.getDate() <= 20 ? iso(new Date(end.getFullYear(), end.getMonth(), 20)) : iso(new Date(end.getFullYear(), end.getMonth() + 1, 20));
  d.reminders.push(
    { id: uid(), title: 'Записать наличные траты за день', note: '', date: t, time: '21:00', repeat: 'daily', active: true },
    { id: uid(), title: 'Передать показания счётчиков', note: 'Вода и электричество', date: dom20, time: '19:00', repeat: 'monthly', day: 20, active: true },
    { id: uid(), title: 'Продлить страховку автомобиля', note: '', date: inMonths(2), time: '10:00', repeat: 'yearly', active: true },
  );
  d.isDemo = true;
  return d;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* повреждённые данные или недоступное хранилище — начинаем с демо */ }
  return demoDb();
}

function normalize(d) {
  const base = emptyDb();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  for (const k of ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'labels', 'goals', 'debts', 'reminders']) if (!Array.isArray(out[k])) out[k] = [];
  // Валют больше нет, всё в рублях: поля прежних мультивалютных версий отбрасываются.
  delete out.base; delete out.rates;
  for (const x of [...out.accounts, ...out.debts]) delete x.currency;
  for (const t of out.transactions) delete t.toAmount;
  if (!out.notified || typeof out.notified !== 'object') out.notified = {};
  if (!out.deleted || typeof out.deleted !== 'object') out.deleted = {};
  for (const x of [...out.categories, ...out.goals]) if (x.icon && EMOJI_TO_ICON[x.icon]) x.icon = EMOJI_TO_ICON[x.icon];
  for (const g of out.goals) if (!ICONS[g.icon]) g.icon = 'target';
  for (const dbt of out.debts) if (!Array.isArray(dbt.payments)) dbt.payments = [];
  if ((d.version || 1) < 2 && !out.categories.some((c) => c.type === 'expense' && c.name === 'Работа')) {
    out.categories.push({ id: uid(), type: 'expense', name: 'Работа', icon: 'briefcase', color: '#4c6ef5' });
  }
  out.version = 2;
  return out;
}

function save() {
  Sync.stamp(db);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch { toast('Не удалось сохранить: хранилище браузера недоступно'); }
  Sync.schedule();
}

let db = load();
const ui = {
  view: 'overview', month: monthOf(today()), acc: '', type: '', label: '', q: '',
  catTab: 'expense', planTab: 'budgets', statsTab: 'analytics',
  rep: { type: 'expense', cat: '', label: '', acc: '', period: 'prev', from: '', to: '', sort: 'date' },
};

/* ============================== Расчёты ============================== */

const accById = (id) => db.accounts.find((a) => a.id === id);
const catById = (id) => db.categories.find((c) => c.id === id);
const labelById = (id) => db.labels.find((l) => l.id === id);
const debtPaid = (d) => d.payments.reduce((s, p) => s + p.amount, 0);
const debtLeft = (d) => round2(d.amount - debtPaid(d));

/** Изменение общего баланса от операции (перевод между своими счетами его не меняет). */
function txDelta(t) {
  if (t.type === 'income') return t.amount;
  if (t.type === 'expense') return -t.amount;
  return 0;
}

/** Остатки на счетах на сегодня: операции с будущей датой ещё не списаны и не зачислены. */
function balances() {
  const b = Object.fromEntries(db.accounts.map((a) => [a.id, Number(a.initial) || 0]));
  const now = today();
  for (const t of db.transactions) {
    if (!(t.accountId in b) || t.date > now) continue;
    if (t.type === 'income') b[t.accountId] += t.amount;
    else if (t.type === 'expense') b[t.accountId] -= t.amount;
    else {
      b[t.accountId] -= t.amount;
      if (t.toAccountId in b) b[t.toAccountId] += t.amount;
    }
  }
  return b;
}

function totalBalance(bal = balances()) {
  return db.accounts.filter((a) => !a.archived).reduce((s, a) => s + bal[a.id], 0);
}

const txInMonth = (mk) => db.transactions.filter((t) => monthOf(t.date) === mk);
const txInRange = (from, to) => db.transactions.filter((t) => t.date >= from && t.date <= to);

function totals(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, net: income - expense };
}
const monthTotals = (mk) => totals(txInMonth(mk));

function byCategory(list, type) {
  const m = new Map();
  for (const t of list) {
    if (t.type !== type) continue;
    m.set(t.categoryId || '', (m.get(t.categoryId || '') || 0) + t.amount);
  }
  return [...m].map(([id, value]) => {
    const c = catById(id);
    return { id, value, label: c?.name || 'Без категории', color: c?.color || '#adb5bd', icon: c?.icon || 'circle-help' };
  }).sort((a, b) => b.value - a.value);
}

function budgetSpent(b, mk) {
  return txInMonth(mk)
    .filter((t) => t.type === 'expense' && (b.categoryId == null || t.categoryId === b.categoryId))
    .reduce((s, t) => s + t.amount, 0);
}

function addFreq(s, freq, anchorDay) {
  const d = parseISO(s);
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else {
    const y = d.getFullYear() + (freq === 'yearly' ? 1 : 0);
    const m = d.getMonth() + (freq === 'monthly' ? 1 : 0);
    const first = new Date(y, m, 1);
    const day = Math.min(anchorDay || d.getDate(), daysInMonth(first.getFullYear(), first.getMonth() + 1));
    return iso(new Date(first.getFullYear(), first.getMonth(), day));
  }
  return iso(d);
}

/** Создаёт операции по регулярным платежам, срок которых наступил. */
function processRecurring() {
  const t = today();
  let created = 0;
  for (const r of db.recurring) {
    if (!r.active) continue;
    let guard = 0;
    while (r.next <= t && guard++ < 1000) {
      if (accById(r.template.accountId)) {
        db.transactions.push({ ...r.template, id: uid(), date: r.next, recurringId: r.id });
        created++;
      }
      r.next = addFreq(r.next, r.freq, r.day);
    }
  }
  if (created) { save(); toast(`Добавлено регулярных операций: ${created}`); }
}

function periodRange(rep) {
  const t = today(), mk = monthOf(t), y = t.slice(0, 4);
  switch (rep.period) {
    case 'this': return { from: `${mk}-01`, to: monthEnd(mk), label: monthLabel(mk) };
    case 'prev': { const p = shiftMonth(mk, -1); return { from: `${p}-01`, to: monthEnd(p), label: monthLabel(p) }; }
    case '3m': { const p = shiftMonth(mk, -2); return { from: `${p}-01`, to: monthEnd(mk), label: `${monthLabel(p)} — ${monthLabel(mk)}` }; }
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} год` };
    case 'lastyear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `${y - 1} год` };
    default: {
      const from = rep.from || `${mk}-01`, to = rep.to || t;
      const sameMonth = monthOf(from) === monthOf(to) && from.endsWith('-01') && to === monthEnd(monthOf(to));
      return { from, to, label: sameMonth ? monthLabel(monthOf(from)) : `${shortDate(from)} — ${shortDate(to)}` };
    }
  }
}

/* ============================== Напоминания ============================== */

const reminderStamp = (r) => `${r.date}T${r.time || '09:00'}`;
const isDue = (r) => r.active && reminderStamp(r) <= nowStamp();

/** Ближайшие события: напоминания, регулярные платежи, сроки долгов. */
function upcoming(days = 14) {
  const t = today(), until = addDays(t, days);
  const items = [];
  for (const r of db.reminders) {
    if (r.active && r.date <= until) items.push({ kind: 'reminder', id: r.id, date: r.date, time: r.time, title: r.title, sub: r.note || FREQ[r.repeat || 'none'], icon: 'bell', color: '#fab005', due: isDue(r) });
  }
  for (const r of db.recurring) {
    if (!r.active || r.next > until) continue;
    const c = catById(r.template.categoryId);
    items.push({ kind: 'recurring', id: r.id, date: r.next, title: r.template.note || c?.name || 'Регулярный платёж', sub: `${TX_TYPES[r.template.type]} · ${fmt(r.template.amount)}`, icon: c?.icon || 'repeat', color: c?.color || '#868e96' });
  }
  for (const d of db.debts) {
    if (!d.due || debtLeft(d) <= 0 || d.due > until) continue;
    items.push({ kind: 'debt', id: d.id, date: d.due, title: d.kind === 'lent' ? `${d.person} возвращает долг` : `Вернуть долг: ${d.person}`, sub: fmt(debtLeft(d)), icon: 'hand-coins', color: d.kind === 'lent' ? '#12b886' : '#f03e3e', due: d.due < t });
  }
  return items.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

async function notify(title, body, tag) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg' });
    else new Notification(title, { body, tag, icon: 'icon.svg' });
  } catch { /* уведомления недоступны — остаётся баннер в приложении */ }
}

/** Проверяет напоминания и шлёт уведомления; вызывается при запуске и раз в 30 секунд. */
function checkReminders() {
  const stamp = nowStamp(), t = today();
  let changed = false;
  const fire = (key, title, body) => {
    if (db.notified[key]) return;
    db.notified[key] = t;
    changed = true;
    notify(title, body, key);
  };
  for (const r of db.reminders) if (isDue(r)) fire(`rem:${r.id}:${reminderStamp(r)}`, r.title, r.note || 'Напоминание Монетки');
  for (const r of db.recurring) {
    if (r.active && r.remind && `${addDays(r.next, -1)}T10:00` <= stamp) {
      fire(`rec:${r.id}:${r.next}`, `Завтра платёж: ${r.template.note || catById(r.template.categoryId)?.name || ''}`, fmt(r.template.amount));
    }
  }
  for (const d of db.debts) {
    if (d.due && debtLeft(d) > 0 && `${d.due}T10:00` <= stamp) {
      fire(`debt:${d.id}:${d.due}`, d.kind === 'lent' ? `${d.person} должен вернуть долг` : `Срок возврата долга: ${d.person}`, fmt(debtLeft(d)));
    }
  }
  // Старые отметки об отправленных уведомлениях больше не нужны.
  const cutoff = addDays(t, -60);
  for (const [k, v] of Object.entries(db.notified)) if (v < cutoff) { delete db.notified[k]; changed = true; }
  if (changed) save();
  return changed;
}

function completeReminder(r) {
  if (r.repeat && r.repeat !== 'none') {
    let guard = 0;
    do { r.date = addFreq(r.date, r.repeat, r.day); } while (reminderStamp(r) <= nowStamp() && guard++ < 1000);
    toast(`Следующее напоминание: ${dayLabel(r.date)}`);
  } else {
    r.active = false;
    toast('Напоминание выполнено');
  }
}

/* ============================== Графики ============================== */

function donut(items, size = 170, center = '') {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 62, c = 2 * Math.PI * r, gap = items.length > 1 ? 1.5 : 0;
  let off = 0;
  const arcs = total > 0
    ? items.map((i) => {
      const len = (i.value / total) * c;
      const el = `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${i.color}" stroke-width="20"
        stroke-dasharray="${Math.max(len - gap, 0.1)} ${c - Math.max(len - gap, 0.1)}" stroke-dashoffset="${-off}"><title>${esc(i.label)}: ${esc(fmt(i.value))}</title></circle>`;
      off += len;
      return el;
    }).join('')
    : `<circle r="${r}" cx="80" cy="80" fill="none" stroke="var(--surface-2)" stroke-width="20"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 160 160" role="img" aria-label="Диаграмма по категориям">
    <g transform="rotate(-90 80 80)">${arcs}</g>
    <text x="80" y="75" text-anchor="middle" font-size="11" fill="var(--muted)">Всего</text>
    <text x="80" y="95" text-anchor="middle" font-size="16" font-weight="800" fill="var(--text)">${esc(center)}</text>
  </svg>`;
}

function legend(items, { limit = 8, link } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const shown = items.slice(0, limit);
  const rest = items.slice(limit).reduce((s, i) => s + i.value, 0);
  if (rest > 0) shown.push({ id: null, label: 'Остальное', value: rest, color: '#adb5bd', icon: 'ellipsis' });
  return `<div class="legend">${shown.map((i) => `
    <div class="li" ${link && i.id !== null ? `data-act="report-cat" data-id="${esc(i.id)}" data-type="${link.type}" ${link.month ? `data-month="${link.month}"` : ''} title="Открыть список операций"` : ''}>
      ${badge(i.icon, i.color, 'sm')}<span>${esc(i.label)}</span>
      <span class="v num">${esc(fmt(i.value))}</span><span class="p num">${Math.round((i.value / total) * 100)}%</span></div>`).join('')}</div>`;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((x) => x >= v);
}

function barChart(data) {
  const W = 620, H = 230, L = 52, B = 26, T = 10;
  const max = niceMax(Math.max(...data.flatMap((d) => [d.income, d.expense]), 0));
  const gw = (W - L) / data.length, bw = Math.min(22, gw / 3);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    s += `<line class="grid-line" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtShort(v)}</text>`;
  }
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2;
    s += `<rect x="${cx - bw - 2}" y="${y(d.income)}" width="${bw}" height="${y(0) - y(d.income)}" rx="4" fill="var(--income)"><title>Доходы: ${esc(fmt(d.income))}</title></rect>`;
    s += `<rect x="${cx + 2}" y="${y(d.expense)}" width="${bw}" height="${y(0) - y(d.expense)}" rx="4" fill="var(--expense)"><title>Расходы: ${esc(fmt(d.expense))}</title></rect>`;
    s += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Доходы и расходы по месяцам">${s}</svg></div>
    <div class="small muted" style="display:flex;gap:16px;margin-top:6px">
      <span><span class="dot" style="background:var(--income)"></span> Доходы</span>
      <span><span class="dot" style="background:var(--expense)"></span> Расходы</span></div>`;
}

function lineChart(points) {
  const W = 620, H = 200, L = 52, B = 24, T = 10;
  const vals = points.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.1;
  lo -= padv; hi += padv;
  const x = (i) => L + ((W - L - 8) * i) / Math.max(points.length - 1, 1);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let s = '<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".28"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>';
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) / 3) * i;
    s += `<line class="grid-line" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtShort(v)}</text>`;
  }
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  s += `<path d="${path}L${x(points.length - 1)},${H - B}L${x(0)},${H - B}Z" fill="url(#lg)"/>`;
  s += `<path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const step = Math.ceil(points.length / 6);
  points.forEach((p, i) => { if (i % step === 0 || i === points.length - 1) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Динамика баланса">${s}</svg></div>`;
}

/** Ежедневный общий баланс в течение месяца (до сегодняшнего дня). */
function balanceSeries(mk) {
  const [y, m] = mk.split('-').map(Number);
  const startS = `${mk}-01`;
  const lastDay = monthOf(today()) === mk ? new Date().getDate() : daysInMonth(y, m);
  let bal = db.accounts.reduce((s, a) => s + (Number(a.initial) || 0), 0);
  const perDay = new Map();
  for (const t of db.transactions) {
    if (t.date < startS) bal += txDelta(t);
    else if (monthOf(t.date) === mk) perDay.set(t.date, (perDay.get(t.date) || 0) + txDelta(t));
  }
  const pts = [];
  for (let d = 1; d <= lastDay; d++) {
    const s = `${mk}-${pad(d)}`;
    bal += perDay.get(s) || 0;
    pts.push({ label: String(d), v: bal });
  }
  return pts;
}

/* ============================== Общие фрагменты ============================== */

function topbar(title, sub = '', right = '', extra = '') {
  return `<header class="topbar"><div class="row1"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <div class="toolbar">${right}</div></div>${extra}</header>`;
}

function monthNav() {
  return `<div class="month-nav"><button data-act="month" data-d="-1" aria-label="Предыдущий месяц">${icon('chevron-left')}</button>
    <span>${monthLabel(ui.month)}</span><button data-act="month" data-d="1" aria-label="Следующий месяц">${icon('chevron-right')}</button></div>`;
}

const emptyState = (ic, text, action = '') => `<div class="empty">${icon(ic)}${text}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;

function tagsHtml(t) {
  return (t.labels || []).map(labelById).filter(Boolean)
    .map((l) => `<span class="tag" style="color:${l.color};background:${l.color}1f">${esc(l.name)}</span>`).join('');
}

function txRow(t) {
  const acc = accById(t.accountId);
  let b, title, sub, amt, cls;
  if (t.type === 'transfer') {
    const to = accById(t.toAccountId);
    b = badge('arrow-left-right', '#868e96');
    title = 'Перевод';
    sub = `${acc?.name || '—'} → ${to?.name || '—'}${t.note ? ' · ' + t.note : ''}`;
    amt = fmt(t.amount); cls = '';
  } else {
    const c = catById(t.categoryId);
    b = badge(c?.icon || 'circle-help', c?.color || '#adb5bd');
    title = c?.name || 'Без категории';
    sub = [t.note, acc?.name].filter(Boolean).join(' · ');
    amt = (t.type === 'income' ? '+' : '−') + fmt(t.amount);
    cls = t.type === 'income' ? 'pos' : 'neg';
  }
  const tags = tagsHtml(t);
  if (t.date > today()) { sub = `Запланировано · ${sub}`; cls = 'muted'; }
  return `<li class="row" data-act="edit-tx" data-id="${t.id}">${b}
    <span class="mid"><div class="t">${esc(title)}${t.recurringId ? ` <span class="muted" title="Регулярный платёж">${icon('repeat')}</span>` : ''}</div><div class="s">${esc(sub)}</div>${tags ? `<div class="tags">${tags}</div>` : ''}</span>
    <span class="amt num ${cls}">${esc(amt)}</span></li>`;
}

function budgetRow(b, mk) {
  const c = b.categoryId ? catById(b.categoryId) : null;
  const spent = budgetSpent(b, mk);
  const pct = b.limit > 0 ? spent / b.limit : 0;
  const cls = pct > 1 ? 'over' : pct > 0.85 ? 'warn' : '';
  const left = b.limit - spent;
  let perDay = '';
  if (mk === monthOf(today()) && left > 0) {
    const [y, m] = mk.split('-').map(Number);
    const daysLeft = daysInMonth(y, m) - new Date().getDate() + 1;
    perDay = ` · ${fmt(left / daysLeft)} в день`;
  }
  return `<div class="plan" data-act="edit-budget" data-id="${b.id}">
    <div class="top"><span class="ttl">${c ? badge(c.icon, c.color, 'sm') : badge('wallet', '#4c6ef5', 'sm')}<span>${esc(c ? c.name : 'Все расходы')}</span></span>
    <span class="num"><b>${esc(fmt(spent))}</b> <span class="muted small">из ${esc(fmt(b.limit))}</span></span></div>
    <div class="bar ${cls}"><i style="width:${Math.min(pct, 1) * 100}%"></i></div>
    <div class="small ${left < 0 ? 'neg' : 'muted'}">${left < 0 ? `Превышено на ${esc(fmt(-left))}` : `Осталось ${esc(fmt(left))}${perDay}`}</div></div>`;
}

function groupedTx(list) {
  if (!list.length) return emptyState('list-ordered', 'Записей нет');
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  let html = '', cur = null, buf = [], net = 0;
  const flush = () => {
    if (cur) html += `<div class="day"><span>${esc(dayLabel(cur))}</span><span class="num ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${esc(fmt(Math.abs(net)))}</span></div><ul class="list">${buf.join('')}</ul>`;
  };
  for (const t of sorted) {
    if (t.date !== cur) { flush(); cur = t.date; buf = []; net = 0; }
    buf.push(txRow(t));
    if (t.type !== 'transfer') net += t.type === 'income' ? t.amount : -t.amount;
  }
  flush();
  return html;
}

function upcomingRow(it) {
  const when = `${dayLabel(it.date)}${it.time ? ', ' + it.time : ''}`;
  const act = it.kind === 'reminder' ? 'edit-reminder' : it.kind === 'recurring' ? 'edit-recurring' : 'edit-debt';
  return `<li class="row" data-act="${act}" data-id="${it.id}">${badge(it.icon, it.color)}
    <span class="mid"><div class="t">${esc(it.title)}</div><div class="s">${esc(it.sub || '')}</div></span>
    <span class="amt small ${it.due ? 'neg' : 'muted'}">${esc(when)}</span></li>`;
}

function dueAlerts() {
  const due = db.reminders.filter(isDue);
  if (!due.length) return '';
  return due.map((r) => `<div class="alert">${icon('bell-ring')}
    <span class="mid"><b>${esc(r.title)}</b><div class="small">${esc(dayLabel(r.date))}, ${esc(r.time || '09:00')}${r.note ? ' · ' + esc(r.note) : ''}</div></span>
    <button class="btn sm" data-act="reminder-done" data-id="${r.id}">${icon('check')} Готово</button></div>`).join('');
}

/* ============================== Экраны ============================== */

function viewOverview() {
  const bal = balances();
  const total = totalBalance(bal);
  const mk = monthOf(today());
  const mt = monthTotals(mk);
  const cats = byCategory(txInMonth(mk), 'expense');
  const recent = [...db.transactions].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)).slice(0, 6);
  const accs = db.accounts.filter((a) => !a.archived);
  const soon = upcoming(10).slice(0, 5);
  return topbar('Обзор', 'Общий баланс', `<span data-sync-slot="btn">${Sync.button()}</span>`, `<div class="big num" style="margin-top:6px">${esc(fmt(total))}</div>`) + `
    <div class="content stack">
      ${dueAlerts()}
      <div class="card">
        <div class="section-title"><h2>Счета</h2><button class="btn sm ghost" data-act="go" data-view="more">Управлять</button></div>
        <div class="accounts">${accs.map((a) => `
          <button class="acc" style="--c:${a.color}" data-act="open-account" data-id="${a.id}">
            <div class="n">${icon(ACC_ICONS[a.type] || 'wallet')}${esc(a.name)}</div><div class="b num">${esc(fmt(bal[a.id]))}</div>
          </button>`).join('')}
          <button class="acc add" data-act="new-account">${icon('plus')} Счёт</button></div>
      </div>
      <div class="card">
        <div class="section-title"><h2>${esc(monthLabel(mk))}</h2><button class="btn sm ghost" data-act="go" data-view="stats">Отчёты</button></div>
        <div class="kpis">
          <div class="kpi"><span class="muted small">Доходы</span><b class="num pos">+${esc(fmt(mt.income))}</b></div>
          <div class="kpi"><span class="muted small">Расходы</span><b class="num neg">−${esc(fmt(mt.expense))}</b></div>
          <div class="kpi"><span class="muted small">Итог</span><b class="num">${mt.net >= 0 ? '+' : '−'}${esc(fmt(Math.abs(mt.net)))}</b></div>
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <h2>Расходы по категориям</h2>
          ${cats.length ? `<div class="donut-wrap">${donut(cats, 150, fmtShort(mt.expense))}${legend(cats, { limit: 5, link: { type: 'expense', month: mk } })}</div>` : emptyState('chart-pie', 'В этом месяце расходов пока нет')}
        </div>
        <div class="card">
          <div class="section-title"><h2>Бюджеты</h2><button class="btn sm ghost" data-act="go-plan" data-t="budgets">Все</button></div>
          ${db.budgets.length ? db.budgets.slice(0, 4).map((b) => budgetRow(b, mk)).join('') : emptyState('target', 'Задайте лимиты трат на месяц', `<button class="btn" data-act="new-budget">${icon('plus')} Бюджет</button>`)}
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <div class="section-title"><h2>Скоро</h2><button class="btn sm ghost" data-act="go-plan" data-t="reminders">Напоминания</button></div>
          ${soon.length ? `<ul class="list">${soon.map(upcomingRow).join('')}</ul>` : emptyState('calendar-clock', 'Ближайших платежей и напоминаний нет')}
        </div>
        <div class="card">
          <div class="section-title"><h2>Последние записи</h2><button class="btn sm ghost" data-act="go" data-view="transactions">Все</button></div>
          ${recent.length ? `<ul class="list">${recent.map(txRow).join('')}</ul>` : emptyState('list-ordered', 'Нажмите «+», чтобы добавить первую запись')}
        </div>
      </div>
    </div>`;
}

function viewTransactions() {
  const q = ui.q.trim().toLowerCase();
  let list = q ? db.transactions : txInMonth(ui.month);
  if (ui.acc) list = list.filter((t) => t.accountId === ui.acc || t.toAccountId === ui.acc);
  if (ui.type) list = list.filter((t) => t.type === ui.type);
  if (ui.label) list = list.filter((t) => (t.labels || []).includes(ui.label));
  if (q) {
    list = list.filter((t) => [t.note, catById(t.categoryId)?.name, accById(t.accountId)?.name, String(t.amount), ...(t.labels || []).map((l) => labelById(l)?.name)]
      .some((v) => v && String(v).toLowerCase().includes(q)));
  }
  const tt = totals(list);
  return topbar('Записи', q ? 'Поиск по всем месяцам' : `${list.length} ${plural(list.length, 'запись', 'записи', 'записей')}`, q ? '' : monthNav()) + `
    <div class="content stack">
      <div class="card">
        <div class="toolbar">
          <input type="search" id="q" placeholder="Поиск: описание, категория, сумма, метка" value="${esc(ui.q)}">
          <select id="f-acc"><option value="">Все счета</option>${db.accounts.map((a) => `<option value="${a.id}" ${ui.acc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
          <select id="f-type"><option value="">Все типы</option>${Object.entries(TX_TYPES).map(([k, v]) => `<option value="${k}" ${ui.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          ${db.labels.length ? `<select id="f-label"><option value="">Все метки</option>${db.labels.map((l) => `<option value="${l.id}" ${ui.label === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>` : ''}
        </div>
        <div class="kpis">
          <div class="kpi"><span class="muted small">Доходы</span><b class="num pos">+${esc(fmt(tt.income))}</b></div>
          <div class="kpi"><span class="muted small">Расходы</span><b class="num neg">−${esc(fmt(tt.expense))}</b></div>
        </div>
      </div>
      <div class="card">${groupedTx(list)}</div>
    </div>`;
}

function goalRow(g) {
  const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0;
  const left = Math.max(g.target - g.saved, 0);
  let hint;
  if (g.done || left === 0) hint = 'Цель достигнута';
  else if (g.deadline) {
    const now = new Date(), dl = parseISO(g.deadline);
    const months = (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth();
    hint = months > 0 ? `Откладывайте ${fmt(left / months)} в месяц до ${dl.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Срок прошёл';
  } else hint = `Осталось ${fmt(left)}`;
  return `<div class="plan" data-act="edit-goal" data-id="${g.id}">
    <div class="top"><span class="ttl">${badge(g.icon, g.color, 'sm')}<span>${esc(g.name)}</span></span>
    <span class="num"><b>${esc(fmt(g.saved))}</b> <span class="muted small">из ${esc(fmt(g.target))}</span></span></div>
    <div class="bar"><i style="width:${pct * 100}%;background:${g.color}"></i></div>
    <div class="top small"><span class="muted">${esc(hint)}</span>
    ${g.done || left === 0 ? '' : `<button class="btn sm" data-act="goal-add" data-id="${g.id}">${icon('plus')} Пополнить</button>`}</div></div>`;
}

function debtRow(d) {
  const left = debtLeft(d), paid = debtPaid(d);
  const pct = d.amount > 0 ? Math.min(paid / d.amount, 1) : 0;
  const overdue = left > 0 && d.due && d.due < today();
  return `<div class="plan" data-act="edit-debt" data-id="${d.id}">
    <div class="top"><span class="ttl">${badge(d.kind === 'lent' ? 'arrow-up-right' : 'arrow-down-left', d.kind === 'lent' ? '#12b886' : '#f03e3e', 'sm')}<span>${esc(d.person)} <span class="muted small">${d.kind === 'lent' ? 'должен мне' : 'я должен'}</span></span></span>
    <span class="num ${left === 0 ? 'muted' : d.kind === 'lent' ? 'pos' : 'neg'}"><b>${esc(fmt(left))}</b> <span class="muted small">из ${esc(fmt(d.amount))}</span></span></div>
    <div class="bar"><i style="width:${pct * 100}%"></i></div>
    <div class="top small"><span class="${overdue ? 'neg' : 'muted'}">${left === 0 ? 'Погашен' : d.due ? `${overdue ? 'Просрочен с' : 'Вернуть до'} ${esc(parseISO(d.due).toLocaleDateString('ru-RU'))}` : 'Без срока'}${d.note ? ' · ' + esc(d.note) : ''}</span>
    ${left > 0 ? `<button class="btn sm" data-act="debt-pay" data-id="${d.id}">${icon('plus')} Возврат</button>` : ''}</div></div>`;
}

function recurringRow(r) {
  const c = catById(r.template.categoryId);
  const a = accById(r.template.accountId);
  return `<li class="row" data-act="edit-recurring" data-id="${r.id}">
    ${r.template.type === 'transfer' ? badge('arrow-left-right', '#868e96') : badge(c?.icon || 'repeat', c?.color || '#868e96')}
    <span class="mid"><div class="t">${esc(r.template.note || c?.name || TX_TYPES[r.template.type])}</div>
    <div class="s">${esc(FREQ[r.freq])} · следующий ${esc(dayLabel(r.next))}${r.remind ? ' · с напоминанием' : ''}${r.active ? '' : ' · приостановлен'}</div></span>
    <span class="amt num ${r.template.type === 'income' ? 'pos' : r.template.type === 'expense' ? 'neg' : ''}">${esc(fmt(r.template.amount))}</span></li>`;
}

function reminderRow(r) {
  return `<li class="row" data-act="edit-reminder" data-id="${r.id}">${badge(r.active ? 'bell' : 'check', r.active ? (isDue(r) ? '#f03e3e' : '#fab005') : '#adb5bd')}
    <span class="mid"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.active ? `${dayLabel(r.date)}, ${r.time || '09:00'}` : 'Выполнено')} · ${esc(FREQ[r.repeat || 'none'])}${r.note ? ' · ' + esc(r.note) : ''}</div></span>
    ${r.active ? `<button class="btn sm" data-act="reminder-done" data-id="${r.id}">${icon('check')}</button>` : ''}</li>`;
}

const PLAN_TABS = { budgets: 'Бюджеты', goals: 'Цели', recurring: 'Регулярные', reminders: 'Напоминания', debts: 'Долги' };

function viewPlans() {
  const tab = ui.planTab;
  let right = '', body = '';
  if (tab === 'budgets') {
    right = `${monthNav()}<button class="btn primary" data-act="new-budget">${icon('plus')} Бюджет</button>`;
    body = `<div class="card">${db.budgets.length ? db.budgets.map((b) => budgetRow(b, ui.month)).join('') : emptyState('target', 'Бюджет — это месячный лимит трат на категорию или на все расходы сразу.')}</div>`;
  } else if (tab === 'goals') {
    const reached = (g) => g.done || g.saved >= g.target;
    const active = db.goals.filter((g) => !reached(g)), done = db.goals.filter(reached);
    const saved = active.reduce((s, g) => s + g.saved, 0), target = active.reduce((s, g) => s + g.target, 0);
    right = `<button class="btn primary" data-act="new-goal">${icon('plus')} Цель</button>`;
    body = db.goals.length ? `
      ${active.length ? `<div class="card"><div class="muted small">Накоплено на активные цели</div><div class="big num" style="font-size:26px">${esc(fmt(saved))} <span class="muted" style="font-size:15px;font-weight:500">из ${esc(fmt(target))}</span></div>
        <div class="bar"><i style="width:${target ? Math.min(saved / target, 1) * 100 : 0}%"></i></div></div>` : ''}
      <div class="card">${active.map(goalRow).join('') || emptyState('award', 'Все цели достигнуты!')}</div>
      ${done.length ? `<div class="card"><h2>Достигнутые</h2>${done.map(goalRow).join('')}</div>` : ''}`
      : `<div class="card">${emptyState('target', 'Цели помогают копить на крупные покупки: задайте сумму и срок — приложение подскажет, сколько откладывать в месяц.')}</div>`;
  } else if (tab === 'recurring') {
    right = `<button class="btn primary" data-act="new-tx">${icon('plus')} Платёж</button>`;
    const sorted = [...db.recurring].sort((a, b) => a.next.localeCompare(b.next));
    const monthly = db.recurring.filter((r) => r.active && r.template.type === 'expense')
      .reduce((s, r) => s + r.template.amount * ({ daily: 30, weekly: 4.33, monthly: 1, yearly: 1 / 12 }[r.freq] || 1), 0);
    body = `${db.recurring.length ? `<div class="card"><div class="muted small">Регулярные расходы в месяц ≈</div><div class="big num" style="font-size:26px">${esc(fmt(monthly))}</div></div>` : ''}
      <div class="card">${sorted.length ? `<ul class="list">${sorted.map(recurringRow).join('')}</ul>` : emptyState('repeat', 'Аренда, подписки, зарплата — добавьте запись и выберите «Повтор», и она будет создаваться автоматически.')}</div>`;
  } else if (tab === 'reminders') {
    right = `<button class="btn primary" data-act="new-reminder">${icon('plus')} Напоминание</button>`;
    const active = db.reminders.filter((r) => r.active).sort((a, b) => reminderStamp(a).localeCompare(reminderStamp(b)));
    const done = db.reminders.filter((r) => !r.active);
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const soon = upcoming(30).filter((i) => i.kind !== 'reminder');
    body = `
      ${perm === 'default' ? `<div class="alert">${icon('bell')}<span class="mid">Разрешите уведомления, чтобы напоминания приходили даже в свёрнутом приложении.</span><button class="btn sm" data-act="ask-notify">Включить</button></div>` : ''}
      ${perm === 'denied' ? `<div class="alert">${icon('triangle-alert')}<span class="mid">Уведомления запрещены в настройках браузера — напоминания будут видны только внутри приложения.</span></div>` : ''}
      ${dueAlerts()}
      <div class="card"><h2>Мои напоминания</h2>${active.length ? `<ul class="list">${active.map(reminderRow).join('')}</ul>` : emptyState('bell', 'Создайте напоминание: оплатить счёт, передать показания, записать траты…')}</div>
      <div class="card"><h2>Платежи и долги в ближайшие 30 дней</h2>${soon.length ? `<ul class="list">${soon.map(upcomingRow).join('')}</ul>` : emptyState('calendar-clock', 'Ничего не запланировано')}
        <p class="small muted" style="margin-bottom:0">О регулярных платежах с включённым напоминанием Монетка предупредит за день, о долгах — в день срока.</p></div>
      ${done.length ? `<div class="card"><div class="section-title"><h2>Выполненные</h2><button class="btn sm" data-act="clear-done-reminders">Очистить</button></div><ul class="list">${done.map(reminderRow).join('')}</ul></div>` : ''}`;
  } else {
    const open = db.debts.filter((d) => debtLeft(d) > 0), closed = db.debts.filter((d) => debtLeft(d) <= 0);
    const lent = open.filter((d) => d.kind === 'lent').reduce((s, d) => s + debtLeft(d), 0);
    const borrowed = open.filter((d) => d.kind === 'borrowed').reduce((s, d) => s + debtLeft(d), 0);
    right = `<button class="btn primary" data-act="new-debt">${icon('plus')} Долг</button>`;
    body = `<div class="card"><div class="kpis">
        <div class="kpi"><span class="muted small">Мне должны</span><b class="num pos">${esc(fmt(lent))}</b></div>
        <div class="kpi"><span class="muted small">Я должен</span><b class="num neg">${esc(fmt(borrowed))}</b></div></div></div>
      <div class="card">${open.map(debtRow).join('') || emptyState('hand-coins', 'Открытых долгов нет')}</div>
      ${closed.length ? `<div class="card"><h2>Погашенные</h2>${closed.map(debtRow).join('')}</div>` : ''}`;
  }
  return topbar('Планы', PLAN_TABS[tab], right) + `
    <div class="content stack">
      <div class="card" style="padding:6px"><div class="seg scroll" style="background:none">${Object.entries(PLAN_TABS).map(([k, v]) => `<button class="${tab === k ? 'on' : ''}" data-act="plan-tab" data-t="${k}">${v}</button>`).join('')}</div></div>
      ${body}
    </div>`;
}

function viewAnalytics() {
  const mk = ui.month;
  const list = txInMonth(mk);
  const mt = totals(list);
  const exp = byCategory(list, 'expense'), inc = byCategory(list, 'income');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(mk, -i);
    const [y, m] = k.split('-').map(Number);
    months.push({ label: new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''), ...monthTotals(k) });
  }
  const [y, m] = mk.split('-').map(Number);
  const days = monthOf(today()) === mk ? new Date().getDate() : daysInMonth(y, m);
  const series = mk <= monthOf(today()) ? balanceSeries(mk) : [];
  const savingsRate = mt.income > 0 ? Math.round((mt.net / mt.income) * 100) : null;
  return `
    <div class="card"><div class="kpis">
      <div class="kpi"><span class="muted small">Доходы</span><b class="num pos">+${esc(fmt(mt.income))}</b></div>
      <div class="kpi"><span class="muted small">Расходы</span><b class="num neg">−${esc(fmt(mt.expense))}</b></div>
      <div class="kpi"><span class="muted small">Итог</span><b class="num">${mt.net >= 0 ? '+' : '−'}${esc(fmt(Math.abs(mt.net)))}</b></div>
      <div class="kpi"><span class="muted small">Расход в день</span><b class="num">${esc(fmt(mt.expense / Math.max(days, 1)))}</b></div>
      ${savingsRate != null ? `<div class="kpi"><span class="muted small">Сбережения</span><b class="num">${savingsRate}%</b></div>` : ''}
    </div></div>
    <div class="grid">
      <div class="card"><h2>Расходы по категориям</h2>
        ${exp.length ? `<div class="donut-wrap">${donut(exp, 170, fmtShort(mt.expense))}${legend(exp, { link: { type: 'expense', month: mk } })}</div><p class="small muted" style="margin-bottom:0">Нажмите на категорию, чтобы увидеть список операций</p>` : emptyState('chart-pie', 'Нет расходов')}</div>
      <div class="card"><h2>Доходы по категориям</h2>
        ${inc.length ? `<div class="donut-wrap">${donut(inc, 170, fmtShort(mt.income))}${legend(inc, { link: { type: 'income', month: mk } })}</div>` : emptyState('chart-pie', 'Нет доходов')}</div>
    </div>
    <div class="card"><h2>Доходы и расходы за 6 месяцев</h2>${barChart(months)}</div>
    ${series.length > 1 ? `<div class="card"><h2>Баланс по дням</h2>${lineChart(series)}</div>` : ''}`;
}

function reportData() {
  const r = ui.rep;
  const range = periodRange(r);
  let list = txInRange(range.from, range.to).filter((t) => t.type === r.type);
  if (r.cat) list = list.filter((t) => (r.cat === 'none' ? !catById(t.categoryId) : t.categoryId === r.cat));
  if (r.label) list = list.filter((t) => (t.labels || []).includes(r.label));
  if (r.acc) list = list.filter((t) => t.accountId === r.acc);
  list.sort(r.sort === 'amount' ? (a, b) => b.amount - a.amount : (a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  const total = list.reduce((s, t) => s + t.amount, 0);
  const days = Math.round((parseISO(range.to < today() ? range.to : today()) - parseISO(range.from)) / 864e5) + 1;
  return { range, list, total, days: Math.max(days, 1) };
}

function reportTitle() {
  const r = ui.rep;
  const parts = [];
  if (r.cat) parts.push(r.cat === 'none' ? 'Без категории' : catById(r.cat)?.name || '');
  if (r.label) parts.push(`#${labelById(r.label)?.name || ''}`);
  if (!parts.length) parts.push(r.type === 'expense' ? 'Все расходы' : 'Все доходы');
  if (r.acc) parts.push(accById(r.acc)?.name || '');
  return parts.join(' · ');
}

function viewReport() {
  const r = ui.rep;
  const { range, list, total, days } = reportData();
  const cats = db.categories.filter((c) => c.type === r.type);
  const c = r.cat && r.cat !== 'none' ? catById(r.cat) : null;
  const breakdown = !r.cat ? byCategory(list, r.type) : [];
  return `
    <div class="card no-print">
      <div class="seg" style="max-width:300px;margin-bottom:12px">
        <button class="${r.type === 'expense' ? 'on' : ''}" data-act="rep-type" data-t="expense">Расходы</button>
        <button class="${r.type === 'income' ? 'on' : ''}" data-act="rep-type" data-t="income">Доходы</button>
      </div>
      <div class="two">
        <label class="f">Категория<select id="rep-cat"><option value="">Все категории</option>
          ${cats.map((x) => `<option value="${x.id}" ${r.cat === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
          <option value="none" ${r.cat === 'none' ? 'selected' : ''}>Без категории</option></select></label>
        <label class="f">Период<select id="rep-period">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${r.period === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      ${r.period === 'custom' ? `<div class="two"><label class="f">С<input type="date" id="rep-from" value="${esc(range.from)}"></label><label class="f">По<input type="date" id="rep-to" value="${esc(range.to)}"></label></div>` : ''}
      <div class="two">
        <label class="f">Метка<select id="rep-label"><option value="">Любая</option>${db.labels.map((l) => `<option value="${l.id}" ${r.label === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label class="f">Счёт<select id="rep-acc"><option value="">Все счета</option>${db.accounts.map((a) => `<option value="${a.id}" ${r.acc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      </div>
    </div>

    <div class="card report-total">
      <div style="display:flex;align-items:center;gap:14px">
        ${c ? badge(c.icon, c.color, 'lg') : badge(r.type === 'expense' ? 'receipt' : 'coins', 'rgba(255,255,255,.22)', 'lg')}
        <div style="min-width:0"><div style="font-weight:700;font-size:17px">${esc(reportTitle())}</div><div class="muted small">${esc(range.label)}</div></div>
      </div>
      <div class="muted small" style="margin-top:14px">${r.type === 'expense' ? 'Потрачено' : 'Получено'} за период</div>
      <div class="big num">${esc(fmt(total))}</div>
      <div class="kpis" style="margin-top:12px">
        <div class="kpi"><span class="muted small">Операций</span><b class="num">${list.length}</b></div>
        <div class="kpi"><span class="muted small">Средняя сумма</span><b class="num">${esc(fmt(list.length ? total / list.length : 0))}</b></div>
        <div class="kpi"><span class="muted small">В среднем в день</span><b class="num">${esc(fmt(total / days))}</b></div>
      </div>
    </div>

    ${breakdown.length > 1 ? `<div class="card"><h2>По категориям</h2>${legend(breakdown, { limit: 20, link: { type: r.type, keep: true } })}</div>` : ''}

    <div class="card">
      <div class="section-title"><h2>Операции</h2>
        <div class="toolbar no-print">
          <select id="rep-sort" aria-label="Сортировка"><option value="date" ${r.sort === 'date' ? 'selected' : ''}>По дате</option><option value="amount" ${r.sort === 'amount' ? 'selected' : ''}>По сумме</option></select>
          <button class="btn sm" data-act="rep-csv" title="Скачать CSV">${icon('download')} CSV</button>
          <button class="btn sm" data-act="rep-print" title="Печать или PDF">${icon('file-text')} Печать</button>
        </div></div>
      ${list.length ? `<ul class="list">${list.map((t) => {
        const cat = catById(t.categoryId), acc = accById(t.accountId), d = parseISO(t.date);
        const tags = tagsHtml(t);
        return `<li class="row report-row" data-act="edit-tx" data-id="${t.id}">
          <span class="date"><b>${d.getDate()}</b>${d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}</span>
          ${r.cat ? '' : badge(cat?.icon || 'circle-help', cat?.color || '#adb5bd', 'sm')}
          <span class="mid"><div class="t">${esc(t.note || cat?.name || 'Без описания')}</div><div class="s">${esc([r.cat ? '' : cat?.name, acc?.name].filter(Boolean).join(' · '))}</div>${tags ? `<div class="tags">${tags}</div>` : ''}</span>
          <span class="amt num ${r.type === 'income' ? 'pos' : 'neg'}">${esc(fmt(t.amount))}</span></li>`;
      }).join('')}</ul>` : emptyState('search', 'За этот период таких операций нет')}
    </div>`;
}

function viewStats() {
  const report = ui.statsTab === 'report';
  return topbar('Отчёты', report ? 'Список операций по категории за период' : 'Аналитика за месяц', report ? '' : monthNav()) + `
    <div class="content stack">
      <div class="card no-print" style="padding:6px"><div class="seg" style="background:none;max-width:420px">
        <button class="${report ? '' : 'on'}" data-act="stats-tab" data-t="analytics">Аналитика</button>
        <button class="${report ? 'on' : ''}" data-act="stats-tab" data-t="report">По категории</button></div></div>
      ${report ? viewReport() : viewAnalytics()}
    </div>`;
}

function viewMore() {
  const bal = balances();
  const cats = db.categories.filter((c) => c.type === ui.catTab);
  const theme = db.settings.theme;
  return topbar('Ещё', 'Счета, категории и настройки') + `
    <div class="content stack">
      <div class="card" id="sync-card" data-sync-slot="card">${Sync.card()}</div>
      <div class="card">
        <div class="section-title"><h2>Счета</h2><button class="btn sm" data-act="new-account">${icon('plus')} Счёт</button></div>
        ${db.accounts.length ? `<ul class="list">${db.accounts.map((a) => `
          <li class="row" data-act="edit-account" data-id="${a.id}">${badge(ACC_ICONS[a.type] || 'wallet', a.color)}
            <span class="mid"><div class="t">${esc(a.name)}${a.archived ? ' <span class="muted small">(скрыт)</span>' : ''}</div><div class="s">${esc(ACC_TYPES[a.type] || '')}</div></span>
            <span class="amt num">${esc(fmt(bal[a.id]))}</span></li>`).join('')}</ul>` : emptyState('wallet', 'Счетов нет')}
      </div>

      <div class="card">
        <div class="section-title"><h2>Категории</h2><button class="btn sm" data-act="new-category">${icon('plus')} Категория</button></div>
        <div class="seg" style="max-width:280px;margin-bottom:10px">
          <button class="${ui.catTab === 'expense' ? 'on' : ''}" data-act="cat-tab" data-t="expense">Расходы</button>
          <button class="${ui.catTab === 'income' ? 'on' : ''}" data-act="cat-tab" data-t="income">Доходы</button>
        </div>
        <div class="cat-grid" style="max-height:none">${cats.map((c) => `
          <button class="cat-pick" data-act="edit-category" data-id="${c.id}">${badge(c.icon, c.color)}<span>${esc(c.name)}</span></button>`).join('')}
          <button class="cat-pick" data-act="new-category"><span class="cico" style="background:var(--surface-2);color:var(--muted)">${icon('plus')}</span><span>Новая</span></button></div>
      </div>

      <div class="card">
        <div class="section-title"><h2>Метки</h2><button class="btn sm" data-act="new-label">${icon('plus')} Метка</button></div>
        ${db.labels.length ? `<div class="chips">${db.labels.map((l) => {
          const n = db.transactions.filter((t) => (t.labels || []).includes(l.id)).length;
          return `<button class="chip" style="color:${l.color};background:${l.color}1a;border-color:transparent" data-act="edit-label" data-id="${l.id}">${icon('tag')} ${esc(l.name)} <span class="muted">${n}</span></button>`;
        }).join('')}</div>` : emptyState('tag', 'Метки группируют записи поверх категорий: «Отпуск», «Работа», «Ремонт»…')}
      </div>


      <div class="card">
        <h2>Данные</h2>
        <p class="small muted" style="margin-top:0">Все данные хранятся только в этом браузере. Делайте резервную копию, чтобы перенести их на другое устройство.</p>
        <div class="toolbar">
          <button class="btn" data-act="export-csv">${icon('download')} Экспорт CSV</button>
          <button class="btn" data-act="import-csv">${icon('upload')} Импорт CSV</button>
          <button class="btn" data-act="export-json">${icon('download')} Резервная копия</button>
          <button class="btn" data-act="import-json">${icon('upload')} Восстановить</button>
        </div>
        <div class="toolbar" style="margin-top:8px">
          <button class="btn" data-act="load-demo">Загрузить демо-данные</button>
          <button class="btn danger" data-act="wipe">${icon('trash-2')} Удалить все данные</button>
        </div>
      </div>

      <div class="card">
        <h2>Оформление</h2>
        <div class="seg" style="max-width:380px">
          ${[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, v]) => `<button class="${theme === k ? 'on' : ''}" data-act="theme" data-t="${k}">${v}</button>`).join('')}
        </div>
      </div>
      <p class="small muted">Иконки: Lucide (ISC).</p>
    </div>`;
}

const VIEWS = { overview: viewOverview, transactions: viewTransactions, budgets: viewPlans, stats: viewStats, more: viewMore };

function render() {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));
  const y = window.scrollY;
  $('#main').innerHTML = VIEWS[ui.view]();
  window.scrollTo(0, y);
}

function go(view) { ui.view = view; window.scrollTo(0, 0); render(); }

function applyTheme() {
  const t = db.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

/* ============================== Модальные окна ============================== */

const modal = $('#modal');

function openModal(title, body, { onSubmit, onDelete, submitText = 'Сохранить', onOpen, cls = '' } = {}) {
  modal.className = `modal ${cls}`;
  modal.innerHTML = `<form novalidate>
    <div class="mh"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Закрыть">${icon('x')}</button></div>
    ${body}
    <div class="actions">${onDelete ? `<button type="button" class="btn danger" data-del>${icon('trash-2')} Удалить</button>` : ''}
      <span class="spacer"></span><button type="button" class="btn" data-close>Отмена</button>
      <button type="submit" class="btn primary">${esc(submitText)}</button></div></form>`;
  const form = $('form', modal);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (onSubmit(new FormData(form), form) === false) return;
    modal.close(); save(); render();
  });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) modal.close();
    if (e.target.closest('[data-del]') && onDelete() !== false) { modal.close(); save(); render(); }
  });
  modal.showModal();
  onOpen?.(form);
}

function fail(form, msg, field) {
  toast(msg);
  if (field) form.elements[field]?.focus();
  return false;
}

function accountOptions(selected) {
  return db.accounts.filter((a) => !a.archived || a.id === selected)
    .map((a) => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
}

function txModal(tx = null) {
  if (!db.accounts.length) { toast('Сначала добавьте счёт'); accountModal(); return; }
  const isNew = !tx;
  const t = tx ? { ...tx } : { type: 'expense', accountId: ui.acc || db.accounts.find((a) => !a.archived)?.id, date: today(), amount: '', note: '' };
  const body = `
    <div class="seg" id="tx-seg">${Object.entries(TX_TYPES).map(([k, v]) => `<button type="button" data-type="${k}">${v}</button>`).join('')}</div>
    <input type="hidden" name="type" value="${t.type}">
    <label class="f">Сумма<input class="amount-input num" name="amount" type="text" inputmode="decimal" autocomplete="off" value="${esc(t.amount)}" placeholder="0"></label>
    <div id="cat-wrap" class="f"><span class="lbl">Категория</span><div class="cat-grid" id="cat-grid"></div></div>
    <input type="hidden" name="category" value="${esc(t.categoryId || '')}">
    <div class="two">
      <label class="f"><span id="acc-label">Счёт</span><select name="account">${accountOptions(t.accountId)}</select></label>
      <label class="f" id="to-wrap">На счёт<select name="to">${accountOptions(t.toAccountId)}</select></label>
    </div>
    <label class="f">Описание<input type="text" name="note" value="${esc(t.note)}" maxlength="200" placeholder="Например: такси на встречу с клиентом"></label>
    ${db.labels.length ? `<div class="f"><span class="lbl">Метки</span><div class="chips">${db.labels.map((l) =>
      `<button type="button" class="chip ${(t.labels || []).includes(l.id) ? 'on' : ''}" data-label="${l.id}">${esc(l.name)}</button>`).join('')}</div></div>` : ''}
    <div class="two">
      <label class="f">Дата<input type="date" name="date" value="${esc(t.date)}"></label>
      ${isNew ? `<label class="f">Повтор<select name="repeat">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>` : '<span></span>'}
    </div>
    ${isNew ? '<label class="switch" id="remind-wrap" hidden><input type="checkbox" name="remind" checked> Напоминать за день до платежа</label>' : ''}`;

  openModal(isNew ? 'Новая запись' : 'Запись', body, {
    submitText: isNew ? 'Добавить' : 'Сохранить',
    cls: `tx-${t.type}`,
    onOpen(form) {
      const el = form.elements;
      const sync = () => {
        const type = el.type.value;
        modal.className = `modal tx-${type}`;
        form.querySelectorAll('#tx-seg button').forEach((b) => b.classList.toggle('on', b.dataset.type === type));
        $('#to-wrap', form).hidden = type !== 'transfer';
        $('#cat-wrap', form).hidden = type === 'transfer';
        $('#acc-label', form).textContent = type === 'transfer' ? 'Со счёта' : 'Счёт';
        const cats = db.categories.filter((c) => c.type === type);
        if (!cats.some((c) => c.id === el.category.value)) el.category.value = cats[0]?.id || '';
        $('#cat-grid', form).innerHTML = cats.map((c) =>
          `<button type="button" class="cat-pick ${c.id === el.category.value ? 'on' : ''}" data-cat="${c.id}">${badge(c.icon, c.color, 'sm')}<span>${esc(c.name)}</span></button>`).join('')
          + `<button type="button" class="cat-pick" data-new-cat><span class="cico sm" style="background:var(--surface-2);color:var(--muted)">${icon('plus')}</span><span>Новая</span></button>`;
        if (el.repeat) $('#remind-wrap', form).hidden = el.repeat.value === 'none';
      };
      form.addEventListener('click', (e) => {
        const tb = e.target.closest('[data-type]');
        if (tb) { el.type.value = tb.dataset.type; sync(); }
        const cb = e.target.closest('[data-cat]');
        if (cb) { el.category.value = cb.dataset.cat; sync(); }
        const lb = e.target.closest('[data-label]');
        if (lb) lb.classList.toggle('on');
        if (e.target.closest('[data-new-cat]')) { modal.close(); ui.catTab = el.type.value; categoryModal(null, el.type.value); }
      });
      el.account.addEventListener('change', sync);
      el.to.addEventListener('change', sync);
      el.repeat?.addEventListener('change', sync);
      if (!t.toAccountId) {
        const other = db.accounts.find((a) => !a.archived && a.id !== el.account.value);
        if (other) el.to.value = other.id;
      }
      sync();
      el.amount.focus();
    },
    onSubmit(fd, form) {
      const type = fd.get('type');
      const amount = round2(parseAmount(fd.get('amount')));
      if (!(amount > 0)) return fail(form, 'Введите сумму больше нуля', 'amount');
      const date = fd.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(form, 'Укажите дату', 'date');
      const rec = { type, accountId: fd.get('account'), amount, date, note: String(fd.get('note') || '').trim() };
      const labels = [...form.querySelectorAll('[data-label].on')].map((b) => b.dataset.label);
      if (labels.length) rec.labels = labels;
      if (type === 'transfer') {
        rec.toAccountId = fd.get('to');
        if (!rec.toAccountId || rec.toAccountId === rec.accountId) return fail(form, 'Выберите другой счёт для перевода', 'to');
      } else {
        rec.categoryId = fd.get('category') || null;
      }
      if (isNew) {
        const repeat = fd.get('repeat');
        if (repeat && repeat !== 'none') {
          const { date: _d, ...template } = rec;
          const r = { id: uid(), freq: repeat, day: parseISO(date).getDate(), next: addFreq(date, repeat, parseISO(date).getDate()), active: true, remind: fd.get('remind') === 'on', template };
          db.recurring.push(r);
          rec.recurringId = r.id;
        }
        db.transactions.push({ id: uid(), ...rec });
        toast('Запись добавлена');
      } else {
        const i = db.transactions.findIndex((x) => x.id === tx.id);
        db.transactions[i] = { id: tx.id, ...(tx.recurringId ? { recurringId: tx.recurringId } : {}), ...rec };
      }
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Удалить запись?')) return false;
      db.transactions = db.transactions.filter((x) => x.id !== tx.id);
      toast('Запись удалена');
    },
  });
}

function colorPicker(name, value) {
  return `<input type="hidden" name="${name}" value="${value}"><div class="swatches">${COLORS.map((c) =>
    `<button type="button" class="swatch ${c === value ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('')}</div>`;
}

function iconPicker(name, value, color) {
  return `<input type="hidden" name="${name}" value="${esc(value)}"><div class="icon-grid">${CATEGORY_ICONS.map((n) =>
    `<button type="button" class="icon-pick ${n === value ? 'on' : ''}" data-icon-pick="${n}" style="${n === value ? `background:${color}` : ''}" aria-label="${n}">${icon(n)}</button>`).join('')}</div>`;
}

/** Цвет и иконка влияют друг на друга и на превью — связываем их в одной форме. */
function bindAppearance(form, { colorField = 'color', iconField, preview } = {}) {
  const repaint = () => {
    const color = form.elements[colorField].value;
    form.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x.dataset.color === color));
    if (iconField) {
      const ic = form.elements[iconField].value;
      form.querySelectorAll('[data-icon-pick]').forEach((x) => {
        const on = x.dataset.iconPick === ic;
        x.classList.toggle('on', on);
        x.style.background = on ? color : '';
      });
      if (preview) $(preview, form).innerHTML = badge(ic, color, 'lg');
    }
  };
  form.addEventListener('click', (e) => {
    const c = e.target.closest('[data-color]');
    if (c) { form.elements[colorField].value = c.dataset.color; repaint(); }
    const i = iconField && e.target.closest('[data-icon-pick]');
    if (i) { form.elements[iconField].value = i.dataset.iconPick; repaint(); }
  });
  repaint();
}

function accountModal(acc = null) {
  const a = acc || { name: '', type: 'card', initial: 0, color: COLORS[(db.accounts.length * 3 + 4) % COLORS.length] };
  openModal(acc ? 'Счёт' : 'Новый счёт', `
    <label class="f">Название<input type="text" name="name" value="${esc(a.name)}" maxlength="60" placeholder="Например: Зарплатная карта"></label>
    <div class="two">
      <label class="f">Тип<select name="type">${Object.entries(ACC_TYPES).map(([k, v]) => `<option value="${k}" ${k === a.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f">Начальный баланс<input type="text" inputmode="decimal" name="initial" value="${esc(a.initial)}"></label>
    </div>
    <div class="f"><span class="lbl">Цвет</span>${colorPicker('color', a.color)}</div>
    ${acc ? `<label class="switch"><input type="checkbox" name="archived" ${a.archived ? 'checked' : ''}> Скрыть счёт из обзора и общего баланса</label>` : ''}`, {
    onOpen(form) { bindAppearance(form); form.elements.name.focus(); },
    onSubmit(fd, form) {
      const name = String(fd.get('name') || '').trim();
      if (!name) return fail(form, 'Введите название счёта', 'name');
      const initial = parseAmount(fd.get('initial') || 0);
      if (!Number.isFinite(initial)) return fail(form, 'Некорректный начальный баланс', 'initial');
      const rec = { name, type: fd.get('type'), initial: round2(initial), color: fd.get('color'), archived: fd.get('archived') === 'on' };
      if (acc) Object.assign(acc, rec);
      else db.accounts.push({ id: uid(), ...rec });
    },
    onDelete: acc ? () => {
      const n = db.transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id).length;
      if (!confirm(n ? `Удалить счёт «${acc.name}» и все его записи (${n})?` : `Удалить счёт «${acc.name}»?`)) return false;
      db.transactions = db.transactions.filter((t) => t.accountId !== acc.id && t.toAccountId !== acc.id);
      db.recurring = db.recurring.filter((r) => r.template.accountId !== acc.id && r.template.toAccountId !== acc.id);
      db.accounts = db.accounts.filter((x) => x.id !== acc.id);
      if (ui.acc === acc.id) ui.acc = '';
      if (ui.rep.acc === acc.id) ui.rep.acc = '';
    } : null,
  });
}

function categoryModal(cat = null, type = ui.catTab) {
  const c = cat || { name: '', type, icon: 'tag', color: COLORS[(db.categories.length * 5) % COLORS.length] };
  openModal(cat ? 'Категория' : 'Новая категория', `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
      <span id="cat-preview"></span>
      <label class="f" style="flex:1;margin:0">Название<input type="text" name="name" value="${esc(c.name)}" maxlength="40" placeholder="Например: Ремонт"></label>
    </div>
    <label class="f">Тип<select name="type" ${cat ? 'disabled' : ''}><option value="expense" ${c.type === 'expense' ? 'selected' : ''}>Расход</option><option value="income" ${c.type === 'income' ? 'selected' : ''}>Доход</option></select></label>
    <div class="f"><span class="lbl">Цвет</span>${colorPicker('color', c.color)}</div>
    <div class="f"><span class="lbl">Иконка</span>${iconPicker('icon', ICONS[c.icon] ? c.icon : 'tag', c.color)}</div>`, {
    onOpen(form) { bindAppearance(form, { iconField: 'icon', preview: '#cat-preview' }); form.elements.name.focus(); },
    onSubmit(fd, form) {
      const name = String(fd.get('name') || '').trim();
      if (!name) return fail(form, 'Введите название категории', 'name');
      const t = fd.get('type') || c.type;
      if (db.categories.some((x) => x !== cat && x.type === t && x.name.toLowerCase() === name.toLowerCase())) return fail(form, 'Такая категория уже есть', 'name');
      const rec = { name, icon: fd.get('icon'), color: fd.get('color'), type: t };
      if (cat) Object.assign(cat, rec);
      else { db.categories.push({ id: uid(), ...rec }); toast(`Категория «${name}» создана`); }
    },
    onDelete: cat ? () => {
      const n = db.transactions.filter((t) => t.categoryId === cat.id).length;
      if (!confirm(n ? `Удалить категорию? ${n} ${plural(n, 'запись останется', 'записи останутся', 'записей останутся')} без категории.` : 'Удалить категорию?')) return false;
      db.transactions.forEach((t) => { if (t.categoryId === cat.id) t.categoryId = null; });
      db.recurring.forEach((r) => { if (r.template.categoryId === cat.id) r.template.categoryId = null; });
      db.budgets = db.budgets.filter((b) => b.categoryId !== cat.id);
      db.categories = db.categories.filter((x) => x.id !== cat.id);
      if (ui.rep.cat === cat.id) ui.rep.cat = '';
    } : null,
  });
}

function budgetModal(b = null) {
  const cur = b || { categoryId: null, limit: '' };
  const cats = db.categories.filter((c) => c.type === 'expense');
  openModal(b ? 'Бюджет' : 'Новый бюджет', `
    <label class="f">На что<select name="category"><option value="">Все расходы</option>
      ${cats.map((c) => `<option value="${c.id}" ${c.id === cur.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label class="f">Лимит в месяц<input class="amount-input num" type="text" inputmode="decimal" name="limit" value="${esc(cur.limit)}"></label>`, {
    onOpen(form) { form.elements.limit.focus(); },
    onSubmit(fd, form) {
      const limit = round2(parseAmount(fd.get('limit')));
      if (!(limit > 0)) return fail(form, 'Введите лимит больше нуля', 'limit');
      const categoryId = fd.get('category') || null;
      if (db.budgets.some((x) => x !== b && x.categoryId === categoryId)) return fail(form, 'Бюджет для этой категории уже есть', 'category');
      if (b) Object.assign(b, { categoryId, limit });
      else db.budgets.push({ id: uid(), categoryId, limit });
    },
    onDelete: b ? () => { if (!confirm('Удалить бюджет?')) return false; db.budgets = db.budgets.filter((x) => x !== b); } : null,
  });
}

function recurringModal(r) {
  const a = accById(r.template.accountId);
  openModal('Регулярный платёж', `
    <p class="muted small" style="margin-top:0">${esc(TX_TYPES[r.template.type])} · ${esc(catById(r.template.categoryId)?.name || '')} · ${esc(a?.name || '')}</p>
    <label class="f">Сумма<input class="amount-input num" type="text" inputmode="decimal" name="amount" value="${esc(r.template.amount)}"></label>
    <div class="two">
      <label class="f">Периодичность<select name="freq">${Object.entries(FREQ).filter(([k]) => k !== 'none').map(([k, v]) => `<option value="${k}" ${k === r.freq ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f">Следующий платёж<input type="date" name="next" value="${esc(r.next)}"></label>
    </div>
    <label class="f">Описание<input type="text" name="note" value="${esc(r.template.note || '')}" maxlength="200"></label>
    <label class="switch"><input type="checkbox" name="remind" ${r.remind ? 'checked' : ''}> Напоминать за день до платежа</label>
    <label class="switch"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Активен</label>`, {
    onSubmit(fd, form) {
      const amount = round2(parseAmount(fd.get('amount')));
      if (!(amount > 0)) return fail(form, 'Введите сумму больше нуля', 'amount');
      const next = fd.get('next');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return fail(form, 'Укажите дату', 'next');
      Object.assign(r, { freq: fd.get('freq'), next, day: parseISO(next).getDate(), active: fd.get('active') === 'on', remind: fd.get('remind') === 'on' });
      Object.assign(r.template, { amount, note: String(fd.get('note') || '').trim() });
      processRecurring();
    },
    onDelete: () => {
      if (!confirm('Удалить регулярный платёж? Уже созданные записи останутся.')) return false;
      db.recurring = db.recurring.filter((x) => x !== r);
      db.transactions.forEach((t) => { if (t.recurringId === r.id) delete t.recurringId; });
    },
  });
}

function reminderModal(r = null) {
  const cur = r || { title: '', note: '', date: today(), time: '09:00', repeat: 'none', active: true };
  openModal(r ? 'Напоминание' : 'Новое напоминание', `
    <label class="f">О чём напомнить<input type="text" name="title" value="${esc(cur.title)}" maxlength="100" placeholder="Например: оплатить интернет"></label>
    <div class="two">
      <label class="f">Дата<input type="date" name="date" value="${esc(cur.date)}"></label>
      <label class="f">Время<input type="time" name="time" value="${esc(cur.time || '09:00')}"></label>
    </div>
    <label class="f">Повтор<select name="repeat">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${k === (cur.repeat || 'none') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="f">Заметка<input type="text" name="note" value="${esc(cur.note || '')}" maxlength="200"></label>
    ${r ? `<label class="switch"><input type="checkbox" name="active" ${cur.active ? 'checked' : ''}> Активно</label>` : ''}`, {
    onOpen(form) { form.elements.title.focus(); },
    onSubmit(fd, form) {
      const title = String(fd.get('title') || '').trim();
      if (!title) return fail(form, 'Напишите, о чём напомнить', 'title');
      const date = fd.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(form, 'Укажите дату', 'date');
      const rec = { title, date, time: fd.get('time') || '09:00', repeat: fd.get('repeat'), day: parseISO(date).getDate(), note: String(fd.get('note') || '').trim(), active: r ? fd.get('active') === 'on' : true };
      if (r) Object.assign(r, rec);
      else db.reminders.push({ id: uid(), ...rec });
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => render());
      toast(`Напомню ${dayLabel(rec.date).toLowerCase()} в ${rec.time}`);
    },
    onDelete: r ? () => { if (!confirm('Удалить напоминание?')) return false; db.reminders = db.reminders.filter((x) => x !== r); } : null,
  });
}

function labelModal(l = null) {
  const cur = l || { name: '', color: COLORS[(db.labels.length * 3 + 5) % COLORS.length] };
  openModal(l ? 'Метка' : 'Новая метка', `
    <label class="f">Название<input type="text" name="name" value="${esc(cur.name)}" maxlength="30" placeholder="Например: Отпуск"></label>
    <div class="f"><span class="lbl">Цвет</span>${colorPicker('color', cur.color)}</div>`, {
    onOpen(form) { bindAppearance(form); form.elements.name.focus(); },
    onSubmit(fd, form) {
      const name = String(fd.get('name') || '').trim();
      if (!name) return fail(form, 'Введите название метки', 'name');
      if (db.labels.some((x) => x !== l && x.name.toLowerCase() === name.toLowerCase())) return fail(form, 'Такая метка уже есть', 'name');
      if (l) Object.assign(l, { name, color: fd.get('color') });
      else db.labels.push({ id: uid(), name, color: fd.get('color') });
    },
    onDelete: l ? () => {
      if (!confirm(`Удалить метку «${l.name}»? Записи останутся.`)) return false;
      db.transactions.forEach((t) => { if (t.labels) t.labels = t.labels.filter((x) => x !== l.id); });
      db.labels = db.labels.filter((x) => x !== l);
      if (ui.label === l.id) ui.label = '';
      if (ui.rep.label === l.id) ui.rep.label = '';
    } : null,
  });
}

function goalModal(g = null) {
  const cur = g || { name: '', icon: 'target', color: COLORS[(db.goals.length * 4 + 6) % COLORS.length], target: '', saved: 0, deadline: '' };
  openModal(g ? 'Цель' : 'Новая цель', `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
      <span id="goal-preview"></span>
      <label class="f" style="flex:1;margin:0">Название<input type="text" name="name" value="${esc(cur.name)}" maxlength="60" placeholder="Например: Новая машина"></label>
    </div>
    <div class="two">
      <label class="f">Нужно<input class="num" type="text" inputmode="decimal" name="target" value="${esc(cur.target)}"></label>
      <label class="f">Уже накоплено<input class="num" type="text" inputmode="decimal" name="saved" value="${esc(cur.saved)}"></label>
    </div>
    <label class="f">Срок (необязательно)<input type="date" name="deadline" value="${esc(cur.deadline)}"></label>
    <div class="f"><span class="lbl">Цвет</span>${colorPicker('color', cur.color)}</div>
    <div class="f"><span class="lbl">Иконка</span>${iconPicker('icon', cur.icon, cur.color)}</div>
    ${g ? `<label class="switch"><input type="checkbox" name="done" ${g.done ? 'checked' : ''}> Отметить как достигнутую</label>` : ''}`, {
    onOpen(form) { bindAppearance(form, { iconField: 'icon', preview: '#goal-preview' }); form.elements.name.focus(); },
    onSubmit(fd, form) {
      const name = String(fd.get('name') || '').trim();
      if (!name) return fail(form, 'Введите название цели', 'name');
      const target = round2(parseAmount(fd.get('target')));
      if (!(target > 0)) return fail(form, 'Укажите сумму цели', 'target');
      const saved = round2(parseAmount(fd.get('saved') || 0));
      if (!(saved >= 0)) return fail(form, 'Некорректная накопленная сумма', 'saved');
      const rec = { name, icon: fd.get('icon'), color: fd.get('color'), target, saved, deadline: fd.get('deadline') || '', done: fd.get('done') === 'on' };
      if (g) Object.assign(g, rec);
      else db.goals.push({ id: uid(), ...rec });
      if (rec.saved >= rec.target) toast('Цель достигнута!');
    },
    onDelete: g ? () => { if (!confirm(`Удалить цель «${g.name}»?`)) return false; db.goals = db.goals.filter((x) => x !== g); } : null,
  });
}

function goalAddModal(g) {
  openModal(`Пополнить: ${g.name}`, `
    <p class="muted small" style="margin-top:0">Накоплено ${esc(fmt(g.saved))} из ${esc(fmt(g.target))}. Чтобы снять деньги с цели, введите отрицательную сумму.</p>
    <label class="f">Сумма<input class="amount-input num" type="text" inputmode="decimal" name="amount"></label>`, {
    submitText: 'Пополнить',
    onOpen(form) { form.elements.amount.focus(); },
    onSubmit(fd, form) {
      const v = round2(parseAmount(fd.get('amount')));
      if (!Number.isFinite(v) || v === 0) return fail(form, 'Введите сумму', 'amount');
      g.saved = Math.max(0, round2(g.saved + v));
      if (g.saved >= g.target) { g.done = true; toast('Цель достигнута!'); } else toast('Цель пополнена');
    },
  });
}

function debtModal(d = null) {
  const cur = d || { kind: 'lent', person: '', amount: '', date: today(), due: '', note: '', payments: [] };
  const history = d && d.payments.length ? `<div class="f"><span class="lbl">История возвратов</span><ul class="list">${[...d.payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => `
    <li class="row" style="cursor:default"><span class="mid">${esc(dayLabel(p.date))}</span><span class="amt num">${esc(fmt(p.amount))}</span>
    <button type="button" class="icon-btn" data-del-pay="${p.id}" aria-label="Удалить возврат">${icon('x')}</button></li>`).join('')}</ul></div>` : '';
  openModal(d ? 'Долг' : 'Новый долг', `
    <div class="seg"><button type="button" data-kind="lent">Я дал в долг</button><button type="button" data-kind="borrowed">Я взял в долг</button></div>
    <input type="hidden" name="kind" value="${cur.kind}">
    <label class="f">Кто<input type="text" name="person" value="${esc(cur.person)}" maxlength="60" placeholder="Имя"></label>
    <label class="f">Сумма<input class="num" type="text" inputmode="decimal" name="amount" value="${esc(cur.amount)}"></label>
    <div class="two">
      <label class="f">Дата<input type="date" name="date" value="${esc(cur.date)}"></label>
      <label class="f">Вернуть до<input type="date" name="due" value="${esc(cur.due)}"></label>
    </div>
    <label class="f">Комментарий<input type="text" name="note" value="${esc(cur.note)}" maxlength="200"></label>
    ${history}`, {
    onOpen(form) {
      const sync = () => form.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === form.elements.kind.value));
      form.addEventListener('click', (e) => {
        const k = e.target.closest('[data-kind]');
        if (k) { form.elements.kind.value = k.dataset.kind; sync(); }
        const del = e.target.closest('[data-del-pay]');
        if (del && confirm('Удалить этот возврат?')) {
          d.payments = d.payments.filter((p) => p.id !== del.dataset.delPay);
          del.closest('li').remove();
          save(); render();
        }
      });
      sync();
      form.elements.person.focus();
    },
    onSubmit(fd, form) {
      const person = String(fd.get('person') || '').trim();
      if (!person) return fail(form, 'Укажите, с кем долг', 'person');
      const amount = round2(parseAmount(fd.get('amount')));
      if (!(amount > 0)) return fail(form, 'Введите сумму больше нуля', 'amount');
      const rec = { kind: fd.get('kind'), person, amount, date: fd.get('date') || today(), due: fd.get('due') || '', note: String(fd.get('note') || '').trim() };
      if (d) Object.assign(d, rec);
      else db.debts.push({ id: uid(), ...rec, payments: [] });
    },
    onDelete: d ? () => { if (!confirm(`Удалить долг (${d.person})?`)) return false; db.debts = db.debts.filter((x) => x !== d); } : null,
  });
}

function debtPayModal(d) {
  const left = debtLeft(d);
  openModal(`Возврат: ${d.person}`, `
    <p class="muted small" style="margin-top:0">Осталось ${esc(fmt(left))}</p>
    <label class="f">Сумма<input class="amount-input num" type="text" inputmode="decimal" name="amount" value="${left}"></label>
    <label class="f">Дата<input type="date" name="date" value="${today()}"></label>`, {
    submitText: 'Записать',
    onOpen(form) { form.elements.amount.select(); },
    onSubmit(fd, form) {
      const amount = round2(parseAmount(fd.get('amount')));
      if (!(amount > 0)) return fail(form, 'Введите сумму больше нуля', 'amount');
      if (amount > left) return fail(form, `Больше остатка долга (${fmt(left)})`, 'amount');
      d.payments.push({ id: uid(), date: fd.get('date') || today(), amount });
      toast(amount === left ? 'Долг погашен' : 'Возврат записан');
    },
  });
}

/* ============================== Импорт и экспорт ============================== */

function csvCell(v) {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvNum = (n) => String(round2(n)).replace('.', ',');

function exportCsv() {
  const head = ['Дата', 'Тип', 'Счёт', 'Категория', 'Сумма', 'Счёт зачисления', 'Комментарий', 'Метки'];
  const rows = [...db.transactions].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
    const a = accById(t.accountId), to = accById(t.toAccountId);
    return [t.date, TX_TYPES[t.type], a?.name, catById(t.categoryId)?.name, csvNum(t.amount),
      to?.name, t.note,
      (t.labels || []).map((l) => labelById(l)?.name).filter(Boolean).join(', ')];
  });
  const text = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  download(`monetka-${today()}.csv`, text, 'text/csv;charset=utf-8');
}

function exportReportCsv() {
  const { range, list, total } = reportData();
  const rows = [
    [`Отчёт: ${reportTitle()}`], [`Период: ${range.label} (${range.from} — ${range.to})`], ['Итого', csvNum(total)], [],
    ['Дата', 'Категория', 'Описание', 'Счёт', 'Сумма', 'Метки'],
    ...list.map((t) => {
      const a = accById(t.accountId);
      return [t.date, catById(t.categoryId)?.name || '', t.note, a?.name, csvNum(t.amount),
        (t.labels || []).map((l) => labelById(l)?.name).filter(Boolean).join(', ')];
    }),
  ];
  const name = reportTitle().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
  download(`otchet-${name}-${range.from}.csv`, '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function normDate(s) {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}

async function importCsv() {
  const file = await pickFile('.csv,text/csv');
  if (!file) return;
  const rows = parseCsv(await file.text());
  if (rows.length < 2) { toast('В файле нет строк с операциями'); return; }
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const exact = (...names) => head.findIndex((h) => names.includes(h));
  const ix = {
    date: exact('дата', 'date'), type: exact('тип', 'type'), acc: exact('счёт', 'счет', 'account'), cat: exact('категория', 'category'),
    amount: exact('сумма', 'amount'), to: exact('счёт зачисления', 'счет зачисления', 'to account'),
    note: exact('комментарий', 'описание', 'note', 'description'), labels: exact('метки', 'labels', 'tags'),
  };
  if (ix.date < 0 || ix.amount < 0) { toast('Нужны как минимум столбцы «Дата» и «Сумма»'); return; }

  const findOrCreateAccount = (name) => {
    name = (name || 'Импорт').trim();
    let a = db.accounts.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!a) {
      a = { id: uid(), name, type: 'card', initial: 0, color: COLORS[(db.accounts.length * 3 + 4) % COLORS.length] };
      db.accounts.push(a);
    }
    return a;
  };
  const findOrCreateCategory = (name, type) => {
    if (!name || !name.trim()) return null;
    let c = db.categories.find((x) => x.type === type && x.name.toLowerCase() === name.trim().toLowerCase());
    if (!c) { c = { id: uid(), type, name: name.trim(), icon: 'tag', color: COLORS[db.categories.length % COLORS.length] }; db.categories.push(c); }
    return c.id;
  };

  let ok = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (i) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const date = normDate(get(ix.date));
    const raw = parseAmount(get(ix.amount));
    if (!date || !Number.isFinite(raw) || raw === 0) { skipped++; continue; }
    const tRaw = get(ix.type).toLowerCase();
    let type = { 'расход': 'expense', 'expense': 'expense', 'доход': 'income', 'income': 'income', 'перевод': 'transfer', 'transfer': 'transfer' }[tRaw];
    if (!type) type = raw < 0 ? 'expense' : 'income';
    const acc = findOrCreateAccount(get(ix.acc));
    const t = { id: uid(), type, accountId: acc.id, amount: round2(Math.abs(raw)), date, note: get(ix.note) };
    if (type === 'transfer') {
      const toName = get(ix.to);
      if (!toName) { skipped++; continue; }
      const to = findOrCreateAccount(toName);
      t.toAccountId = to.id;
    } else {
      t.categoryId = findOrCreateCategory(get(ix.cat), type);
    }
    const labels = get(ix.labels).split(',').map((s) => s.trim()).filter(Boolean).map((name) => {
      let l = db.labels.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!l) { l = { id: uid(), name, color: COLORS[(db.labels.length * 3 + 5) % COLORS.length] }; db.labels.push(l); }
      return l.id;
    });
    if (labels.length) t.labels = labels;
    db.transactions.push(t);
    ok++;
  }
  save(); render();
  toast(`Импортировано: ${ok}${skipped ? `, пропущено: ${skipped}` : ''}`);
}

async function importJson() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) throw new Error('format');
    if (!confirm('Заменить текущие данные данными из резервной копии?')) return;
    db = normalize(data);
    save(); applyTheme(); render();
    toast('Данные восстановлены');
  } catch {
    toast('Файл не похож на резервную копию Монетки');
  }
}

/* ============================== События ============================== */

document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (nav) { go(nav.dataset.view); return; }
  const el = e.target.closest('[data-act]');
  if (!el || modal.contains(el)) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'go': go(el.dataset.view); break;
    case 'go-plan': ui.planTab = el.dataset.t; go('budgets'); break;
    case 'month': ui.month = shiftMonth(ui.month, Number(el.dataset.d)); render(); break;
    case 'edit-tx': txModal(db.transactions.find((t) => t.id === id)); break;
    case 'new-tx': txModal(); break;
    case 'open-account': ui.acc = id; go('transactions'); break;
    case 'new-account': accountModal(); break;
    case 'edit-account': accountModal(accById(id)); break;
    case 'new-category': categoryModal(); break;
    case 'edit-category': categoryModal(catById(id)); break;
    case 'cat-tab': ui.catTab = el.dataset.t; render(); break;
    case 'new-budget': budgetModal(); break;
    case 'edit-budget': budgetModal(db.budgets.find((b) => b.id === id)); break;
    case 'edit-recurring': recurringModal(db.recurring.find((r) => r.id === id)); break;
    case 'plan-tab': ui.planTab = el.dataset.t; render(); break;
    case 'stats-tab': ui.statsTab = el.dataset.t; render(); break;
    case 'new-label': labelModal(); break;
    case 'edit-label': labelModal(labelById(id)); break;
    case 'new-goal': goalModal(); break;
    case 'edit-goal': goalModal(db.goals.find((g) => g.id === id)); break;
    case 'goal-add': goalAddModal(db.goals.find((g) => g.id === id)); break;
    case 'new-debt': debtModal(); break;
    case 'edit-debt': debtModal(db.debts.find((d) => d.id === id)); break;
    case 'debt-pay': debtPayModal(db.debts.find((d) => d.id === id)); break;
    case 'new-reminder': reminderModal(); break;
    case 'edit-reminder': reminderModal(db.reminders.find((r) => r.id === id)); break;
    case 'reminder-done': completeReminder(db.reminders.find((r) => r.id === id)); save(); render(); break;
    case 'clear-done-reminders': db.reminders = db.reminders.filter((r) => r.active); save(); render(); break;
    case 'ask-notify':
      Notification.requestPermission().then((p) => { toast(p === 'granted' ? 'Уведомления включены' : 'Уведомления не разрешены'); render(); });
      break;
    case 'report-cat': {
      const rep = ui.rep;
      rep.type = el.dataset.type;
      rep.cat = id || 'none';
      if (el.dataset.month) {
        const mk = el.dataset.month, cm = monthOf(today());
        if (mk === cm) rep.period = 'this';
        else if (mk === shiftMonth(cm, -1)) rep.period = 'prev';
        else Object.assign(rep, { period: 'custom', from: `${mk}-01`, to: monthEnd(mk) });
      }
      ui.statsTab = 'report';
      go('stats');
      break;
    }
    case 'rep-type': ui.rep.type = el.dataset.t; ui.rep.cat = ''; render(); break;
    case 'rep-csv': exportReportCsv(); break;
    case 'rep-print': window.print(); break;
    case 'theme': db.settings.theme = el.dataset.t; save(); applyTheme(); render(); break;
    case 'go-sync': go('more'); break;
    case 'sync': Sync.syncNow(true); break;
    case 'sync-disconnect':
      if (confirm('Отключить синхронизацию на этом устройстве? Данные здесь и в облаке сохранятся.')) Sync.disconnect();
      break;
    case 'sync-delete-cloud':
      if (confirm('Удалить копию данных из Google Диска? На этом устройстве данные останутся, другие устройства перестанут получать обновления.')) Sync.deleteCloudCopy();
      break;
    case 'export-csv': exportCsv(); break;
    case 'import-csv': importCsv(); break;
    case 'export-json': download(`monetka-backup-${today()}.json`, JSON.stringify(db, null, 2), 'application/json'); break;
    case 'import-json': importJson(); break;
    case 'load-demo':
      if (confirm(Sync.connected ? 'Заменить данные демонстрационными? Синхронизация включена — данные заменятся и на других устройствах.' : 'Заменить текущие данные демонстрационными?')) { db = demoDb(); save(); applyTheme(); render(); toast('Демо-данные загружены'); }
      break;
    case 'wipe':
      if (confirm(Sync.connected ? 'Удалить все данные? Синхронизация включена — данные удалятся и на других устройствах. Это нельзя отменить.' : 'Удалить все счета, записи, бюджеты и напоминания? Это нельзя отменить.')) {
        db = { ...emptyDb(), settings: db.settings }; save(); render(); toast('Все данные удалены');
      }
      break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    ui.q = e.target.value;
    clearTimeout(ui.qt);
    ui.qt = setTimeout(() => {
      const pos = e.target.selectionStart;
      render();
      const q = $('#q');
      q.focus(); q.setSelectionRange(pos, pos);
    }, 200);
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (modal.contains(t)) return;
  const rep = ui.rep;
  switch (t.id) {
    case 'f-acc': ui.acc = t.value; break;
    case 'f-type': ui.type = t.value; break;
    case 'f-label': ui.label = t.value; break;
    case 'rep-cat': rep.cat = t.value; break;
    case 'rep-label': rep.label = t.value; break;
    case 'rep-acc': rep.acc = t.value; break;
    case 'rep-sort': rep.sort = t.value; break;
    case 'rep-period': {
      if (t.value === 'custom') { const r = periodRange(rep); Object.assign(rep, { from: r.from, to: r.to }); }
      rep.period = t.value;
      break;
    }
    case 'rep-from': rep.from = t.value; if (rep.to && rep.to < rep.from) rep.to = rep.from; break;
    case 'rep-to': rep.to = t.value; if (rep.from && rep.from > rep.to) rep.from = rep.to; break;
    default: return;
  }
  render();
});

$('#fab').addEventListener('click', () => txModal());
$('#nav-add').addEventListener('click', () => txModal());

document.addEventListener('keydown', (e) => {
  if (modal.open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'n' || e.key === 'т' || e.key === '+') { e.preventDefault(); txModal(); }
});

// Свайп влево/вправо на телефоне — соседний раздел нижнего меню.
// Не срабатывает в открытом окне, в полях ввода и в лентах с горизонтальной прокруткой.
{
  let sx = 0, sy = 0, st = 0, tracking = false;
  const main = $('#main');
  main.addEventListener('touchstart', (e) => {
    tracking = e.touches.length === 1 && !modal.open && innerWidth <= 760
      && !e.target.closest('input, select, textarea, .seg.scroll, .cat-grid, .icon-grid, .chips');
    if (!tracking) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  main.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - st > 700) return;
    const views = [...document.querySelectorAll('.nav-item')].map((b) => b.dataset.view);
    const next = views[views.indexOf(ui.view) + (dx < 0 ? 1 : -1)];
    if (!next) return;
    go(next);
    main.classList.remove('slide-l', 'slide-r');
    void main.offsetWidth;
    main.classList.add(dx < 0 ? 'slide-l' : 'slide-r');
  }, { passive: true });
}

/* ============================== Старт ============================== */

document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
$('#fab').innerHTML = icon('plus');

Sync.init();
try { if (!localStorage.getItem(STORE_KEY)) save(); } catch { /* хранилище недоступно — работаем в памяти */ }
applyTheme();
processRecurring();
checkReminders();
render();

setInterval(() => {
  if (checkReminders() && !modal.open && ['overview', 'budgets'].includes(ui.view)) render();
}, 30000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
