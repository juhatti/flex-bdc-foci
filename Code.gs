/**
 * Flex BDC Foci - Emlékeztető email küldő & Egyenleg biztonsági mentés (Google Sheets: "balance" munkalap)
 * 
 * Telepítés a Google Sheets-ben:
 * 1. Nyisd meg a "flex-bdc-foci" Google Sheets táblázatot, és legyen benne egy "balance" nevű munkalap.
 * 2. Bővítmények -> Apps Script -> másold be ezt a kódot.
 * 3. Eseményindítók (Triggers) -> Új eseményindító:
 *    - Függvény: checkAndSendMatchReminder
 *    - Eseményforrás: Idővezérelt -> Percalapú időzítő -> 5 vagy 10 percenként (így a "Küldés most" gomb is azonnal lefut, és az automatikus X nappal korábbi küldés is megtörténik).
 */

const FIREBASE_DB_URL = 'https://flex-bdc-foci-default-rtdb.europe-west1.firebasedatabase.app';
const FIREBASE_AUTH_SECRET = 'AUTH_SECRET_GOES_HERE';
const APP_URL = 'https://juhatti.github.io/flex-bdc-foci/';
const LOGO_URL = 'https://juhatti.github.io/flex-bdc-foci/flex-bdc-logo.png';
const CC_EMAIL = 'juhatti@gmail.com';
const BALANCE_SHEET_NAME = 'balance';

/**
 * Fő belépési pont (időzített triggerhez).
 * Lefut, ha:
 *  - admin megnyomta a "Küldés most" gombot (sendReminderNow === true), VAGY
 *  - be van kapcsolva az emlékeztető (reminderEnabled !== false), még nem ment ki erre a meccsre,
 *    és a meccs dátuma <= ma + reminderDaysBefore nap (pl. 5 nappal korábban, reggel 8 után).
 */
