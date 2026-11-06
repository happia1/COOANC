document.querySelectorAll('[data-card-rail]').forEach(root => {
  const track = root.querySelector('[data-rail-track]');
  const prev = root.querySelector('[data-rail-prev]');
  const next = root.querySelector('[data-rail-next]');
  function update() {
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  }
  [prev, next].forEach((button, index) => button.addEventListener('click', () => {
    track.scrollBy({ left: (index ? 1 : -1) * track.clientWidth * .8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }));
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});
