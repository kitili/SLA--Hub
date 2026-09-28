import { spawn } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.ED_ADMIN_MOCK_PORT ?? 3210);

const staffXml = `<root>
  <staff><ID>401642</ID><FirstName>Mourine</FirstName><LastName>Fellow</LastName><Position>Fellow</Position><Disabled>0</Disabled><Email>mourine-fellow@silverleaf.co.tz</Email><StatusName>Current</StatusName></staff>
  <staff><ID>900001</ID><FirstName>HR</FirstName><LastName>Admin</LastName><Position>People Operations</Position><Disabled>0</Disabled><Email>hr@silverleaf.co.tz</Email><StatusName>Current</StatusName></staff>
</root>`;

const server = http.createServer((req, res) => {
  if (req.url === "/staff") {
    res.writeHead(200, {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(staffXml);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[e2e] mock ed-admin staff API listening on ${PORT}`);

  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    env: process.env,
  });

  const shutdown = (signal) => {
    child.kill(signal);
    server.close(() => process.exit(signal === "SIGTERM" ? 0 : 1));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  child.on("exit", (code, signal) => {
    server.close(() => {
      if (signal) process.kill(process.pid, signal);
      process.exit(code ?? 1);
    });
  });
});
