
/* ---- translate: asks Claude through the page's sample capability ---- */
var LANG = { gu: 'Gujarati', hi: 'Hindi', en: 'English' };
var tmode = 'replace', tctl = null, tprev = null, sampleFn = null;
$$('[data-tmode]').forEach(function (b) {
  b.addEventListener('click', function () {
    tmode = b.dataset.tmode;
    $$('[data-tmode]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
  });
});
function sanitize(html) {
  var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  $$('script,style,iframe,object,embed,link,meta,form,base', doc.body).forEach(function (n) { n.remove(); });
  $$('*', doc.body).forEach(function (n) {
    Array.prototype.slice.call(n.attributes).forEach(function (a) {
      var nm = a.name.toLowerCase();
      if (nm.indexOf('on') === 0 || (/^(href|src|xlink:href)$/.test(nm) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
    });
  });
  return doc.body;
}
function setBusy(b) {
  $$('[data-lang]').forEach(function (x) { x.disabled = b; });
  $('#t-cancel').hidden = !b;
  if (b) toast('Translating…', 'busy'); else $('#toast').hidden = true;
}
function sampleMsg(e) {
  switch (e && e.code) {
    case 'cancelled': return '';
    case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled':
      return 'Translation is switched off. Reload this page and allow it to use Claude.';
    case 'rate_limited': return 'Too many requests. Wait a little and try again.';
    case 'session_expired': return 'Please sign in again to translate.';
    case 'refused': return 'This text could not be translated.';
    default: return 'Translation did not finish. Try again.';
  }
}
function translate(code) {
  if (tctl) return;
  if (!sampleFn) { toast(window.claude ? 'Translation is not available in this view.' : 'Translate and Scan work only when this page is opened inside Claude.', 'err'); return; }
  var whole = !hasSelection(), html, range = null;
  if (whole) html = cleanHtml();
  else { range = savedRange.cloneRange(); var d = document.createElement('div'); d.appendChild(range.cloneContents()); html = d.innerHTML; }
  var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  if (!doc.body.textContent.trim()) { toast('Write some text first.', 'err'); return; }
  var store = [];
  $$('img', doc.body).forEach(function (im, i) { store.push(im.getAttribute('src')); im.setAttribute('data-k', i); im.removeAttribute('src'); });
  var src = doc.body.innerHTML;
  if (src.length > 150000) { toast('Too long to translate at once. Select a part of the text.', 'err'); return; }
  var L = LANG[code];
  var prompt = 'Translate the text in the HTML fragment below into ' + L + '. The original may be Gujarati, Hindi, English or a mix; translate every part that is not already ' + L + '. ' +
    'Keep every HTML tag, attribute, style and the structure exactly as it is, and change only the words between tags. Keep numbers, names and URLs. ' +
    'Write natural, correct ' + L + ' in its own script. Reply with only the translated HTML fragment: no code fences, no notes.\n\n' + src;
  tctl = new AbortController(); setBusy(true);
  sampleFn(prompt, { signal: tctl.signal }).then(function (r) {
    if (r.truncated) { toast('The translation was cut short. Select a smaller part and try again.', 'err'); return; }
    var out = r.text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
    var body = sanitize(out);
    $$('img[data-k]', body).forEach(function (im) {
      var s = store[+im.getAttribute('data-k')];
      if (s) { im.setAttribute('src', s); im.removeAttribute('data-k'); } else im.remove();
    });
    if (tmode === 'below') $$('.pb', body).forEach(function (n) { n.remove(); });
    var res = body.innerHTML;
    tprev = cleanHtml();
    if (whole) ed.innerHTML = tmode === 'replace' ? res : tprev + '<hr>' + res;
    else {
      savedRange = range; restoreSel();
      if (tmode === 'replace') document.execCommand('insertHTML', false, res);
      else { window.getSelection().collapseToEnd(); document.execCommand('insertHTML', false, '<p><br></p><div>' + res + '</div>'); }
    }
    selectImg(null); $('#t-undo').hidden = false; afterEdit();
    toast('Translated to ' + L);
  }).catch(function (e) {
    var m = sampleMsg(e); if (m) toast(m, 'err');
  }).then(function () { tctl = null; setBusy(false); });
}
$$('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { translate(b.dataset.lang); }); });
$('#t-cancel').addEventListener('click', function () { if (tctl) tctl.abort(); });
$('#t-undo').addEventListener('click', function () {
  if (tprev == null) return;
  ed.innerHTML = tprev; tprev = null; selectImg(null); $('#t-undo').hidden = true; afterEdit();
});
