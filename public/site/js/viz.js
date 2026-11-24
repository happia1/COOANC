// 설명 도식(.viz) 슬라이더와 재생 제어 — 서비스 소개의 접이식 장면에서 씁니다.
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduced ? 'auto' : 'smooth';
  document.querySelectorAll('[data-fslider]').forEach(fs => {
    const track = fs.querySelector('[data-fs-track]');
    const slides = [...track.children];
    const dots = [...fs.querySelectorAll('[data-fs-dot]')];
    const prev = fs.querySelector('[data-fs-prev]');
    const next = fs.querySelector('[data-fs-next]');
    const countEl = fs.querySelector('[data-fs-count]');
    const index = () => Math.min(slides.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth + 20)));
    const sync = () => {
      const i = index();
      // 장면마다 높이가 달라 아래에 빈 공간이 남지 않도록 현재 장면 높이에 맞춥니다.
      if (slides[i].offsetHeight > 0) track.style.height = slides[i].offsetHeight + 'px';
      if (countEl) countEl.textContent = `${i + 1} / ${slides.length}`;
      dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    const step = () => Math.max(120, Math.round(track.clientWidth * 0.8));
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior }));
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    window.addEventListener('resize', sync);
    dots.forEach((d, k) => d.addEventListener('click', () => track.scrollTo({ left: slides[k].offsetLeft - track.offsetLeft, behavior })));
    fs.closest('details')?.addEventListener('toggle', () => requestAnimationFrame(sync));
    sync();
  });
  document.querySelectorAll('[data-sim]').forEach(sim => {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => sim.classList.toggle('is-playing', es[0].isIntersecting && !document.hidden)).observe(sim);
    } else { sim.classList.add('is-playing'); }
  });
})();
