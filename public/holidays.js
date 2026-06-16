// ── 2026 Public Holidays by location ─────────────────────────────────────────
// Used by both working-day calculator and calendar display
// Format: YYYY-MM-DD

const HOLIDAYS_2026 = {

  // ── PORTUGAL (national) ───────────────────────────────────────────────────
  PT: [
    '2026-01-01', // New Year's Day
    '2026-04-03', // Good Friday
    '2026-04-05', // Easter Sunday
    '2026-04-25', // Freedom Day
    '2026-05-01', // Labour Day
    '2026-06-04', // Corpus Christi
    '2026-06-10', // Portugal Day
    '2026-08-15', // Assumption
    '2026-10-05', // Republic Day
    '2026-11-01', // All Saints Day
    '2026-12-01', // Restoration of Independence
    '2026-12-08', // Immaculate Conception
    '2026-12-25', // Christmas Day
  ],

  // Portugal regional — Portalegre (Alentejo): São Pedro (June 29)
  PT_PORTALEGRE: [
    '2026-06-13', // Santo António (Lisbon/Alentejo region)
    '2026-06-29', // São Pedro — Portalegre patron saint
  ],

  // Portugal regional — Porto: São João (June 24)
  PT_PORTO: [
    '2026-06-24', // São João — Porto patron saint
  ],

  // ── SPAIN (national) ──────────────────────────────────────────────────────
  ES: [
    '2026-01-01', // New Year's Day
    '2026-01-06', // Epiphany
    '2026-04-03', // Good Friday
    '2026-05-01', // Labour Day
    '2026-08-15', // Assumption
    '2026-10-12', // Spain National Day
    '2026-11-01', // All Saints Day
    '2026-12-06', // Constitution Day (Sunday, observed Mon Dec 7)
    '2026-12-07', // Constitution Day observed
    '2026-12-08', // Immaculate Conception
    '2026-12-25', // Christmas Day
  ],

  // Spain regional — Madrid
  ES_MADRID: [
    '2026-03-19', // San José (Father's Day / Madrid regional)
    '2026-04-02', // Maundy Thursday
    '2026-05-02', // Comunidad de Madrid Day
    '2026-05-15', // San Isidro (Madrid patron saint)
    '2026-11-09', // Almudena (Madrid city patron)
    '2026-12-07', // Constitution Day bridge
  ],

  // Spain regional — Catalunya
  ES_CATALUNYA: [
    '2026-04-06', // Easter Monday
    '2026-06-24', // Sant Joan
    '2026-09-11', // Diada Nacional de Catalunya
    '2026-09-24', // La Mercè (Barcelona)
    '2026-12-26', // St. Stephen's Day
  ],

  // ── ITALY (national) ─────────────────────────────────────────────────────
  IT: [
    '2026-01-01', // New Year's Day
    '2026-01-06', // Epiphany
    '2026-04-05', // Easter Sunday
    '2026-04-06', // Easter Monday
    '2026-04-25', // Liberation Day
    '2026-05-01', // Labour Day
    '2026-06-02', // Republic Day
    '2026-08-15', // Ferragosto / Assumption
    '2026-11-01', // All Saints Day
    '2026-12-08', // Immaculate Conception
    '2026-12-25', // Christmas Day
    '2026-12-26', // St. Stephen's Day
  ],

  // Italy regional — Friuli Venezia Giulia
  // Patron saint of Trieste: San Giusto (Nov 3)
  // Patron saint of Udine: Sant'Ermacora e Fortunato (July 12) — but Udine is main city
  IT_FRIULI: [
    '2026-11-03', // San Giusto — Trieste patron saint (main FVG city)
  ],

  // ── USA — North Carolina ──────────────────────────────────────────────────
  US_NC: [
    '2026-01-01', // New Year's Day
    '2026-01-19', // Martin Luther King Jr. Day
    '2026-02-16', // Presidents' Day
    '2026-04-03', // Good Friday (NC state holiday)
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-03', // Independence Day observed (July 4 falls on Saturday)
    '2026-09-07', // Labor Day
    '2026-10-12', // Columbus Day (NC state)
    '2026-11-11', // Veterans Day
    '2026-11-26', // Thanksgiving Day
    '2026-11-27', // Day after Thanksgiving (NC state)
    '2026-12-24', // Christmas Eve (NC state)
    '2026-12-25', // Christmas Day
  ],

  // ── JAPAN (national + Tokyo — no additional Tokyo regional holidays) ───────
  JP: [
    '2026-01-01', // New Year's Day
    '2026-01-12', // Coming of Age Day
    '2026-02-11', // National Foundation Day
    '2026-02-23', // Emperor's Birthday
    '2026-03-20', // Vernal Equinox Day
    '2026-04-29', // Showa Day
    '2026-05-03', // Constitution Memorial Day (Sunday → May 6 observed)
    '2026-05-04', // Greenery Day
    '2026-05-05', // Children's Day
    '2026-05-06', // Observed holiday (Constitution Memorial Day substitute)
    '2026-07-20', // Marine Day
    '2026-08-11', // Mountain Day
    '2026-09-21', // Respect for the Aged Day
    '2026-09-22', // Citizens' Holiday (sandwiched between two holidays)
    '2026-09-23', // Autumnal Equinox Day
    '2026-10-12', // Sports Day
    '2026-11-03', // Culture Day
    '2026-11-23', // Labor Thanksgiving Day
  ],
};

