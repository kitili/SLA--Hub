const BASE = process.env.SMOKE_BASE || "http://localhost:3108";

async function req(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEBAVFRUVFRUVFRUVFRUXFxUXFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQIF/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIQAxAAAAGmP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

async function main() {
  const health = await fetch(BASE);
  assert(health.ok, `App is not running at ${BASE}. Start it with npm run dev.`);

  const rejected = await req("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Visitor",
      phone: "07AB400000",
      purpose: "Interview",
      host: "Front Office",
      campus: "Usa River",
      source: "desk",
    }),
  });
  assert(rejected.status === 400, `Expected digits-only rejection, got ${rejected.status}`);

  const deskVisit = await req("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Desk Visitor",
      phone: "0754111222",
      purpose: "Parent meeting",
      host: "Front Office",
      campus: "Usa River",
      source: "desk",
      photo: TINY_JPEG,
    }),
  });
  assert(deskVisit.status === 201, `Desk sign-in failed: ${JSON.stringify(deskVisit.body)}`);
  assert(deskVisit.body.visit.photo?.startsWith("/api/photos/"), "Photo was not stored as file URL");

  const photo = await fetch(`${BASE}${deskVisit.body.visit.photo}`);
  assert(photo.ok, "Stored photo is not readable");

  const selfVisit = await req("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Amina Joseph",
      phone: "0754000000",
      purpose: "Prospective family tour",
      host: "Admissions",
      campus: "Kijenge",
      source: "self",
    }),
  });
  assert(selfVisit.status === 201, `Self check-in failed: ${JSON.stringify(selfVisit.body)}`);

  const listed = await req("/api/visits?campus=Usa%20River&onSite=1");
  assert(listed.status === 200, "Campus list failed");
  assert(
    listed.body.visits.some((visit) => visit.id === deskVisit.body.visit.id),
    "Desk visitor missing from campus list",
  );

  const signedOut = await req(`/api/visits/${deskVisit.body.visit.id}`, { method: "PATCH" });
  assert(signedOut.status === 200, "Sign-out failed");

  const history = await req("/api/visits?campus=Usa%20River&dateFrom=2020-01-01&dateTo=2099-12-31");
  assert(history.status === 200, "History query failed");

  const pages = [
    "/",
    "/campus/usa-river",
    "/campus/usa-river/history",
    "/campus/kijenge/qr",
    "/check-in",
  ];
  for (const page of pages) {
    const response = await fetch(`${BASE}${page}`);
    assert(response.ok, `${page} returned ${response.status}`);
    const html = await response.text();
    assert(html.includes("Silverleaf"), `${page} is missing Silverleaf branding`);
  }

  console.log("Smoke test passed: open campus dashboards, photos, history, QR check-in.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
