// Local demonstration only: no account, storage or reward API is involved.
document.querySelectorAll('[data-mission-demo]').forEach(root => {
  const cards = [...root.querySelectorAll('[data-mission]')];
  const track = root.querySelector('.demo-cards');
  const count = root.querySelector('[data-demo-count]');
  const progress = root.querySelector('progress');
  const credit = root.querySelector('[data-demo-credit]');
  const heart = root.querySelector('[data-demo-heart]');
  const status = root.querySelector('.demo-status');
  const finished = root.querySelector('.demo-finished');
  const reset = root.querySelector('.demo-reset');
  const controls = root.querySelector('.demo-rail-controls');
  const sparkles = root.querySelector('.demo-sparkles');
  let completed = 0;
  let pending = 0;

  function render() {
    count.textContent = `${completed} / ${cards.length} 완료`;
    progress.value = completed;
    credit.textContent = String(10 + completed * 10);
    heart.textContent = String(1 + completed);
    const allDone = completed === cards.length && pending === 0;
    finished.hidden = !allDone;
    track.hidden = allDone;
    controls.hidden = allDone;
  }

  cards.forEach(card => card.addEventListener('click', () => {
    if (card.disabled) return;
    card.disabled = true;
    completed += 1;
    pending += 1;
    render();
    status.textContent = `${card.dataset.mission} 완료! 크레딧 10과 하트 1을 모았어요.`;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      const box = card.getBoundingClientRect();
      const layer = sparkles.getBoundingClientRect();
      for (let i = 0; i < 8; i += 1) {
        const star = document.createElement('span');
        star.textContent = '✦';
        star.style.left = `${box.left - layer.left + box.width / 2}px`;
        star.style.top = `${box.top - layer.top + box.height / 2}px`;
        star.style.setProperty('--dx', `${Math.cos(i * Math.PI / 4) * 78}px`);
        star.style.setProperty('--dy', `${Math.sin(i * Math.PI / 4) * 78}px`);
        sparkles.append(star);
        setTimeout(() => star.remove(), 700);
      }
      card.classList.add('is-completing');
    }
    setTimeout(() => {
      const moveFocus = document.activeElement === card;
      card.hidden = true;
      card.classList.remove('is-completing');
      pending -= 1;
      render();
      if (completed === cards.length && pending === 0) status.textContent = '다섯 미션을 모두 해냈어요! 다시 체험하기로 한 번 더 해보세요.';
      if (moveFocus) (cards.find(item => !item.disabled) || reset).focus({ preventScroll: true });
      track.dispatchEvent(new Event('scroll'));
    }, reduced ? 0 : 380);
  }));

  reset.addEventListener('click', () => {
    if (pending) return;
    completed = 0;
    cards.forEach(card => { card.disabled = false; card.hidden = false; });
    render();
    track.scrollLeft = 0;
    track.dispatchEvent(new Event('scroll'));
    status.textContent = '다시 시작해요. 미션 카드를 눌러보세요.';
    cards[0].focus({ preventScroll: true });
  });
});
