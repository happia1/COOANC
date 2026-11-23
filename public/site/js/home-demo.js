// 홈 미션 체험 — 브라우저 안에서만 동작합니다. 계정, 저장소, 보상 API는 쓰지 않습니다.
// 앱의 정직 확인 규칙을 그대로 옮겼습니다.
//  1) 오전에 오후 미션을 누르면 "거짓말은 안 돼!" 안내 (MissionHonestyBlockedModal)
//  2) 3초 안에 미션 5개를 연달아 누르면 "정말 한 거 맞아?" 확인 (RapidTapConfirmModal)
(function () {
  const root = document.querySelector('[data-home-demo]');
  const dlgPm = document.getElementById('dlg-pm');
  const dlgRapid = document.getElementById('dlg-rapid');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastTrigger = null;

  // <dialog>를 못 쓰는 오래된 브라우저(예: Safari 15.4 미만)에서도 팝업이 뜨도록 대체 동작을 둡니다.
  const supportsModal = typeof HTMLDialogElement === 'function' && dlgPm && typeof dlgPm.showModal === 'function';
  const isOpen = dlg => !!dlg && dlg.hasAttribute('open');
  let fallbackOpen = null;
  function onFallbackKey(e) { if (e.key === 'Escape' && fallbackOpen) closeDialog(fallbackOpen); }

  function openDialog(dlg, trigger) {
    if (!dlg || isOpen(dlg)) return;
    lastTrigger = trigger || document.activeElement;
    if (supportsModal) { dlg.showModal(); return; }
    dlg.setAttribute('open', '');
    dlg.dataset.fallback = '1';
    fallbackOpen = dlg;
    document.addEventListener('keydown', onFallbackKey);
    const first = dlg.querySelector('button');
    if (first) first.focus();
  }
  function closeDialog(dlg) {
    if (!isOpen(dlg)) return;
    if (supportsModal) { dlg.close(); return; }
    dlg.removeAttribute('open');
    fallbackOpen = null;
    document.removeEventListener('keydown', onFallbackKey);
    dlg.dispatchEvent(new Event('close'));
  }
  [dlgPm, dlgRapid].forEach(dlg => {
    if (!dlg) return;
    // 바깥(배경) 클릭으로 닫기
    dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(dlg); });
    dlg.addEventListener('close', () => {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    });
  });
  dlgPm?.querySelector('[data-dlg-close]')?.addEventListener('click', () => closeDialog(dlgPm));

  // 정직 확인 섹션의 "팝업 보기" 버튼
  document.querySelectorAll('[data-open-dialog]').forEach(btn => {
    btn.addEventListener('click', () => openDialog(document.getElementById(btn.dataset.openDialog), btn));
  });

  if (!root) return;
  const cards = [...root.querySelectorAll('.demo-card[data-mission]')];
  const pmCard = root.querySelector('.demo-card[data-block="pm"]');
  const count = root.querySelector('[data-demo-count]');
  const progress = root.querySelector('.demo-progress');
  const credit = root.querySelector('[data-demo-credit]');
  const heart = root.querySelector('[data-demo-heart]');
  const status = root.querySelector('[data-demo-status]');
  const finished = root.querySelector('[data-demo-finished]');
  const reset = root.querySelector('[data-demo-reset]');
  const checkSvg = '<span class="demo-check" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg></span>';
  let completed = 0;
  let taps = [];
  let pending = null; // 확인 팝업이 열려 있는 동안 대기 중인 카드

  function render() {
    count.textContent = `${completed} / ${cards.length} 완료`;
    progress.value = completed;
    credit.textContent = String(10 + completed * 10);
    heart.textContent = String(1 + completed);
    finished.hidden = completed !== cards.length;
  }

  function complete(card) {
    if (card.disabled) return;
    card.disabled = true;
    card.classList.add('is-done');
    card.insertAdjacentHTML('beforeend', checkSvg);
    if (!reduced) {
      card.classList.add('is-completing');
      setTimeout(() => card.classList.remove('is-completing'), 400);
    }
    completed += 1;
    render();
    status.textContent = completed === cards.length
      ? '오전 미션을 모두 해냈어요! 그릇 치우기는 오후에 해요.'
      : `${card.dataset.mission} 완료! 크레딧 10과 하트 1을 모았어요.`;
    if (completed === cards.length) reset.focus({ preventScroll: true });
  }

  cards.forEach(card => card.addEventListener('click', () => {
    if (card.disabled) return;
    const now = Date.now();
    taps = taps.filter(t => now - t < 3000);
    taps.push(now);
    // 3초 안에 5개째를 누르면 바로 완료하지 않고 한 번 더 묻습니다.
    if (taps.length >= 5) {
      pending = card;
      taps = [];
      openDialog(dlgRapid, card);
      return;
    }
    complete(card);
  }));

  pmCard?.addEventListener('click', () => {
    status.textContent = '오후 미션은 정오 이후에 할 수 있어요.';
    openDialog(dlgPm, pmCard);
  });

  dlgRapid?.querySelector('[data-dlg-confirm]')?.addEventListener('click', () => {
    const card = pending; pending = null;
    closeDialog(dlgRapid);
    if (card) complete(card);
  });
  dlgRapid?.querySelector('[data-dlg-deny]')?.addEventListener('click', () => {
    pending = null;
    closeDialog(dlgRapid);
    status.textContent = '괜찮아요. 해낸 뒤에 다시 눌러 보세요.';
  });
  dlgRapid?.addEventListener('close', () => { pending = null; });

  reset.addEventListener('click', () => {
    completed = 0; taps = [];
    cards.forEach(card => {
      card.disabled = false;
      card.classList.remove('is-done');
      card.querySelector('.demo-check')?.remove();
    });
    render();
    status.textContent = '다시 시작해요. 카드를 눌러 보세요.';
    cards[0].focus({ preventScroll: true });
  });
})();
