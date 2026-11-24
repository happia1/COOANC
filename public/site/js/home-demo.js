// 홈 — 미션 체험과 안전장치 슬라이더. 브라우저 안에서만 동작하며 계정, 저장소, 보상 API는 쓰지 않습니다.
// 앱의 정직 확인 규칙을 그대로 옮겼습니다.
//  1) 오전에 오후 미션을 누르면 "거짓말은 안 돼!" 안내 (MissionHonestyBlockedModal)
//  2) 3초 안에 미션 5개를 연달아 누르면 "정말 한 거 맞아?" 확인 (RapidTapConfirmModal)
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduced ? 'auto' : 'smooth';

  /* ───────── 팝업 ───────── */
  const dlgPm = document.getElementById('dlg-pm');
  const dlgRapid = document.getElementById('dlg-rapid');
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
    dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(dlg); });
    dlg.addEventListener('close', () => {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    });
  });
  dlgPm?.querySelector('[data-dlg-close]')?.addEventListener('click', () => closeDialog(dlgPm));

  /* ───────── 좌우 레일 공통 (미션 카드, 안전장치 설명) ───────── */
  function bindRail(track, prev, next, onMove) {
    if (!track) return;
    const step = () => Math.max(120, Math.round(track.clientWidth * 0.8));
    const update = () => {
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      if (onMove) onMove();
    };
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior }));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update);
    update();
    return update;
  }

  /* ───────── 미션 체험 ───────── */
  const root = document.querySelector('[data-home-demo]');
  if (root) {
    const rail = root.querySelector('[data-demo-rail]');
    const cards = [...root.querySelectorAll('.demo-card[data-mission]')];
    const pmCard = root.querySelector('.demo-card[data-block="pm"]');
    const divider = root.querySelector('.demo-divider');
    const count = root.querySelector('[data-demo-count]');
    const credit = root.querySelector('[data-demo-credit]');
    const heart = root.querySelector('[data-demo-heart]');
    const status = root.querySelector('[data-demo-status]');
    const reset = root.querySelector('[data-demo-reset]');
    const refresh = bindRail(rail, root.querySelector('[data-rail-prev]'), root.querySelector('[data-rail-next]'));
    let completed = 0;
    let taps = [];
    let pending = null; // 확인 팝업이 열려 있는 동안 대기 중인 카드

    function render() {
      count.textContent = `${completed} / ${cards.length}`;
      credit.textContent = String(10 + completed * 10);
      heart.textContent = String(1 + completed);
      reset.hidden = completed !== cards.length;
      if (divider) divider.hidden = completed === cards.length; // 오전 카드가 모두 사라지면 구분선도 숨김
      if (refresh) refresh();
    }

    function complete(card) {
      if (card.disabled) return;
      card.disabled = true;
      completed += 1;
      status.textContent = completed === cards.length
        ? '오전 미션을 모두 해냈어요! 파란 오후 카드는 낮 12시 이후에 해요.'
        : `${card.dataset.mission} 완료! 크레딧 10과 하트 1을 모았어요.`;
      const finish = () => { card.hidden = true; render(); };
      if (reduced) { finish(); return; }
      card.classList.add('is-completing');
      setTimeout(finish, 380);
      count.textContent = `${completed} / ${cards.length}`;
      credit.textContent = String(10 + completed * 10);
      heart.textContent = String(1 + completed);
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
      status.textContent = '오후 미션은 낮 12시 이후에 할 수 있어요.';
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
      cards.forEach(card => { card.disabled = false; card.hidden = false; card.classList.remove('is-completing'); });
      rail.scrollLeft = 0;
      render();
      status.textContent = '다시 시작해요. 카드를 눌러 보세요.';
    });
    render();
  }

  /* ───────── 안전장치 설명 슬라이더 ───────── */
  const fs = document.querySelector('[data-fslider]');
  if (fs) {
    const track = fs.querySelector('[data-fs-track]');
    const slides = [...track.children];
    const dots = [...fs.querySelectorAll('[data-fs-dot]')];
    const countEl = fs.querySelector('[data-fs-count]');
    const index = () => Math.min(slides.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth + 16)));
    const sync = () => {
      const i = index();
      countEl.textContent = `${i + 1} / ${slides.length}`;
      dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
    };
    bindRail(track, fs.querySelector('[data-fs-prev]'), fs.querySelector('[data-fs-next]'), sync);
    dots.forEach((d, k) => d.addEventListener('click', () => {
      track.scrollTo({ left: slides[k].offsetLeft - track.offsetLeft, behavior });
    }));
  }

  /* ───────── 금융역량 관련자료: 한 줄로 천천히 흐르는 카드 ─────────
     마우스를 올리거나 손가락으로 만지거나 키보드로 들어오면 멈추고, 직접 넘겨 볼 수 있습니다.
     모션 줄이기 설정에서는 흐르지 않고 직접 넘기기만 합니다. */
  const flow = document.querySelector('[data-flow-track]');
  if (flow) {
    const set = flow.querySelector('.flow-set');
    if (!reduced && set) {
      const clone = set.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
      flow.appendChild(clone);
      const gap = parseFloat(getComputedStyle(flow).columnGap) || 12;
      const SPEED = 22; // px/초
      let pos = 0, last = 0, held = false, visible = false, resumeTimer = null;
      const hold = () => { held = true; clearTimeout(resumeTimer); };
      const release = (delay) => { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { pos = flow.scrollLeft; held = false; }, delay); };
      flow.addEventListener('mouseenter', hold);
      flow.addEventListener('mouseleave', () => release(300));
      flow.addEventListener('focusin', hold);
      flow.addEventListener('focusout', () => release(300));
      flow.addEventListener('touchstart', hold, { passive: true });
      flow.addEventListener('touchend', () => release(2500), { passive: true });
      flow.addEventListener('wheel', () => { hold(); release(2500); }, { passive: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(flow);
      } else { visible = true; }
      function tick(ts) {
        const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
        last = ts;
        if (!held && visible && !document.hidden) {
          pos += SPEED * dt;
          const loop = set.offsetWidth + gap;
          if (pos >= loop) pos -= loop;
          flow.scrollLeft = pos;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }
})();
