
/* ---- motion helpers: sliding tab underline, page counter pulse ---- */
var tabsEl = $('.tabs'), tabInd = $('#tabind');
var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function moveTabInd() {
  var t = $('.tab[aria-selected="true"]');
  if (!t) return;
  tabInd.style.setProperty('--x', t.offsetLeft + 'px');
  tabInd.style.setProperty('--w', t.offsetWidth + 'px');
  tabsEl.classList.add('js');
}
$$('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    moveTabInd();
    tabsEl.scrollTo({ left: Math.max(0, t.offsetLeft - 24), behavior: calm ? 'auto' : 'smooth' });
  });
});
if (window.ResizeObserver) new ResizeObserver(moveTabInd).observe(tabsEl);
function bumpPages() {
  var el = $('#pageinfo');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
