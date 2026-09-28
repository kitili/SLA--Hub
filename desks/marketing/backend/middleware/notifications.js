const nodemailer = require('nodemailer');

// ── EMAIL ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html, from, attachments }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`📧 Email (dev — no SMTP credentials): ${to} ← ${subject}`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: from || `"Silverleaf Academy" <${process.env.SMTP_USER}>`,
      to, subject, html, attachments,
    });
    console.log(`📧 Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('Email error:', err.message);
    return false;
  }
}

// ── SMS (Africa's Talking) ────────────────────────────────────
async function sendSMS({ phone, message }) {
  if (!process.env.AT_API_KEY || !process.env.AT_USERNAME) {
    console.log(`📱 SMS (dev — no AT credentials): ${phone} → ${message.slice(0, 50)}`);
    return false;
  }
  try {
    const AfricasTalking = require('africastalking');
    const client = AfricasTalking({
      apiKey:   process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    });
    await client.SMS.send({ to: [phone], message, from: process.env.AT_SENDER_ID || 'Silverleaf' });
    console.log(`📱 SMS sent to ${phone}`);
    return true;
  } catch (err) {
    console.error('SMS error:', err.message);
    return false;
  }
}

// ── WhatsApp (Africa's Talking WhatsApp/Chat API) ──────────────
// If WA is not configured, optionally fall back to SMS via fallbackPhone.
async function sendWhatsApp({ phone, message, fallbackPhone }) {
  if (!process.env.AT_API_KEY || !process.env.AT_WA_NUMBER) {
    console.log(`💬 WhatsApp (dev — no AT_API_KEY/AT_WA_NUMBER): ${phone} → ${message.slice(0, 50)}`);
    if (fallbackPhone) return sendSMS({ phone: fallbackPhone, message });
    return false;
  }
  try {
    const axios = require('axios');
    const { data } = await axios.post('https://chat.africastalking.com/whatsapp/message/send', {
      username:    process.env.AT_USERNAME,
      waNumber:    process.env.AT_WA_NUMBER,
      phoneNumber: phone,
      body: { message },
    }, {
      headers: { apiKey: process.env.AT_API_KEY, 'Content-Type': 'application/json' },
    });
    console.log(`💬 WhatsApp sent to ${phone}`, data);
    return true;
  } catch (err) {
    console.error('WhatsApp error:', err.response?.data || err.message);
    if (fallbackPhone) return sendSMS({ phone: fallbackPhone, message });
    return false;
  }
}

module.exports = { sendEmail, sendSMS, sendWhatsApp };
