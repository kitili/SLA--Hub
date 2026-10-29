/**
 * Pushes the dashboard figures to Silverleaf Hub (Academics), so the hub's
 * Instructional Leadership board shows the same numbers as this web app.
 *
 * One-time setup (Project Settings → Script properties):
 *   HUB_INGEST_URL  https://silverleaf-lesson-plans-main.vercel.app/api/leadership/ingest
 *   HUB_INGEST_KEY  the same value as ILD_INGEST_KEY on Vercel (32+ characters)
 * Then run installHourlyPush() once. The key lives only in Script properties,
 * never in this file. The trigger runs as the person who installed it, who
 * must be able to open both trackers.
 */

function pushToHub() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('HUB_INGEST_URL');
  var key = props.getProperty('HUB_INGEST_KEY');
  if (!url || !key) throw new Error('Set HUB_INGEST_URL and HUB_INGEST_KEY in Script properties first.');
  if (!/^https:\/\//.test(url)) throw new Error('HUB_INGEST_URL must start with https://');

  var data = buildData_();
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('Hub refused the push (' + code + '): ' + res.getContentText().slice(0, 300));
  console.log('Pushed to hub: ' + res.getContentText());
}

/** Run once. Replaces any earlier pushToHub trigger with an hourly one. */
function installHourlyPush() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pushToHub') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pushToHub').timeBased().everyHours(1).create();
}
