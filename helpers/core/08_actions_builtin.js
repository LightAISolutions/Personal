/**
 * Helpers core — built-in action. Each action: validate(payload)->errors[], preview(payload)->HTML, execute(payload, ctx)->result.
 * All run ONLY from executePendingAction() after the owner's ✅. Previews must show every field that will be used.
 * Packs register their own actions with registerAction() (type listed in helper.json action_allowlist).
 */
function _reqStr(p, k, max, errs) {
  if (typeof p[k] !== 'string' || !p[k].trim()) errs.push(k + ' required');
  else if (p[k].length > max) errs.push(k + ' > ' + max + ' chars');
}
var DRIVE_PATH_RE = /^[A-Za-z0-9 _.-]+(\/[A-Za-z0-9 _.-]+){0,6}$/;
var DRIVE_FILE_NAME_RE = /^[A-Za-z0-9 _.()-]+\.[A-Za-z0-9]{1,8}$/;
var DRIVE_CREATE_MIMES = ['text/plain', 'text/markdown', 'text/csv', 'text/html', 'application/json'];

/** Create a text file under the helper's Drive root: {path?: 'a/b', name: 'x.md', content, mime?}. Never overwrites. */
registerAction('drive_create_file', {
  validate: function (p) {
    var errs = [];
    if (p.path !== undefined && (typeof p.path !== 'string' || !DRIVE_PATH_RE.test(p.path) || /(^|\/)\.\.?(\/|$)/.test(p.path))) errs.push('path must be a relative folder path (letters, digits, space, _ . -, up to 7 segments)');
    _reqStr(p, 'name', 120, errs);
    if (typeof p.name === 'string' && !DRIVE_FILE_NAME_RE.test(p.name)) errs.push('name must be a plain file name with an extension');
    if (typeof p.content !== 'string') errs.push('content must be a string');
    else if (p.content.length > 100000) errs.push('content > 100000 chars');
    if (p.mime !== undefined && DRIVE_CREATE_MIMES.indexOf(p.mime) < 0) errs.push('mime must be one of ' + DRIVE_CREATE_MIMES.join('|'));
    return errs;
  },
  preview: function (p) {
    return '📄 <b>Create Drive file</b> ' + tgEscape(HELPER.drive_root + '/' + (p.path ? p.path + '/' : '') + p.name) +
      ' <i>(' + tgEscape(p.mime || 'text/plain') + ', ' + p.content.length + ' chars)</i>\n<pre>' + tgEscape(truncate(p.content, 800)) + '</pre>';
  },
  execute: function (p) {
    var folder = p.path ? ensureFolderPath(p.path.split('/')) : getRootFolder();
    if (folder.getFilesByName(p.name).hasNext()) throw new Error('a file named ' + p.name + ' already exists there');
    var file = folder.createFile(p.name, p.content, p.mime || 'text/plain');
    var url = typeof file.getUrl === 'function' ? file.getUrl() : '';
    return { file_id: file.getId(), url: url, summary: 'created ' + (p.path ? p.path + '/' : '') + p.name };
  }
});

// Developed by: LightAISolutions
