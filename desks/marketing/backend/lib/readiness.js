/**
 * Go-live readiness. Reports whether secrets exist — never their values.
 */

const fs = require('fs');
const path = require('path');
const edadmin = require('./edadmin');
const buffer = require('./buffer');

function looksPlaceholder(value) {
  if (value == null || String(value).trim() === '') return true;
  const v = String(value);
  return /replace|changethis|your-|example|placeholder|<.*>|local-.*dev-only|dev-only/i.test(v);
}

function present(name) {
  const value = process.env[name];
  return { name, set: Boolean(value), usable: Boolean(value) && !looksPlaceholder(value) };
}

function messaging() {
  return {
    email: !looksPlaceholder(process.env.SMTP_USER) && !looksPlaceholder(process.env.SMTP_PASS),
    sms: !looksPlaceholder(process.env.AT_API_KEY) && !looksPlaceholder(process.env.AT_USERNAME),
    whatsapp: !looksPlaceholder(process.env.AT_API_KEY) && !looksPlaceholder(process.env.AT_WA_NUMBER),
  };
}

function loadPhases() {
  const file = path.join(__dirname, '..', 'data', 'go-live-phases.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function blockers() {
  const production = process.env.NODE_ENV === 'production';
  const list = [];
  if (!present('JWT_SECRET').usable) list.push('jwt_secret');
  if (!present('DATABASE_URL').usable) list.push('database_url');
  if (production && !present('FRONTEND_URL').usable) list.push('frontend_url');
  if (production && !present('WEBHOOK_SECRET').usable && !present('EDADMIN_WEBHOOK_SECRET').usable) {
    list.push('webhook_secret');
  }
  if (production && !present('CRON_SECRET').usable) list.push('cron_secret');
  if (!edadmin.isConfigured()) list.push('edadmin_api_key');
  const msg = messaging();
  if (!msg.email) list.push('smtp');
  if (!msg.sms && !msg.whatsapp) list.push('africas_talking');
  return list;
}

function snapshot() {
  const msg = messaging();
  const phases = loadPhases();
  const block = blockers();
  const production = process.env.NODE_ENV === 'production';
  return {
    live: production ? block.length === 0 : block.filter((b) => !['edadmin_api_key', 'smtp', 'africas_talking'].includes(b)).length === 0,
    go_live: block.length === 0,
    environment: production ? 'production' : 'development',
    blockers: block,
    connections: {
      database: present('DATABASE_URL').usable,
      jwt: present('JWT_SECRET').usable,
      frontend_url: present('FRONTEND_URL').usable || !production,
      webhook: present('WEBHOOK_SECRET').set || present('EDADMIN_WEBHOOK_SECRET').set,
      cron: present('CRON_SECRET').set,
      edadmin: edadmin.isConfigured(),
      buffer: buffer.isConfigured(),
      email: msg.email,
      sms: msg.sms,
      whatsapp: msg.whatsapp,
    },
    phases: phases.phases,
    goal: phases.goal,
  };
}

module.exports = { looksPlaceholder, present, messaging, blockers, snapshot };
