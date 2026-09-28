/**
 * Silverleaf Hiring — Google Form → Onboarding Hub board
 *
 * Form:
 * https://docs.google.com/forms/d/e/1FAIpQLSfGGePMG4fe8dlH9xN8MU60E3FZfZeA2SRoFSpj5toPrCdQ4Q/viewform
 *
 * FLOW
 *   Form submit → linked Sheet → this script → POST /api/hiring/applications
 *
 * SETUP
 * 1. Form → Responses → Link to Sheets.
 * 2. Sheet → Extensions → Apps Script → paste this file.
 * 3. Set HIRING_WEBHOOK_URL + HIRING_WEBHOOK_SECRET (hub APPLICATIONS_WEBHOOK_SECRET).
 * 4. Run installTriggerOnce → Authorize.
 * 5. Run pushAllFormResponses once to backfill every existing sheet row.
 */

// --- EDIT THESE TWO ---
var HIRING_WEBHOOK_URL = 'https://onboarding.silverleaf.co.tz/api/hiring/applications';
var HIRING_WEBHOOK_SECRET = 'PASTE_APPLICATIONS_WEBHOOK_SECRET_FROM_ENV';
// ----------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hiring Board')
    .addItem('Install form → Hiring trigger', 'installTriggerOnce')
    .addItem('Push last response to Hiring', 'testLastFormRow')
    .addItem('Push ALL responses to Hiring (backfill)', 'pushAllFormResponses')
    .addToUi();
}

function installTriggerOnce() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onFormSubmitToHiring') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('onFormSubmitToHiring')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger installed',
    'Each new form response will create a candidate on the Hiring board.\n\n' +
      'Webhook:\n' + HIRING_WEBHOOK_URL,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function onFormSubmitToHiring(e) {
  if (!e || !e.namedValues) {
    throw new Error('This runs on form submit. Use "Push last response to Hiring" to test.');
  }
  postToHiring_(rawNamed_(e.namedValues));
}

function testLastFormRow() {
  var result = postRow_(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getLastRow());
  SpreadsheetApp.getUi().alert(
    'Sent to Hiring',
    JSON.stringify(result, null, 2),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Backfill every existing form row. Safe to re-run (hub skips duplicate emails). */
function pushAllFormResponses() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var last = sheet.getLastRow();
  if (last < 2) throw new Error('No response rows yet.');

  var imported = 0;
  var skipped = 0;
  var failed = [];

  for (var row = 2; row <= last; row++) {
    try {
      var result = postRow_(row);
      if (result && result.duplicate) skipped++;
      else imported++;
    } catch (err) {
      failed.push('Row ' + row + ': ' + err);
    }
    Utilities.sleep(200);
  }

  SpreadsheetApp.getUi().alert(
    'Backfill finished',
    'Imported ' + imported + '\nSkipped (already on board) ' + skipped +
      '\nFailed ' + failed.length +
      (failed.length ? '\n\n' + failed.slice(0, 15).join('\n') : ''),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function postRow_(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (row < 2) throw new Error('No response rows yet.');

  var values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  var named = {};
  headers.forEach(function (h, i) {
    named[String(h)] = [values[i]];
  });
  return postToHiring_(rawNamed_(named));
}

/** Send question titles as-is so the hub can fuzzy-match (nbsp, punctuation). */
function rawNamed_(namedValues) {
  var payload = {};
  Object.keys(namedValues || {}).forEach(function (key) {
    payload[key] = namedValues[key];
  });
  return payload;
}

function postToHiring_(payload) {
  if (!HIRING_WEBHOOK_URL || HIRING_WEBHOOK_URL.indexOf('YOUR_PUBLIC_HOST') !== -1) {
    throw new Error(
      'Set HIRING_WEBHOOK_URL to https://onboarding.silverleaf.co.tz/api/hiring/applications'
    );
  }
  if (!HIRING_WEBHOOK_SECRET || HIRING_WEBHOOK_SECRET.indexOf('PASTE_') === 0) {
    throw new Error(
      'Set HIRING_WEBHOOK_SECRET to APPLICATIONS_WEBHOOK_SECRET from the hub .env.'
    );
  }

  var response = UrlFetchApp.fetch(HIRING_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + HIRING_WEBHOOK_SECRET,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Hiring webhook failed (' + code + '): ' + text);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return { raw: text };
  }
}
