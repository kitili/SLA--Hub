import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, '../data/hub-content.json');
const SEED_PATH = path.join(__dirname, '../data/hub-content.seed.json');

export function initContent() {
  if (!fs.existsSync(CONTENT_PATH)) {
    if (fs.existsSync(SEED_PATH)) {
      fs.copyFileSync(SEED_PATH, CONTENT_PATH);
    } else {
      fs.writeFileSync(CONTENT_PATH, JSON.stringify({ sections: [] }, null, 2));
    }
  }
}

export function loadContent() {
  initContent();
  const raw = fs.readFileSync(CONTENT_PATH, 'utf8');
  return JSON.parse(raw);
}

export function saveContent(data) {
  initContent();
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2));
  return data;
}

export function getSections() {
  return loadContent().sections;
}

export function setSections(sections) {
  return saveContent({ sections });
}

export function getAllItems() {
  return getSections().flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionNumber: section.number,
    }))
  );
}

export function countDocumentItems() {
  return getAllItems().length;
}

export function addItem(sectionId, { id, title, files, type, note }) {
  const data = loadContent();
  const section = data.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error('Section not found');
  if (section.items.some((i) => i.id === id)) throw new Error('Item ID already exists');
  section.items.push({ id, title, files, ...(type && { type }), ...(note && { note }) });
  saveContent(data);
  return data;
}

export function updateItem(itemId, updates) {
  const data = loadContent();
  for (const section of data.sections) {
    const idx = section.items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      section.items[idx] = { ...section.items[idx], ...updates };
      saveContent(data);
      return data;
    }
  }
  throw new Error('Item not found');
}

export function removeItem(itemId) {
  const data = loadContent();
  let removed = null;
  for (const section of data.sections) {
    const idx = section.items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      removed = section.items.splice(idx, 1)[0];
      saveContent(data);
      return { data, removed };
    }
  }
  throw new Error('Item not found');
}

export function findItem(itemId) {
  for (const section of getSections()) {
    const item = section.items.find((i) => i.id === itemId);
    if (item) return { section, item };
  }
  return null;
}
