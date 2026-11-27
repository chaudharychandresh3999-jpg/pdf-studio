(function () {
'use strict';
var PW = 595, PH = 842, PAD_T = 56, KEY = 'pdfstudio:v1';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var ed = $('#editor'), sheet = $('#sheet'), wrap = $('#zoomwrap'), stage = $('#stage'), guides = $('#guides');
var state = { bg: { type: 'color', value: '#ffffff', fg: '#1d2327' }, z: 1, fit: true, pages: 1 };
var savedRange = null, selImg = null, pendingPx = 16;
var STACKS = {
  pdfsans: "'Inter','Noto Sans Gujarati','Noto Sans Devanagari',sans-serif",
  pdfserif: "'Noto Serif','Noto Serif Gujarati','Noto Serif Devanagari',serif",
  pdfhind: "'Hind Vadodara','Noto Sans Devanagari',sans-serif"
};
var SAMPLE =
  '<h1>My first PDF</h1>' +
  '<p>Write your text here. You can change the font, colour and page background from the tools above.</p>' +
  '<h2>ગુજરાતી</h2>' +
  '<p>અહીં તમારું લખાણ લખો. ફોન્ટ, રંગ અને પાનાનું બેકગ્રાઉન્ડ ઉપરથી બદલી શકાય છે.</p>' +
  '<h2>हिंदी</h2>' +
  '<p>यहाँ अपना लेख लिखें। फ़ॉन्ट, रंग और पेज की पृष्ठभूमि ऊपर से बदल सकते हैं।</p>' +
  '<p><br></p><p>Sample text. Replace it with your own, or paste text from anywhere.</p>';

function toast(msg, kind) {
  var t = $('#toast');
  t.textContent = msg; t.dataset.kind = kind || ''; t.hidden = false;
  clearTimeout(toast.t);
  if (kind !== 'busy') toast.t = setTimeout(function () { t.hidden = true; }, 4000);
}

/* ---- selection handling: toolbar controls must not lose the caret ---- */
document.addEventListener('selectionchange', function () {
  var s = window.getSelection();
  if (s.rangeCount) {
    var r = s.getRangeAt(0);
    if (ed.contains(r.commonAncestorContainer)) { savedRange = r.cloneRange(); updateScope(); }
  }
  updateActive();
});
function restoreSel() {
  ed.focus({ preventScroll: true });
  if (savedRange) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
}
document.addEventListener('mousedown', function (e) {
  if (e.target.closest('button.tool, button.btn')) e.preventDefault();
});
function hasSelection() {
  return !!(savedRange && !savedRange.collapsed && ed.contains(savedRange.commonAncestorContainer));
}
function updateScope() {
  $('#tscope').textContent = hasSelection() ? 'Translates the selected text' : 'Translates the whole page';
}
function updateActive() {
  ['bold', 'italic', 'underline'].forEach(function (c) {
    var b = $('[data-cmd="' + c + '"]');
    var on = false; try { on = document.queryCommandState(c); } catch (e) {}
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/* ---- commands ---- */
function exec(cmd, val) {
  restoreSel();
  try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  document.execCommand(cmd, false, val == null ? null : val);
  fixInline();
  afterEdit();
}
function fixInline() {
  $$('[style*="pdfsans"],[style*="pdfserif"],[style*="pdfhind"],font[face]', ed).forEach(function (el) {
    var f = (el.style.fontFamily || el.getAttribute('face') || '');
    Object.keys(STACKS).forEach(function (k) { if (f.indexOf(k) > -1) { el.style.fontFamily = STACKS[k]; el.removeAttribute('face'); } });
  });
  $$('font[size="7"],[style*="xxx-large"]', ed).forEach(function (el) {
    el.removeAttribute('size'); el.style.fontSize = pendingPx + 'px';
  });
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-cmd]');
  if (b) exec(b.dataset.cmd);
});
$('#fmt').addEventListener('change', function () { exec('formatBlock', '<' + this.value + '>'); });
$('#font').addEventListener('change', function () { exec('fontName', this.value); });
$('#size').addEventListener('change', function () { pendingPx = +this.value; exec('fontSize', '7'); });
$('#fcolor').addEventListener('change', function () { $('#fcolor-bar').style.color = this.value; exec('foreColor', this.value); });
$('#hcolor').addEventListener('change', function () { $('#hcolor-bar').style.color = this.value; exec('hiliteColor', this.value); });
$('#btn-copy').addEventListener('click', function () {
  restoreSel();
  if (!hasSelection()) {
    var r = document.createRange(); r.selectNodeContents(ed);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  var text = window.getSelection().toString();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  if (!ok && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { toast('Select the text and use your phone’s Copy option.', 'err'); });
  } else toast(ok ? 'Copied' : 'Select the text and use your phone’s Copy option.', ok ? '' : 'err');
});

/* ---- paste: plain text, or an image ---- */
ed.addEventListener('paste', function (e) {
  e.preventDefault();
  var cd = e.clipboardData; if (!cd) return;
  var f = Array.prototype.slice.call(cd.files || []).filter(function (x) { return /^image\//.test(x.type); })[0];
  if (f) { insertImageFile(f); return; }
  var t = cd.getData('text/plain');
  if (t) { document.execCommand('insertText', false, t); afterEdit(); }
});
ed.addEventListener('input', function () { fixInline(); afterEdit(); });

/* ---- layout: whole A4 pages, zoom, page guides ---- */
var raf = 0;
function layout() { cancelAnimationFrame(raf); raf = requestAnimationFrame(doLayout); }
function doLayout() {
  var top = stage.scrollTop;
  ed.style.minHeight = '0px';
  var pages = Math.max(1, Math.ceil(ed.scrollHeight / PH));
  var H = pages * PH;
  ed.style.minHeight = H + 'px'; sheet.style.height = H + 'px';
  if (guides.dataset.n !== String(pages)) {
    guides.dataset.n = String(pages); guides.textContent = '';
    for (var k = 1; k < pages; k++) {
      var g = document.createElement('div'); g.className = 'guide'; g.style.top = (k * PH) + 'px';
      var s = document.createElement('span'); s.textContent = 'Page ' + (k + 1); g.appendChild(s); guides.appendChild(g);
    }
  }
  var prevP = state.pages; state.pages = pages;
  if (pages !== prevP) bumpPages();
  $('#pageinfo').textContent = pages + (pages > 1 ? ' pages' : ' page');
  applyZoom();
  sizeInk();
  stage.scrollTop = top;
}
function applyZoom() {
  if (state.fit) state.z = Math.max(0.3, Math.min(1.25, (stage.clientWidth - 32) / PW));
  var z = state.z, H = state.pages * PH;
  sheet.style.transform = 'scale(' + z + ')';
  wrap.style.width = (PW * z) + 'px'; wrap.style.height = (H * z) + 'px';
  $('#z-val').textContent = Math.round(z * 100) + '%';
}
function zoomBy(f) { state.fit = false; state.z = Math.max(0.3, Math.min(2, state.z * f)); applyZoom(); }
$('#z-in').addEventListener('click', function () { zoomBy(1.15); });
$('#z-out').addEventListener('click', function () { zoomBy(1 / 1.15); });
$('#z-fit').addEventListener('click', function () { state.fit = true; applyZoom(); });
if (window.ResizeObserver) new ResizeObserver(function () { if (state.fit) applyZoom(); }).observe(stage);

/* ---- save a draft in this browser ---- */
function afterEdit() { layout(); scheduleSave(); }
function scheduleSave() { clearTimeout(scheduleSave.t); scheduleSave.t = setTimeout(save, 700); }
function save() {
  var d = { html: cleanHtml(), bg: state.bg, name: $('#fname').value, ink: ink };
  try { localStorage.setItem(KEY, JSON.stringify(d)); }
  catch (e) { try { d.ink = []; localStorage.setItem(KEY, JSON.stringify(d)); } catch (e2) {} }
}
$('#fname').addEventListener('input', scheduleSave);

/* ---- tabs ---- */
$$('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    $$('.tab').forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
    $$('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + t.dataset.tab; });
    updateScope();
  });
});
