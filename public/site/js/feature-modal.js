// 일곱 가지 기능 카드를 누르면 팝업으로 설명을 보여 줍니다.
(function () {
  const dlg = document.getElementById('feature-dialog');
  if (!dlg) return;
  const body = dlg.querySelector('[data-fd-body]');
  const noEl = dlg.querySelector('[data-fd-no]');
  const countEl = dlg.querySelector('[data-fd-count]');
  const contents = [...document.querySelectorAll('[data-feature-content]')];
  const supportsModal = typeof dlg.showModal === 'function';
  let current = 0, lastTrigger = null;

  function fill(i) {
    current = (i + contents.length) % contents.length;
    const src = contents[current];
    body.innerHTML = '';
    [...src.children].forEach(n => body.appendChild(n.cloneNode(true)));
    const h = body.querySelector('h2');
    if (h) h.id = 'feature-dialog-title';
    dlg.style.setProperty('--accent', src.style.getPropertyValue('--accent'));
    noEl.textContent = String(current + 1).padStart(2, '0');
    countEl.textContent = `${current + 1} / ${contents.length}`;
    body.scrollTop = 0;
    dlg.scrollTop = 0;
  }
  function open(i, trigger) {
    lastTrigger = trigger || document.activeElement;
    fill(i);
    if (dlg.open || dlg.hasAttribute('open')) return;
    if (supportsModal) dlg.showModal();
    else { dlg.setAttribute('open', ''); dlg.dataset.fallback = '1'; }
    document.documentElement.classList.add('fd-lock');
  }
  function close() {
    if (supportsModal) dlg.close();
    else { dlg.removeAttribute('open'); dlg.dispatchEvent(new Event('close')); }
  }
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('fd-lock');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.querySelector('[data-fd-close]').addEventListener('click', close);
  dlg.querySelector('[data-fd-prev]').addEventListener('click', () => fill(current - 1));
  dlg.querySelector('[data-fd-next]').addEventListener('click', () => fill(current + 1));
  document.addEventListener('keydown', e => {
    if (!dlg.open && !dlg.hasAttribute('open')) return;
    if (e.key === 'ArrowLeft') fill(current - 1);
    if (e.key === 'ArrowRight') fill(current + 1);
    if (e.key === 'Escape' && !supportsModal) close();
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-feature-open]');
    if (t) open(Number(t.dataset.featureOpen), t);
    const g = e.target.closest('[data-go-slide]');
    if (g) {
      const fs = g.closest('[data-fslider]');
      const dot = fs && fs.querySelectorAll('[data-fs-dot]')[Number(g.dataset.goSlide)];
      if (dot) dot.click();
    }
  });
})();
