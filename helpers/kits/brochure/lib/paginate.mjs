/**
 * Brochure kit — the paginator. Runs INSIDE Chromium (Playwright serialises `paginate` and evaluates it in the
 * page), so it is one self-contained function with no imports. It walks the flowing document section by section
 * and re-homes every block into fixed-size `.sheet` elements, measuring as it goes:
 *   data-pg="sheet"   → the block is a whole sheet (the cover; data-bleed drops the margins)
 *   data-pg="section" → starts a new sheet; its children are placed one by one
 *   data-pg="block"   → an unsplittable unit; moves to the next sheet when it does not fit (data-keep: with the next)
 *   data-pg="split"   → a container whose children are blocks (the timeline rail, the source list); continues on
 *                       later sheets under a `.cont-note` (text from data-cont)
 *   data-pg="cols"    → a container laid out as two balanced columns of unsplittable items (cards, lists)
 *   data-pg="aside"   → placed as is (it floats right in paged CSS); never split
 * Every sheet but the cover gets a folio (trip title · section · page number) and day sheets a coloured tab.
 * `[data-pageref]` links are rewritten to "p. N" once the page of their target is known.
 * Returns { pages, warnings }.
 */
export function paginate({ title = '', eps = 0.5 } = {}) {
  const doc = document.querySelector('.doc');
  document.documentElement.classList.add('paged');
  const pages = document.createElement('div');
  pages.className = 'pages';
  doc.after(pages);
  const sheets = [], warnings = [];
  let cur = null;

  const newSheet = (sec, { bleed = false, cont = false, host = null } = {}) => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet' + (bleed ? ' bleed' : '') + (cont ? ' cont' : '');
    const inner = document.createElement('div');
    inner.className = 'sheet-inner';
    sheet.appendChild(inner);
    if (!host) { host = document.createElement(sec.tagName); host.className = sec.className; if (sec.getAttribute('style')) host.setAttribute('style', sec.getAttribute('style')); }
    inner.appendChild(host);
    pages.appendChild(sheet);
    cur = { sheet, inner, host, sec, no: sheets.length + 1, cont, folio: sec.dataset.folio ?? '', tab: sec.dataset.tab || '', style: sec.getAttribute('style') || '' };
    sheets.push(cur);
    return cur;
  };
  const overflows = () => cur.host.getBoundingClientRect().bottom > cur.inner.getBoundingClientRect().bottom + eps;

  /** Append `el` to `parent`; if the sheet overflows, pull it back and return false. */
  const tryPlace = (parent, el) => { parent.appendChild(el); if (!overflows()) return true; parent.removeChild(el); return false; };
  const cloneShell = (el, extraClass = '') => { const c = document.createElement(el.tagName); c.className = el.className + (extraClass ? ' ' + extraClass : ''); return c; };
  const contNote = (text) => { const p = document.createElement('p'); p.className = 'cont-note'; p.textContent = text; return p; };

  /** A block that must not split: place here or on a fresh continuation sheet (carrying a kept predecessor). */
  const placeBlock = (el, sec, pending) => {
    if (tryPlace(cur.host, el)) return;
    const carry = pending.keep && pending.keep.parentNode === cur.host && cur.host.children.length > 1 ? pending.keep : null;
    if (carry) carry.remove();
    newSheet(sec, { cont: true });
    if (carry) cur.host.appendChild(carry);
    cur.host.appendChild(el);
    if (overflows()) warnings.push(`block taller than a page in "${sec.dataset.folio || sec.className}" — clipped`);
  };
  /** A container of blocks that may continue across sheets. */
  const placeSplit = (container, sec, pending) => {
    let shell = cloneShell(container);
    cur.host.appendChild(shell);
    let first = true;
    const kids = [...container.children];
    for (let k = 0; k < kids.length; k++) {
      const child = kids[k];
      if (child.dataset.pg === 'block' && child.dataset.keep !== undefined) { pending.keep = child; }
      if (tryPlace(shell, child)) { first = false; continue; }
      let carry = pending.keep && pending.keep.parentNode === shell && shell.children.length > 1 && pending.keep === shell.lastElementChild ? pending.keep : null;
      // widow control: never leave a lone last item on a continuation sheet — bring its predecessor along
      if (!carry && k === kids.length - 1 && shell.children.length > 2 && shell.lastElementChild.dataset.keep === undefined) carry = shell.lastElementChild;
      if (carry) carry.remove();
      if (first && !carry) { shell.appendChild(child); warnings.push(`item taller than a page in "${sec.dataset.folio}" — clipped`); first = false; continue; }
      if (!shell.children.length) shell.remove();
      newSheet(sec, { cont: true });
      if (container.dataset.cont) cur.host.appendChild(contNote(container.dataset.cont));
      shell = cloneShell(container, 'rail-cont');
      cur.host.appendChild(shell);
      if (carry) shell.appendChild(carry);
      shell.appendChild(child);
      if (overflows()) warnings.push(`item taller than a page in "${sec.dataset.folio}" — clipped`);
    }
    container.remove();
  };
  /** Two balanced columns of unsplittable items; a new sheet when neither column has room. */
  const placeCols = (container, sec) => {
    const open = () => { const shell = cloneShell(container); const cols = [document.createElement('div'), document.createElement('div')]; cols.forEach((c) => { c.className = 'col'; shell.appendChild(c); }); cur.host.appendChild(shell); return { shell, cols }; };
    let { shell, cols } = open();
    let c = 0; // column-major: fill the left column, then the right, so items keep their reading order
    const h = (el) => el.getBoundingClientRect().height;
    /** Even the two columns out (order preserved): move the left column's tail to the head of the right one while that shortens the taller side. */
    const balance = () => {
      for (;;) {
        const last = cols[0].lastElementChild;
        if (!last || cols[0].children.length < 2) return;
        const gap = h(cols[0]) - h(cols[1]);
        if (gap <= h(last)) return;
        cols[1].prepend(last);
        if (overflows()) { cols[0].appendChild(last); return; }
      }
    };
    for (const item of [...container.children]) {
      if (tryPlace(cols[c], item)) continue;
      if (c === 0 && cols[0].children.length) { c = 1; if (tryPlace(cols[1], item)) continue; }
      if (!cols[0].children.length && !cols[1].children.length) { cols[0].appendChild(item); warnings.push(`item taller than a page in "${sec.dataset.folio}" — clipped`); continue; }
      balance();
      newSheet(sec, { cont: true });
      ({ shell, cols } = open());
      c = 0;
      cols[0].appendChild(item);
      if (overflows()) warnings.push(`item taller than a page in "${sec.dataset.folio}" — clipped`);
    }
    balance();
    container.remove();
  };

  /** Lay one section out from `first` onwards; returns the sheets it produced. */
  const placeSection = (sec) => {
    const start = sheets.length;
    newSheet(sec);
    const pending = { keep: null };
    for (const child of [...sec.children]) {
      const kind = child.dataset.pg || 'block';
      if (kind === 'split') placeSplit(child, sec, pending);
      else if (kind === 'cols') placeCols(child, sec);
      else if (kind === 'aside') { cur.host.appendChild(child); if (overflows()) warnings.push(`aside taller than a page in "${sec.dataset.folio}"`); }
      else placeBlock(child, sec, pending);
      pending.keep = kind === 'block' && child.dataset.keep !== undefined ? child : null;
    }
    return sheets.slice(start);
  };
  /** True when a section's last sheet is a near-empty continuation (less than `frac` of the page used). */
  const spillsALittle = (made, frac) => {
    if (made.length !== 2 || !made[1].cont) return false;
    const inner = made[1].inner.getBoundingClientRect(), host = made[1].host.getBoundingClientRect();
    return (host.bottom - inner.top) < frac * inner.height;
  };
  const undo = (made) => { for (const s of made) { s.sheet.remove(); sheets.splice(sheets.indexOf(s), 1); } };

  for (const sec of [...doc.children]) {
    if (sec.dataset.pg === 'sheet') { newSheet(sec, { bleed: sec.dataset.bleed !== undefined, host: sec }); continue; }
    // near-fit compaction: a section that spills only a little is re-set tighter (two steps) before we accept the spill
    const snapshot = sec.cloneNode(true);
    const relay = (classes) => { const again = snapshot.cloneNode(true); for (const c of classes) again.classList.add(c); doc.appendChild(again); const m = placeSection(again); again.remove(); return m; };
    let made = placeSection(sec);
    sec.remove();
    if (spillsALittle(made, 0.3)) {
      for (const classes of [['tight'], ['tight', 'tight2']]) {
        undo(made);
        made = relay(classes);
        if (made.length === 1) break;
      }
      if (made.length !== 1) { undo(made); made = relay([]); } // tightening did not help: keep the normal setting
    }
  }
  // folios, tabs, page references
  for (const s of sheets) {
    if (s.sheet.classList.contains('bleed')) continue;
    const f = document.createElement('div');
    f.className = 'folio';
    f.innerHTML = `<span></span><span></span><span class="pn"></span>`;
    f.children[0].textContent = title; f.children[1].textContent = s.folio; f.children[2].textContent = String(s.no);
    s.sheet.appendChild(f);
    if (s.tab) { const t = document.createElement('div'); t.className = 'tab'; t.textContent = s.tab; if (s.style) t.setAttribute('style', s.style); s.sheet.appendChild(t); }
  }
  const pageOf = (id) => { const el = document.getElementById(id); if (!el) return null; const sheet = el.closest('.sheet'); return sheet ? [...pages.children].indexOf(sheet) + 1 : null; };
  for (const a of document.querySelectorAll('[data-pageref]')) { const n = pageOf('place-' + a.dataset.pageref); if (n) a.textContent = `p. ${n}`; else a.replaceWith(document.createTextNode('')); }
  doc.remove();
  return { pages: sheets.length, warnings };
}

// Developed by: LightAISolutions
