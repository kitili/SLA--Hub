const BASE = process.env.BASE || "http://127.0.0.1:3108";

const visitors = [
  {
    name: "Amina Joseph",
    phone: "0754123456",
    purpose: "Parent meeting",
    host: "Erick Anthony",
    campus: "Usa River",
    source: "self",
  },
  {
    name: "James Mwangi",
    phone: "0754987654",
    purpose: "Prospective family tour",
    host: "Admissions Office",
    campus: "Arusha Modern",
    source: "self",
  },
  {
    name: "Grace Kimaro",
    phone: "0754111222",
    purpose: "Delivery / vendor",
    host: "Front Office",
    campus: "Kijenge",
    source: "desk",
  },
  {
    name: "Peter Ole Sanare",
    phone: "0754333444",
    purpose: "Interview",
    host: "HR Office",
    campus: "Ilboru",
    source: "desk",
  },
  {
    name: "Fatuma Hassan",
    phone: "0754555666",
    purpose: "Maintenance / contractor",
    host: "Facilities",
    campus: "Boma",
    source: "self",
  },
  {
    name: "David Mrosso",
    phone: "0754777888",
    purpose: "Parent meeting",
    host: "Year 3 Teacher",
    campus: "Usa River",
    source: "desk",
  },
];

async function req(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function main() {
  let created = 0;
  for (const visitor of visitors) {
    const result = await req("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visitor),
    });
    if (result.status === 201) {
      created += 1;
      console.log(`+ ${visitor.name} @ ${visitor.campus}`);
    } else {
      console.warn(`! ${visitor.name}: ${result.body.error || result.status}`);
    }
  }
  console.log(`Seeded ${created} visitors.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
