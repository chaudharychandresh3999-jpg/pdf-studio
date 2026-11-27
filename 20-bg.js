
/* ---- background ---- */
var DARK = '#f5f5f5', INK = '#1d2327';
var SW = [['#ffffff', INK], ['#fff8e1', INK], ['#e8f1fb', INK], ['#e6f4ea', INK], ['#fde8ec', INK], ['#eceff1', INK], ['#14213d', DARK], ['#1f2933', DARK], ['#0b3d2e', DARK]];
var GR = [['linear-gradient(160deg,#ffecd2,#fcb69f)', INK], ['linear-gradient(160deg,#a1c4fd,#c2e9fb)', INK], ['linear-gradient(160deg,#d4fc79,#96e6a1)', INK], ['linear-gradient(160deg,#232526,#414345)', DARK]];
function lum(hex) { var n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; }
function bgProps(bg) {
  if (bg.type === 'gradient') return { backgroundColor: '#ffffff', backgroundImage: bg.value };
  if (bg.type === 'image') return { backgroundColor: '#ffffff', backgroundImage: 'url("' + bg.value + '")' };
  return { backgroundColor: bg.value, backgroundImage: 'none' };
}
function applyBg() {
  var bg = state.bg;
  Object.assign(sheet.style, bgProps(bg), { backgroundSize: PW + 'px ' + PH + 'px', backgroundRepeat: 'repeat-y' });
  sheet.style.setProperty('--page-fg', bg.fg || INK);
  $$('.sw').forEach(function (b) {
    b.setAttribute('aria-pressed', (b.dataset.type === bg.type && b.dataset.value === bg.value) ? 'true' : 'false');
  });
  if (bg.type === 'color') { $('#bgcolor').value = bg.value; $('#bgcolor-bar').style.color = bg.value; }
}
function setBg(bg) { state.bg = bg; applyBg(); scheduleSave(); }
function mkSwatch(parent, type, value, fg, wide) {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'sw' + (wide ? ' wide' : '');
  b.style.background = value; b.dataset.type = type; b.dataset.value = value;
  b.setAttribute('aria-label', type === 'color' ? 'Background ' + value : 'Gradient background');
  b.addEventListener('click', function () { setBg({ type: type, value: value, fg: fg }); });
  parent.appendChild(b);
}
SW.forEach(function (s) { mkSwatch($('#swatches'), 'color', s[0], s[1], false); });
GR.forEach(function (g) { mkSwatch($('#grads'), 'gradient', g[0], g[1], true); });
$('#bgcolor').addEventListener('change', function () {
  setBg({ type: 'color', value: this.value, fg: lum(this.value) < 0.5 ? DARK : INK });
});
$('#bg-reset').addEventListener('click', function () { setBg({ type: 'color', value: '#ffffff', fg: INK }); });

function loadImage(file) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function coverCrop(im, w, h) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var s = Math.max(w / im.width, h / im.height), dw = im.width * s, dh = im.height * s;
  c.getContext('2d').drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}
function avgLum(c) {
  var t = document.createElement('canvas'); t.width = t.height = 16;
  var x = t.getContext('2d'); x.drawImage(c, 0, 0, 16, 16);
  var d = x.getImageData(0, 0, 16, 16).data, s = 0;
  for (var i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  return s / 256;
}
$('#bgfile').addEventListener('change', function () {
  var f = this.files[0]; this.value = '';
  if (!f) return;
  loadImage(f).then(function (im) {
    var c = coverCrop(im, 1190, 1684);
    setBg({ type: 'image', value: c.toDataURL('image/jpeg', 0.85), fg: avgLum(c) < 0.5 ? DARK : INK });
  }).catch(function () { toast('Could not read that image.', 'err'); });
});

/* ---- images, page break ---- */
function ensureRange() {
  if (!savedRange) { var r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); savedRange = r; }
}
function insertImageFile(f) {
  loadImage(f).then(function (im) {
    var s = Math.min(1, 1000 / im.width), c = document.createElement('canvas');
    c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    var url = c.toDataURL(/png/.test(f.type) ? 'image/png' : 'image/jpeg', 0.88);
    ensureRange(); restoreSel();
    document.execCommand('insertHTML', false, '<img src="' + url + '" style="width:60%" alt="">');
    afterEdit();
  }).catch(function () { toast('Could not add that image.', 'err'); });
}
$('#imgfile').addEventListener('change', function () {
  var f = this.files[0]; this.value = '';
  if (f) insertImageFile(f);
});
function selectImg(im) {
  if (selImg) selImg.classList.remove('sel');
  selImg = im;
  if (im) { im.classList.add('sel'); $('#imgw').value = Math.round(parseFloat(im.style.width) || 60); }
  $('#imgw').disabled = !im; $('#img-del').disabled = !im;
}
ed.addEventListener('click', function (e) { selectImg(e.target.tagName === 'IMG' ? e.target : null); });
$('#imgw').addEventListener('input', function () { if (selImg) { selImg.style.width = this.value + '%'; afterEdit(); } });
$('#img-del').addEventListener('click', function () { if (selImg) { selImg.remove(); selectImg(null); afterEdit(); } });
function cleanHtml() { return ed.innerHTML.replace(/ class="sel"/g, ''); }
$('#btn-pb').addEventListener('click', function () {
  ensureRange(); restoreSel();
  document.execCommand('insertHTML', false, '<div class="pb" contenteditable="false"></div><p><br></p>');
  var pb = $$('.pb', ed).filter(function (x) { return !x.style.height; })[0];
  if (pb) {
    var top = (pb.getBoundingClientRect().top - ed.getBoundingClientRect().top) / state.z;
    pb.style.height = (PH - (top % PH) + PAD_T) + 'px';
  }
  afterEdit();
});
