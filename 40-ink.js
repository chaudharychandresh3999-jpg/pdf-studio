
/* ---- drawing layer: strokes are kept as vectors in page coordinates ---- */
var ink = [], inkCanvas = $('#ink'), inkCtx = inkCanvas.getContext('2d');
var pen = { tool: 'pen', color: '#111111', size: 4 }, inkK = 2, cur = null, scrollMode = false, inkRaf = 0, clearArm = 0;
var TOOLS = ['pen', 'marker', 'eraser', 'line', 'rect', 'ellipse'];
var INK_COLORS = ['#111111', '#e53935', '#1e66f5', '#2e9e57', '#fb8c00', '#8e44ad', '#ffffff'];
function isShape(t) { return t === 'line' || t === 'rect' || t === 'ellipse'; }
function paintStroke(ctx, s, k, oy) {
  var P = s.pts, last = P[P.length - 1], i;
  function X(p) { return p[0] * k; }
  function Y(p) { return (p[1] - oy) * k; }
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = s.size * (s.tool === 'marker' || s.tool === 'eraser' ? 3 : 1) * k;
  ctx.strokeStyle = ctx.fillStyle = s.color;
  if (s.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = ctx.fillStyle = '#000'; }
  if (s.tool === 'marker') ctx.globalAlpha = 0.35;
  ctx.beginPath();
  if (s.tool === 'line') { ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(last), Y(last)); ctx.stroke(); }
  else if (s.tool === 'rect') { ctx.rect(X(P[0]), Y(P[0]), X(last) - X(P[0]), Y(last) - Y(P[0])); ctx.stroke(); }
  else if (s.tool === 'ellipse') {
    ctx.ellipse((X(P[0]) + X(last)) / 2, (Y(P[0]) + Y(last)) / 2, Math.abs(X(last) - X(P[0])) / 2, Math.abs(Y(last) - Y(P[0])) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (P.length === 1) { ctx.arc(X(P[0]), Y(P[0]), ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
  else {
    ctx.moveTo(X(P[0]), Y(P[0]));
    for (i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(X(P[i]), Y(P[i]), (X(P[i]) + X(P[i + 1])) / 2, (Y(P[i]) + Y(P[i + 1])) / 2);
    ctx.lineTo(X(last), Y(last)); ctx.stroke();
  }
  ctx.restore();
}
function paintAll(ctx, list, k, oy) { for (var i = 0; i < list.length; i++) paintStroke(ctx, list[i], k, oy); }
function redraw() {
  inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  paintAll(inkCtx, cur ? ink.concat([cur]) : ink, inkK, 0);
}
function scheduleInk() { if (!inkRaf) inkRaf = requestAnimationFrame(function () { inkRaf = 0; redraw(); }); }
function sizeInk() {
  var H = state.pages * PH, k = Math.min(2, 12000 / H), w = Math.round(PW * k), h = Math.round(H * k);
  inkCanvas.style.height = H + 'px';
  if (inkCanvas.width !== w || inkCanvas.height !== h) { inkCanvas.width = w; inkCanvas.height = h; inkK = k; redraw(); }
}
function drawOn() { var t = $('.tab[aria-selected="true"]'); return !!t && t.dataset.tab === 'draw' && !scrollMode; }
function updateMode() {
  var on = drawOn();
  inkCanvas.classList.toggle('on', on);
  if (on) { selectImg(null); if (document.activeElement === ed) ed.blur(); }
}
$$('.tab').forEach(function (t) { t.addEventListener('click', updateMode); });
function updateInkButtons() { $('#ink-undo').disabled = !ink.length; $('#ink-clear').disabled = !ink.length; }
function pt(e) {
  var r = inkCanvas.getBoundingClientRect();
  return [+((e.clientX - r.left) / state.z).toFixed(1), +((e.clientY - r.top) / state.z).toFixed(1)];
}
inkCanvas.addEventListener('pointerdown', function (e) {
  if (!drawOn() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  try { inkCanvas.setPointerCapture(e.pointerId); } catch (x) {}
  cur = { tool: pen.tool, color: pen.color, size: pen.size, pts: [pt(e)] };
  scheduleInk();
});
inkCanvas.addEventListener('pointermove', function (e) {
  if (!cur) return;
  var p = pt(e), P = cur.pts;
  if (isShape(cur.tool)) P[1] = p;
  else { var q = P[P.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.8) P.push(p); }
  scheduleInk();
});
function endStroke() {
  if (!cur) return;
  if (!isShape(cur.tool) || cur.pts.length > 1) { ink.push(cur); updateInkButtons(); scheduleSave(); }
  cur = null; scheduleInk();
}
inkCanvas.addEventListener('pointerup', endStroke);
inkCanvas.addEventListener('pointercancel', endStroke);

$$('[data-tool]').forEach(function (b) {
  b.addEventListener('click', function () {
    pen.tool = b.dataset.tool;
    $$('[data-tool]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
  });
});
function setPenColor(c) {
  pen.color = c; $('#inkcolor-bar').style.color = c;
  $$('#inkcolors .ic').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.value === c ? 'true' : 'false'); });
}
INK_COLORS.forEach(function (c) {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'ic'; b.style.background = c; b.dataset.value = c;
  b.setAttribute('aria-label', 'Pen colour ' + c);
  b.addEventListener('click', function () { setPenColor(c); });
  $('#inkcolors').appendChild(b);
});
$('#inkcolor').addEventListener('change', function () { setPenColor(this.value); });
setPenColor(pen.color);
$('#inksize').addEventListener('input', function () { pen.size = +this.value; $('#inksize-val').textContent = this.value; });
$('#ink-undo').addEventListener('click', function () { ink.pop(); redraw(); updateInkButtons(); scheduleSave(); });
$('#ink-clear').addEventListener('click', function () {
  var b = $('#ink-clear');
  if (!clearArm) {
    b.textContent = 'Tap again to clear'; clearArm = setTimeout(function () { clearArm = 0; b.textContent = 'Clear drawing'; }, 3000);
    return;
  }
  clearTimeout(clearArm); clearArm = 0; b.textContent = 'Clear drawing';
  ink = []; redraw(); updateInkButtons(); scheduleSave();
});
$('#ink-scroll').addEventListener('click', function () {
  scrollMode = !scrollMode; this.setAttribute('aria-pressed', scrollMode ? 'true' : 'false'); updateMode();
});
function loadInk(arr) {
  ink = [];
  if (!Array.isArray(arr)) return;
  arr.slice(0, 2000).forEach(function (s) {
    if (!s || TOOLS.indexOf(s.tool) < 0 || !/^#[0-9a-f]{6}$/i.test(s.color) || !(s.size >= 0.5 && s.size <= 60) || !Array.isArray(s.pts) || !s.pts.length || s.pts.length > 5000) return;
    var ok = s.pts.every(function (p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]); });
    if (ok) ink.push({ tool: s.tool, color: s.color, size: +s.size, pts: s.pts.map(function (p) { return [+p[0], +p[1]]; }) });
  });
  updateInkButtons();
}
