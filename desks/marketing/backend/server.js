// Local development entry point only. Production (Vercel) uses api/index.js, which
// imports app.js directly as a serverless function — no .listen() there, since Vercel
// manages the HTTP server itself. This file exists so `npm run dev` / nodemon behave
// exactly as before.
const http = require('http');
const app  = require('./app');

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Silverleaf Academy API — port ${PORT}`);
});
