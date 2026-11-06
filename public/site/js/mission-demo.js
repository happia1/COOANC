// Homepage-only demo: completing a card never calls the app's reward API.
document.querySelectorAll('[data-mission-demo]').forEach(root => {
  const cards = [...root.querySelectorAll('[data-mission]')];
  const count = root.querySelector('[data-demo-count]');
  const progress = root.querySelector('progress');
  const credit = root.querySelector('[data-demo-credit]');
  const heart = root.querySelector('[data-demo-heart]');
  const status = root.querySelector('.demo-status');
  const finished = root.querySelector('.demo-finished');
  const reset = root.querySelector('.demo-reset');
  let completed = 0;

  function render() {
    count.textContent = `${completed} / ${cards.length} 완료`;
    progress.value = completed;
    credit.textContent = String(completed * 10);
    heart.textContent = String(completed);
    finished.hidden = completed !== cards.length;
    root.querySelector('.demo-cards').hidden = completed === cards.length;
  }

  cards.forEach(card => card.addEventListener('click', () => {
    if (card.disabled) return;
    card.disabled = true;
    card.hidden = true;
    completed += 1;
    render();
    status.textContent = `${card.dataset.mission} 완료! 크레딧 10과 하트 1을 모았어요.${completed === cards.length ? ' 모든 미션을 완료했어요!' : ''}`;
    (cards.find(item => !item.disabled) || reset).focus({ preventScroll: true });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.querySelector('.demo-wallet').animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
        { duration: 350, easing: 'ease-out' }
      );
    }
  }));

  reset.addEventListener('click', () => {
    completed = 0;
    cards.forEach(card => { card.disabled = false; card.hidden = false; });
    render();
    status.textContent = '다시 시작해요. 미션 카드를 눌러보세요.';
    cards[0].focus({ preventScroll: true });
  });
});
