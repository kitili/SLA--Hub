// File storage helper — replaces local-disk `multer.diskStorage` + `express.static('/uploads')`.
// Serverless functions have no persistent filesystem, so uploaded files go straight to
// Supabase Storage instead. Buckets are private; callers get back the object PATH to store
// in the DB (not a URL — signed URLs expire, so a fresh one is generated on each read via
// `getSignedUrl`).
const { supabase } = require('./realtime');

const BUCKETS = {
  admissionForms: 'admission-forms',
  walkthroughPhotos: 'walkthrough-photos',
};

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour — regenerated on every read, so this only needs to outlive a single page view

async function uploadFile(bucket, path, buffer, contentType) {
  if (!supabase) throw new Error('Storage unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.');
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

async function getSignedUrl(bucket, path) {
  if (!path) return null;
  if (!supabase) throw new Error('Storage unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error) throw new Error(`Storage signed URL failed: ${error.message}`);
  return data.signedUrl;
}

module.exports = { BUCKETS, uploadFile, getSignedUrl };
