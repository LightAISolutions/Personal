/**
 * Helpers core — upload route (?route=upload, POST). A routine that made a file (a PDF, an HTML page) cannot push
 * megabytes through the Drive connector, so it POSTs the file here and gets back a Drive file id it can name in a
 * `reply` envelope's `drive_file_ids` (the core then sends the file to the chat).
 * Auth: the request's upload key — HMAC-SHA256('upload:' + request id) under ADMIN_SECRET, written into
 * to-brain/req_<id>.json as payload.upload_key — valid while the request is open (or answered within the hour) and
 * younger than LIMITS.REQUEST_MAX_AGE_HOURS; at most LIMITS.UPLOAD_MAX_PER_REQUEST files per request. No key is stored.
 * Body (text/plain JSON): { req, key, name, mime, data (base64), folder? ("trips/<slug>", ≤ 3 lowercase parts) }.
 * Files land under the helper's Drive root (folder, else `files/`); never overwrite, never delete.
 */
var UPLOAD_MIMES = { 'application/pdf': 'pdf', 'text/html': 'html' };

function uploadKey(requestId) {
  var secret = getProp(PROP.ADMIN_SECRET);
  if (!secret || !requestId) return '';
  var sig = Utilities.computeHmacSha256Signature('upload:' + String(requestId), secret);
  return sig.map(function (b) { var h = ((b + 256) % 256).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

function _uploadFail(status, reason, id) {
  auditFail('upload_refused', id || '', { reason: reason });
  return jsonOut({ ok: false, status: status, reason: reason });
}

/** ?route=upload — store one routine-made file under the Drive root; { ok, file_id, url, name, bytes } or { ok:false, reason }. */
function routeUpload(e) {
  if (!getProp(PROP.SHEET_ID)) return _uploadFail(503, 'not_set_up');
  var raw = e && e.postData ? String(e.postData.contents || '') : '';
  if (!raw) return _uploadFail(400, 'empty_body');
  if (raw.length > LIMITS.UPLOAD_MAX_BODY_CHARS) return _uploadFail(413, 'too_large');
  var b;
  try { b = JSON.parse(raw); } catch (x) { return _uploadFail(400, 'bad_json'); }
  if (!isPlainObject(b)) return _uploadFail(400, 'bad_json');
  var id = String(b.req || '').replace(/^req_/, '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return _uploadFail(400, 'bad_request_id');
  if (!safeEqual(String(b.key || ''), uploadKey(id))) return _uploadFail(403, 'bad_key', id);
  var row = getRequest(id);
  if (!row) return _uploadFail(404, 'unknown_request', id);
  var created = new Date(row.created_at).getTime();
  if (!(created > 0) || nowMs() - created > LIMITS.REQUEST_MAX_AGE_HOURS * 3600000) return _uploadFail(403, 'request_too_old', id);
  if (row.status !== 'open') {
    var answered = new Date(row.answered_at).getTime();
    if (row.status !== 'answered' || !(answered > 0) || nowMs() - answered > LIMITS.UPLOAD_AFTER_ANSWER_MIN * 60000) return _uploadFail(403, 'request_closed', id);
  }
  var mime = String(b.mime || '');
  if (!UPLOAD_MIMES[mime]) return _uploadFail(400, 'bad_mime', id);
  var name = String(b.name || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name) || name.split('.').pop().toLowerCase() !== UPLOAD_MIMES[mime]) return _uploadFail(400, 'bad_name', id);
  var parts = String(b.folder || 'files').split('/');
  if (parts.length > 3 || parts.some(function (p) { return !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p); }) || parts[0] === MAILBOX.MAILBOX) return _uploadFail(400, 'bad_folder', id);
  var bytes;
  try { bytes = Utilities.base64Decode(String(b.data || '').replace(/\s+/g, '')); } catch (x) { return _uploadFail(400, 'bad_data', id); }
  if (!bytes || !bytes.length) return _uploadFail(400, 'empty_file', id);
  if (bytes.length > LIMITS.UPLOAD_MAX_BYTES) return _uploadFail(413, 'too_large', id);
  var cache = CacheService.getScriptCache(), ck = 'upload:n:' + id, used = parseInt(cache.get(ck) || '0', 10) || 0;
  if (used >= LIMITS.UPLOAD_MAX_PER_REQUEST) return _uploadFail(429, 'too_many_files', id);
  cache.put(ck, String(used + 1), 21600);
  var file = ensureFolderPath(parts).createFile(Utilities.newBlob(bytes, mime, name));
  audit('upload', id, { name: name, bytes: bytes.length, folder: parts.join('/') });
  return jsonOut({ ok: true, file_id: file.getId(), url: file.getUrl(), name: name, bytes: bytes.length });
}

// Developed by: LightAISolutions
