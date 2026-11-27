
/* ---- export: each page is drawn from a copy of the text, then packed into a PDF ---- */
var dl = null, exporting = false;
function nextFrames() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }
function renderPage(i, html) {
  var host = document.createElement('div'); host.className = 'xhost';
  var page = document.createElement('div'); page.className = 'xpage';
  Object.assign(page.style, bgProps(state.bg), { backgroundSize: PW + 'px ' + PH + 'px', backgroundRepeat: 'no-repeat' });
  page.style.setProperty('--page-fg', state.bg.fg || INK);
  var inner = document.createElement('div'); inner.className = 'doc';
  inner.innerHTML = html;
  inner.style.top = (-i * PH) + 'px'; inner.style.minHeight = (state.pages * PH) + 'px';
  page.appendChild(inner); host.appendChild(page); document.body.appendChild(host);
  return nextFrames().then(function () {
    return window.html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
  }).then(function (c) { host.remove(); return c; }, function (e) { host.remove(); throw e; });
}
function saveBlob(fn, blob) {
  if (window.AndroidBridge) {
    var fr = new FileReader();
    fr.onload = function () {
      var s = String(fr.result);
      try { window.AndroidBridge.savePdf(fn, s.slice(s.indexOf(',') + 1)); } catch (e) { toast('Could not save the PDF.', 'err'); }
    };
    fr.readAsDataURL(blob);
    return;
  }
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function exportPdf() {
  if (exporting) return;
  if (!dl && window.claude) { toast('Saving is not available here. Open this page in a browser to download the PDF.', 'err'); return; }
  if (typeof window.html2canvas !== 'function' || !window.jspdf) { toast('The PDF tools did not load. Check the internet and reload.', 'err'); return; }
  exporting = true; $('#btn-dl').disabled = true; $('#btn-dl').classList.add('busy');
  try {
    selectImg(null);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    var html = cleanHtml(), n = state.pages;
    var pdf = new window.jspdf.jsPDF({ unit: 'pt', format: [PW, PH], orientation: 'portrait', compress: true });
    for (var i = 0; i < n; i++) {
      toast('Preparing page ' + (i + 1) + ' of ' + n + '…', 'busy');
      var c = await renderPage(i, html);
      if (ink.length) {
        var t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
        paintAll(t.getContext('2d'), ink, c.width / PW, i * PH);
        c.getContext('2d').drawImage(t, 0, 0);
      }
      if (i > 0) pdf.addPage([PW, PH], 'portrait');
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PW, PH, undefined, 'FAST');
    }
    var name = ($('#fname').value || '').replace(/[\\\/:*?"<>|]+/g, '').trim() || 'document';
    $('#toast').hidden = true;
    if (dl) await dl.save({ filename: name + '.pdf', data: pdf.output('arraybuffer') });
    else saveBlob(name + '.pdf', pdf.output('blob'));
    toast('PDF saved');
  } catch (e) {
    if (e && e.code === 'declined') $('#toast').hidden = true;
    else if (e && e.code === 'host_unavailable') toast('This app cannot save files. Open the page in a browser to download.', 'err');
    else toast('Could not make the PDF. Try again, or remove very large images.', 'err');
  } finally { exporting = false; $('#btn-dl').disabled = false; $('#btn-dl').classList.remove('busy'); }
}
$('#btn-dl').addEventListener('click', exportPdf);

/* ---- start ---- */
if (window.claude && window.claude.use) {
  window.claude.use('downloads').then(function (d) { dl = d; }, function () {});
  window.claude.use('sample').then(function (f) {
    sampleFn = f;
    if (!f) $$('[data-lang]').forEach(function (b) { b.disabled = true; b.title = 'Translation is not available in this view'; });
  }, function () {});
}
(function init() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  var ok = saved && typeof saved.html === 'string' && saved.html.length;
  ed.innerHTML = ok ? sanitize(saved.html).innerHTML : SAMPLE;
  sampleText = ok ? null : ed.textContent.trim();
  var b = saved && saved.bg;
  if (b && typeof b.value === 'string' && (
    (b.type === 'color' && /^#[0-9a-f]{6}$/i.test(b.value)) ||
    (b.type === 'gradient' && /^linear-gradient\([#0-9a-z ,()%.]+\)$/i.test(b.value)) ||
    (b.type === 'image' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(b.value)))) {
    state.bg = { type: b.type, value: b.value, fg: b.fg === DARK ? DARK : INK };
  }
  if (saved && typeof saved.name === 'string') $('#fname').value = saved.name.slice(0, 60);
  if (saved) loadInk(saved.ink);
  applyBg(); layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); moveTabInd(); });
  moveTabInd();
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('ready'); }); });
})();
document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
})();
