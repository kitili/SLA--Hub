// Vercel serverless entry point — wraps the existing Express app as a single function.
// All /api/* traffic is routed here (see ../vercel.json); Express does the sub-routing
// internally exactly as it does locally, so backend/routes/*.js are unchanged.
module.exports = require('../app');
