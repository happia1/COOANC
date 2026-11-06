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
      const detailImage = root.querySelector('[data-parent-detail-image]');
      detailImage.src = preview.src;
      detailImage.alt = `${preview.alt}의 ${panel.dataset.featureName} 영역 확대`;
      root.querySelector('[data-parent-detail-title]').textContent = `부모 화면 · ${panel.dataset.featureName}`;
      const crop = root.querySelector('.parent-detail-crop');
      crop.style.aspectRatio = `828 / ${1793 * Number(panel.dataset.parentHeight) / 100}`;
      detailImage.style.marginTop = `${-1793 / 828 * Number(panel.dataset.parentY)}%`;
      const highlight = root.querySelector('.parent-hotspot');
      highlight.style.top = `${panel.dataset.parentY}%`;
      highlight.style.height = `${panel.dataset.parentHeight}%`;
    }
    root.querySelector('[data-tour-count]').textContent = `${String(index + 1).padStart(2, '0')} / ${String(panels.length).padStart(2, '0')}`;
    prev.disabled = index === 0;
    next.disabled = index === panels.length - 1;
    if (announce && rail) {
      const card = rail.children[index];
      const left = rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - card.getBoundingClientRect().width) / 2;
      rail.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    if (announce) root.querySelector('.tour-announcement').textContent = `${panel.dataset.featureName} 설명. 선택한 기능의 화면을 확인하세요.`;
  }
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  selectors.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.tourSelect))));
  rail?.addEventListener('scrollend', () => {
    const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
    const cards = [...rail.children];
    const nearest = cards.reduce((best, card, i) => {
      const box = card.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - center);
      return distance < best.distance ? { index: i, distance } : best;
    }, { index, distance: Infinity });
    if (nearest.index !== index) show(nearest.index, false);
  });
  show(0, false);
});
