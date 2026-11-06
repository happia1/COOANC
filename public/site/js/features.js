document.querySelectorAll('[data-feature-tour]').forEach(root => {
  const panels = [...root.querySelectorAll('[data-tour-panel]')];
  const selectors = [...root.querySelectorAll('[data-tour-select]')];
  const prev = root.querySelector('[data-tour-prev]');
  const next = root.querySelector('[data-tour-next]');
  const preview = root.querySelector('[data-parent-preview]');
  const parentNames = { 'parent-home': '홈', 'parent-routine': '루틴', 'parent-market': '상품 관리' };
  const rail = root.querySelector('.core-card-rail');
  let index = 0;
  function show(value, announce = true) {
    index = Math.max(0, Math.min(panels.length - 1, value));
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    selectors.forEach(button => {
      const active = Number(button.dataset.tourSelect) === index;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
    const panel = panels[index];
    if (preview) {
      preview.src = `/site/assets/${panel.dataset.parentScreen}.webp`;
      preview.alt = `부모 앱 ${parentNames[panel.dataset.parentScreen]} 화면`;
      root.querySelector('[data-parent-caption]').textContent = `실제 앱 · ${parentNames[panel.dataset.parentScreen]} 화면`;
      const highlight = root.querySelector('.parent-hotspot');
      highlight.style.top = `${panel.dataset.parentY}%`;
      highlight.style.height = `${panel.dataset.parentHeight}%`;
    }
    root.querySelector('[data-tour-count]').textContent = `${String(index + 1).padStart(2, '0')} / ${String(panels.length).padStart(2, '0')}`;
    prev.disabled = index === 0;
    next.disabled = index === panels.length - 1;
    if (announce && rail) selectors.find(button => Number(button.dataset.tourSelect) === index).scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
    if (announce) root.querySelector('.tour-announcement').textContent = `${panel.dataset.featureName} 설명. 선택한 기능의 화면을 확인하세요.`;
  }
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  selectors.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.tourSelect))));
  document.querySelectorAll('[data-tour-jump]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.tourTarget !== root.id) return;
    show(Number(button.dataset.tourJump));
    root.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    selectors.find(item => Number(item.dataset.tourSelect) === index).focus({ preventScroll: true });
  }));
  rail?.addEventListener('scrollend', () => {
    const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
    const cards = [...rail.children];
    const nearest = cards.reduce((best, card, i) => {
      const box = card.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - center);
      return distance < best.distance ? { index: i, distance } : best;
    }, { index, distance: Infinity });
    if (nearest.index !== index) show(nearest.index);
  });
  show(0, false);
});
