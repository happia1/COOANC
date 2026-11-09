// Keep the rail as tall as the current tip, including expanded explanations.
const tipsTrack = document.querySelector('.habit-grid[data-rail-track]');
if (tipsTrack && typeof ResizeObserver !== 'undefined') {
  const tips = [...tipsTrack.children];
  function fitTip() {
    const edge = tipsTrack.getBoundingClientRect().left;
    const current = tips.reduce((nearest, tip) =>
      Math.abs(tip.getBoundingClientRect().left - edge) < Math.abs(nearest.getBoundingClientRect().left - edge) ? tip : nearest);
    tipsTrack.style.height = `${current.getBoundingClientRect().height + 20}px`;
  }
  const observer = new ResizeObserver(fitTip);
  tips.forEach(tip => observer.observe(tip));
  tipsTrack.addEventListener('scroll', fitTip, { passive: true });
  fitTip();
}