// Map user location/state to holiday set keys
function getHolidayKeys(user) {
  const loc = (user.location || '').toLowerCase();
  const state = (user.state || '').toLowerCase();
  const keys = [];

  if (loc === 'portugal') {
    keys.push('PT');
    if (state.toLowerCase().includes('portalegre')) keys.push('PT_PORTALEGRE');
    if (state.toLowerCase().includes('porto')) keys.push('PT_PORTO');
  } else if (loc === 'spain') {
    keys.push('ES');
    if (state.toLowerCase().includes('madrid')) keys.push('ES_MADRID');
    if (state.toLowerCase().includes('catalunya') || state.toLowerCase().includes('catalun')) keys.push('ES_CATALUNYA');
  } else if (loc === 'italy') {
    keys.push('IT');
    if (state.toLowerCase().includes('friuli')) keys.push('IT_FRIULI');
  } else if (loc === 'us') {
    keys.push('US_NC'); // All US staff are in NC
  } else if (loc === 'japan') {
    keys.push('JP');
  }

  return keys;
}

// Get all holiday dates for a user as a Set of strings
function getUserHolidays(user) {
  const keys = getHolidayKeys(user);
  const dates = new Set();
  for (const key of keys) {
    (HOLIDAYS_2026[key] || []).forEach(d => dates.add(d));
  }
  return dates;
}

// Calculate working days between two dates, excluding weekends and holidays for a user
function calcWorkingDaysForUser(start, end, user) {
  const holidays = getUserHolidays(user);
  let s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  while (s <= e) {
    const dow = s.getDay();
    const ds = s.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidays.has(ds)) count++;
    s.setDate(s.getDate() + 1);
  }
  return count;
}

// Generic version (no user — just skip weekends)
function calcWorkingDaysBasic(start, end) {
  let s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  while (s <= e) {
    const dow = s.getDay();
    if (dow !== 0 && dow !== 6) count++;
    s.setDate(s.getDate() + 1);
  }
  return count;
}

// Get all holidays for calendar display for a given month/year and list of users
function getHolidaysForMonth(year, month, users) {
  // Returns array of {date, name, users: [userIds]}
  // For calendar display — aggregate all holidays visible to current user's team
  const byDate = {};

  for (const user of users) {
    const keys = getHolidayKeys(user);
    for (const key of keys) {
      // Get holiday name lookup
      const dates = HOLIDAYS_2026[key] || [];
      dates.forEach(d => {
        const [y, m] = d.split('-').map(Number);
        if (y === year && m === month + 1) {
          if (!byDate[d]) byDate[d] = { date: d, locations: new Set() };
          byDate[d].locations.add(user.location || key);
        }
      });
    }
  }

  return byDate;
}

// Holiday name lookup (for calendar tooltips)
const HOLIDAY_NAMES = {
  '2026-01-01': 'New Year\'s Day',
  '2026-01-06': 'Epiphany',
  '2026-01-12': 'Coming of Age Day',
  '2026-01-19': 'MLK Jr. Day',
  '2026-02-11': 'National Foundation Day',
  '2026-02-16': 'Presidents\' Day',
  '2026-02-23': 'Emperor\'s Birthday',
  '2026-03-19': 'San José',
  '2026-03-20': 'Vernal Equinox',
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-05': 'Easter Sunday',
  '2026-04-06': 'Easter Monday',
  '2026-04-25': 'Freedom Day / Liberation Day',
  '2026-04-29': 'Showa Day',
  '2026-05-01': 'Labour Day',
  '2026-05-02': 'Madrid Day',
  '2026-05-03': 'Constitution Memorial Day',
  '2026-05-04': 'Greenery Day',
  '2026-05-05': 'Children\'s Day',
  '2026-05-06': 'Observed Holiday',
  '2026-05-15': 'San Isidro',
  '2026-05-25': 'Memorial Day',
  '2026-06-02': 'Republic Day',
  '2026-06-04': 'Corpus Christi',
  '2026-06-10': 'Portugal Day',
  '2026-06-13': 'Santo António',
  '2026-06-19': 'Juneteenth',
  '2026-06-24': 'Sant Joan / São João',
  '2026-06-29': 'São Pedro',
  '2026-07-03': 'Independence Day (observed)',
  '2026-07-20': 'Marine Day',
  '2026-08-11': 'Mountain Day',
  '2026-08-15': 'Assumption',
  '2026-09-07': 'Labor Day',
  '2026-09-11': 'Diada Nacional de Catalunya',
  '2026-09-21': 'Respect for the Aged Day',
  '2026-09-22': 'Citizens\' Holiday',
  '2026-09-23': 'Autumnal Equinox Day',
  '2026-09-24': 'La Mercè',
  '2026-10-05': 'Republic Day',
  '2026-10-12': 'Spain National Day / Columbus Day / Sports Day',
  '2026-11-01': 'All Saints Day',
  '2026-11-03': 'Culture Day / San Giusto',
  '2026-11-09': 'Almudena',
  '2026-11-11': 'Veterans Day',
  '2026-11-23': 'Labor Thanksgiving Day',
  '2026-11-26': 'Thanksgiving',
  '2026-11-27': 'Day after Thanksgiving',
  '2026-12-01': 'Restoration of Independence',
  '2026-12-06': 'Constitution Day',
  '2026-12-07': 'Constitution Day (observed)',
  '2026-12-08': 'Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-26': 'St. Stephen\'s Day',
};
