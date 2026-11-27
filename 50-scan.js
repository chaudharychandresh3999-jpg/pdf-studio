
/* ---- scan: Claude reads text from photos and builds the page ---- */
var smode = 'add', sctl = null, sprev = null, sampleText = null;
var SCAN_MAP = { STRONG: 'B', EM: 'I', H3: 'H2', H4: 'H2', H5: 'H2', H6: 'H2', DIV: 'P', B: 'B', I: 'I', U: 'U', H1: 'H1', H2: 'H2', P: 'P', UL: 'UL', OL: 'OL', LI: 'LI', BR: 'BR', HR: 'HR' };
function cleanScan(html) {
  var body = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
  var out = document.createElement('div');
  (function walk(src, dst) {
    Array.prototype.slice.call(src.childNodes).forEach(function (n) {
      if (n.nodeType === 3) dst.appendChild(document.createTextNode(n.nodeValue));
      else if (n.nodeType === 1) {
        if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
        var t = SCAN_MAP[n.tagName];
        if (!t) { walk(n, dst); return; }
        var e = document.createElement(t); walk(n, e); dst.appendChild(e);
      }
    });
  })(body, out);
  return out;
}
function docIsBlank() { var t = ed.textContent.trim(); return !t || t === sampleText; }
function prepImage(f) {
  return loadImage(f).then(function (im) {
    var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.9); });
  });
}
function setScanBusy(b) {
  $('#s-cancel').hidden = !b;
  $$('#panel-scan .file').forEach(function (l) { l.style.opacity = b ? '.5' : ''; l.style.pointerEvents = b ? 'none' : ''; });
  if (b) toast('Reading the image…', 'busy'); else $('#toast').hidden = true;
}
function scanMsg(e) {
  switch (e && e.code) {
    case 'image_rejected': return 'That image could not be used. Try a different photo.';
    case 'images_unavailable': return 'Image scanning is not available in this view.';
    case 'prompt_too_large': return 'The image is too big. Try a smaller photo.';
    default: return sampleMsg(e) || '';
  }
}
$$('[data-smode]').forEach(function (b) {
  b.addEventListener('click', function () {
    smode = b.dataset.smode;
    $$('[data-smode]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
  });
});
async function scanFiles(list) {
  if (sctl) return;
  var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type); });
  if (!files.length) return;
  if (!sampleFn) { toast(window.claude ? 'Scanning is not available in this view.' : 'Translate and Scan work only when this page is opened inside Claude.', 'err'); return; }
  var caps = null;
  try { caps = await sampleFn.limits(); } catch (e) {}
  if (!caps || !caps.images) { toast('Image scanning is switched off in this view.', 'err'); return; }
  files = files.slice(0, caps.images.maxCount);
  sctl = new AbortController(); setScanBusy(true);
  try {
    var blobs = await Promise.all(files.map(prepImage));
    var tl = LANG[$('#scanlang').value] || '';
    var prompt = 'Read all the text in the attached image' + (blobs.length > 1 ? 's' : '') + ' like a careful text scanner and return it as a clean HTML fragment. ' +
      'Keep the original language, script and spelling exactly (Gujarati, Hindi, English or mixed); do not correct it. Keep the reading order. ' +
      'Use <h1> for the main title, <h2> for section headings, <p> for paragraphs, <ul>/<ol> with <li> for lists, and <b> or <i> only where the original is clearly bold or italic. ' +
      'Write a table as one line of text per row with cells separated by " | ". Skip photos and decoration. If a word cannot be read, write [?]. ' +
      (blobs.length > 1 ? 'The images are consecutive pages in order; put <hr> between pages. ' : '') +
      (tl ? 'After reading, write the whole text in natural, correct ' + tl + ' in its own script instead of the original language. ' : '') +
      'Reply with only the HTML fragment: no code fences, no notes. If the image has no readable text, reply exactly NO_TEXT.';
    var r = await sampleFn(prompt, { images: blobs, signal: sctl.signal, cache: false });
    var out = r.text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
    var res = /^NO_TEXT\b/.test(out) ? '' : cleanScan(out).innerHTML.trim();
    if (!res) { toast('No text found. Try a clearer, closer photo.', 'err'); return; }
    sprev = cleanHtml();
    ed.innerHTML = (smode === 'replace' || docIsBlank()) ? res : sprev + '<p><br></p>' + res;
    selectImg(null); $('#s-undo').hidden = false; afterEdit();
    toast(r.truncated ? 'Page created, but the text was cut short. Scan fewer pages at a time.' : 'Page created from the image');
  } catch (e) {
    var m = scanMsg(e); if (m) toast(m, 'err'); else if (!e || e.code !== 'cancelled') toast('Could not read that image. Try again.', 'err');
  } finally { sctl = null; setScanBusy(false); }
}
['scancam', 'scanfile'].forEach(function (id) {
  $('#' + id).addEventListener('change', function () { var f = this.files; scanFiles(f); this.value = ''; });
});
$('#s-cancel').addEventListener('click', function () { if (sctl) sctl.abort(); });
$('#s-undo').addEventListener('click', function () {
  if (sprev == null) return;
  ed.innerHTML = sprev; sprev = null; selectImg(null); $('#s-undo').hidden = true; afterEdit();
});