function checkAndSendMatchReminder() {
  const nextMatch = fetchFirebaseJson('/nextMatch.json');
  if (!nextMatch || !nextMatch.date) return;

  const isManualTrigger = nextMatch.sendReminderNow === true;

  if (!isManualTrigger) {
    if (nextMatch.reminderEnabled === false) return;
    if (nextMatch.reminderSentForDate === nextMatch.date) return;

    const matchDate = parseHungarianDate(nextMatch.date);
    if (!matchDate) return;

    const now = new Date();
    // Reggel 8:00 előtt ne küldjön automatikus levelet
    if (now.getHours() < 8) return;

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matchMidnight = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
    const diffDays = Math.round((matchMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
    const daysBefore = parseInt(nextMatch.reminderDaysBefore, 10) || 5;

    if (diffDays > daysBefore || diffDays < 0) {
      return;
    }
  }

  executeReminderAndBackup(nextMatch);
}

/**
 * Kézzel is futtatható az Apps Script szerkesztőből teszteléshez / azonnali küldéshez.
 */
function sendReminderManually() {
  const nextMatch = fetchFirebaseJson('/nextMatch.json');
  if (!nextMatch || !nextMatch.date) {
    throw new Error('Nem található nextMatch adat a Firebase-ben.');
  }
  executeReminderAndBackup(nextMatch);
}

function executeReminderAndBackup(nextMatch) {
  const usersObj = fetchFirebaseJson('/users.json') || {};
  const transactionsObj = fetchFirebaseJson('/transactions.json') || {};
  const treasuryRaw = fetchFirebaseJson('/treasury.json') || [];

  const usersList = Object.entries(usersObj)
    .map(([key, u]) => ({ ...u, id: String(u.id || key) }))
    .filter(u => u.pending !== true);

  // 1. Biztonsági mentés a Google Sheets "balance" munkalapra
  backupFinancesToSheet(usersList, transactionsObj, treasuryRaw);

  // 2. Feliratkozók összegyűjtése (matchReminder === true és van érvényes email)
  const recipients = usersList
    .filter(u => u.matchReminder === true && u.email && String(u.email).includes('@'))
    .map(u => String(u.email).trim());

  const uniqueRecipients = Array.from(new Set(recipients));

  if (uniqueRecipients.length > 0 || CC_EMAIL) {
    const subject = `Flex BDC Foci [${nextMatch.date}]`;
    const htmlBody = buildReminderHtmlEmail(nextMatch);
    const plainBody = buildReminderPlainEmail(nextMatch);

    const toField = uniqueRecipients.length > 0 ? uniqueRecipients.join(',') : CC_EMAIL;
    const mailOptions = {
      to: toField,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'Flex BDC Foci'
    };

    if (uniqueRecipients.length > 0 && CC_EMAIL) {
      mailOptions.cc = CC_EMAIL;
    }

    MailApp.sendEmail(mailOptions);
  }

  // 3. Firebase állapot frissítése (ne küldje ki újra ugyanarra a meccsre)
  patchFirebaseJson('/nextMatch.json', {
    reminderSentForDate: nextMatch.date,
    sendReminderNow: false
  });
}

/**
 * Pénzügyi pillanatkép mentése a "balance" munkalapra:
 * - 1. sor: dátumok (új oszlop minden email kiküldésnél)
 * - A2: "Csapatkassza", alatta (A3..): userek nevei (#ID)
 * - Az új dátum oszlopában a 2. sorban a kassza, alatta minden user aktuális egyenlege
 */
function backupFinancesToSheet(usersList, transactionsObj, treasuryRaw) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BALANCE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BALANCE_SHEET_NAME);
  }

  const treasuryArr = Array.isArray(treasuryRaw) ? treasuryRaw : Object.values(treasuryRaw || {});
  const treasuryBalance = treasuryArr.reduce((sum, t) => sum + (parseInt(t && t.amount, 10) || 0), 0);

  const sortedUsers = [...usersList].sort((a, b) => String(a.id).localeCompare(String(b.id), 'hu', { numeric: true }));

  if (!sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1).setValue('Megnevezés / Dátum').setFontWeight('bold');
  }
  sheet.getRange(2, 1).setValue('Csapatkassza').setFontWeight('bold');

  const lastRow = Math.max(sheet.getLastRow(), 2);
  const existingLabels = lastRow >= 3
    ? sheet.getRange(3, 1, lastRow - 2, 1).getValues().map(r => String(r[0] || ''))
    : [];

  const rowIndexByUserId = {};
  existingLabels.forEach((label, idx) => {
    const match = label.match(/\(#([^)]+)\)/);
    if (match) {
      rowIndexByUserId[match[1]] = idx + 3;
    }
  });

  let nextAvailableRow = Math.max(lastRow + 1, 3);
  sortedUsers.forEach(u => {
    const uid = String(u.id);
    if (!rowIndexByUserId[uid]) {
      rowIndexByUserId[uid] = nextAvailableRow;
      sheet.getRange(nextAvailableRow, 1).setValue(`${u.name} (#${uid})`);
      nextAvailableRow++;
    } else {
      sheet.getRange(rowIndexByUserId[uid], 1).setValue(`${u.name} (#${uid})`);
    }
  });

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const targetCol = lastCol + 1;

  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Budapest', 'yyyy. MM. dd. HH:mm');
  sheet.getRange(1, targetCol).setValue(nowStr).setFontWeight('bold').setHorizontalAlignment('center');

  const treasuryCell = sheet.getRange(2, targetCol);
  treasuryCell.setValue(treasuryBalance).setNumberFormat('#,##0" Ft"').setFontWeight('bold');

  sortedUsers.forEach(u => {
    const uid = String(u.id);
    const userTrans = transactionsObj[uid] || [];
    const transArr = Array.isArray(userTrans) ? userTrans : Object.values(userTrans);
    const bal = transArr.reduce((sum, t) => sum + (parseInt(t && t.amount, 10) || 0), 0);

    const rowIdx = rowIndexByUserId[uid];
    sheet.getRange(rowIdx, targetCol).setValue(bal).setNumberFormat('#,##0" Ft"');
  });

  sheet.autoResizeColumn(1);
  sheet.autoResizeColumn(targetCol);
}

/**
 * HTML email sablon: SVG nélkül (mivel a levelezőkliensek blokkolják),
 * tiszta Unicode/szöveges jelölőkkel és pontos "jelentkezés" gomb felirattal.
 */
function buildReminderHtmlEmail(nextMatch) {
  const dateStr = nextMatch.date || '';
  const startTime = nextMatch.startTime || '09:00';
  const endTime = nextMatch.endTime || '10:00';
  const location = nextMatch.location || 'ELTE Sport Kft Bogdánfy úti sporttelep';
  const courtFee = (parseInt(nextMatch.courtFee, 10) || 18000).toLocaleString('en-US');
  const feePerPerson = (parseInt(nextMatch.feePerPerson, 10) || 1000).toLocaleString('en-US');
  const calendarUrl = buildGoogleCalendarUrl(nextMatch);

  return `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Logó középen fent -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="${LOGO_URL}" alt="flex bdc" height="112" style="display:block; height:112px; width:auto; border:0;">
            </td>
          </tr>
        </table>

        <!-- Kártya (a honlap "Következő Meccs" kártyájának stílusa) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; border:1px solid #f3f4f6; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <tr>
            <td align="center" style="padding:24px;">
              <span style="display:inline-block; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#059669; background-color:#ecfdf5; padding:4px 12px; border-radius:9999px;">
                Következő Meccs
              </span>

              <h1 style="margin:8px 0 4px 0; font-size:22px; font-weight:800; color:#1f2937; line-height:1.25;">
                ${dateStr} ${startTime} - ${endTime}
              </h1>

              <p style="margin:4px 0 4px 0; font-size:12px; color:#6b7280; line-height:1.4;">
                <span style="color:#059669; font-weight:700; margin-right:3px;">&#9679;</span><span>${location}</span>
              </p>

              <p style="margin:4px 0 24px 0; font-size:12px; color:#9ca3af; line-height:1.4;">
                <span>${courtFee} Ft</span>
                <span style="margin:0 4px;">&bull;</span>
                <span>${feePerPerson} Ft / f&#337;</span>
                <span style="margin:0 4px;">&bull;</span>
                <a href="${calendarUrl}" target="_blank" style="color:#6b7280; text-decoration:underline; font-size:12px; font-weight:500;" title="Google Naptár esemény létrehozása">
                  Naptár
                </a>
              </p>

              <!-- Jelentkezés gomb -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px auto;">
                <tr>
                  <td align="center" bgcolor="#059669" style="border-radius:12px;">
                    <a href="${APP_URL}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:12px;">
                      jelentkezés
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:12px; color:#9ca3af; font-weight:500;">
                Ha változna a részvételed, kérlek időben jelezd!
              </p>
            </td>
          </tr>
        </table>

        <!-- Lábléc -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-top:16px; font-size:11px; color:#9ca3af; line-height:1.5;">
              Az emlékeztető emaileket a profilodban tudod ki- vagy bekapcsolni.<br>
              <a href="${APP_URL}" style="color:#059669; text-decoration:none;">${APP_URL}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildReminderPlainEmail(nextMatch) {
  const dateStr = nextMatch.date || '';
  const startTime = nextMatch.startTime || '09:00';
  const endTime = nextMatch.endTime || '10:00';
  const location = nextMatch.location || 'ELTE Sport Kft Bogdánfy úti sporttelep';
  const courtFee = (parseInt(nextMatch.courtFee, 10) || 18000).toLocaleString('en-US');
  const feePerPerson = (parseInt(nextMatch.feePerPerson, 10) || 1000).toLocaleString('en-US');
  const calendarUrl = buildGoogleCalendarUrl(nextMatch);

  return [
    'FLEX BDC FOCI - KÖVETKEZŐ MECCS',
    '',
    `${dateStr} ${startTime} - ${endTime}`,
    `${location}`,
    `${courtFee} Ft • ${feePerPerson} Ft / fő`,
    '',
    `Jelentkezés: ${APP_URL}`,
    `Google Naptár: ${calendarUrl}`
  ].join('\n');
}

function buildGoogleCalendarUrl(nextMatch) {
  const cleanDate = String(nextMatch.date || '').replace(/\./g, '').trim().replace(/\s+/g, '');
  const startTime = String(nextMatch.startTime || '09:00').replace(':', '');
  const endTime = String(nextMatch.endTime || '10:00').replace(':', '');
  const startIso = `${cleanDate}T${startTime}00`;
  const endIso = `${cleanDate}T${endTime}00`;

  const title = encodeURIComponent('Flex BDC Foci');
  const location = encodeURIComponent(nextMatch.location || 'ELTE Sport Kft Bogdánfy úti sporttelep');
  const details = encodeURIComponent(`Részletek: ${APP_URL}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&location=${location}&details=${details}`;
}

function parseHungarianDate(dateStr) {
  const parts = String(dateStr || '').replace(/\./g, '').trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
}

function buildFirebaseUrl(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${FIREBASE_DB_URL}${path}${separator}auth=${encodeURIComponent(FIREBASE_AUTH_SECRET)}`;
}

function fetchFirebaseJson(path) {
  const res = UrlFetchApp.fetch(buildFirebaseUrl(path), {
    method: 'get',
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`Firebase lekérdezési hiba (${path}): ${res.getResponseCode()} - ${res.getContentText()}`);
  }
  return JSON.parse(res.getContentText());
}

function patchFirebaseJson(path, payload) {
  const res = UrlFetchApp.fetch(buildFirebaseUrl(path), {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`Firebase írási hiba (${path}): ${res.getResponseCode()} - ${res.getContentText()}`);
  }
}
