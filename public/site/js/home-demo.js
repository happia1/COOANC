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
    const pmCards = [...root.querySelectorAll('.demo-card[data-block="pm"]')];
    const divider = root.querySelector('.demo-divider');
    const count = root.querySelector('[data-demo-count]');
    const credit = root.querySelector('[data-demo-credit]');
    const heart = root.querySelector('[data-demo-heart]');
    const status = root.querySelector('[data-demo-status]');
    const reset = root.querySelector('[data-demo-reset]');
    const finger = root.querySelector('[data-demo-hint]'); // 카드를 누르도록 유도하는 손가락과 말풍선
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
      if (finger) finger.hidden = true; // 한 번 눌러 보면 손가락은 사라집니다
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

    pmCards.forEach(pmCard => pmCard.addEventListener('click', () => {
      if (finger) finger.hidden = true;
      status.textContent = '오후 미션은 낮 12시 이후에 할 수 있어요.';
      openDialog(dlgPm, pmCard);
    }));
    rail?.addEventListener('scroll', () => { if (finger && rail.scrollLeft > 8) finger.hidden = true; }, { passive: true });

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
      if (finger) finger.hidden = false;
      render();
      status.textContent = '다시 시작해요. 카드를 눌러 보세요.';
    });
    render();
  }

  /* ───────── 안전장치 설명 슬라이더 ───────── */
  document.querySelectorAll('[data-fslider]').forEach(fs => {
    const track = fs.querySelector('[data-fs-track]');
    const slides = [...track.children];
    const dots = [...fs.querySelectorAll('[data-fs-dot]')];
    const countEl = fs.querySelector('[data-fs-count]');
    const titleEl = fs.querySelector('[data-fs-title]');
    const index = () => Math.min(slides.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth + 16)));
    const sync = () => {
      const i = index();
      if (countEl) countEl.textContent = `${i + 1} / ${slides.length}`;
      if (titleEl) titleEl.textContent = slides[i].querySelector('h3')?.textContent || '';
      dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
    };
    bindRail(track, fs.querySelector('[data-fs-prev]'), fs.querySelector('[data-fs-next]'), sync);
    dots.forEach((d, k) => d.addEventListener('click', () => {
      track.scrollTo({ left: slides[k].offsetLeft - track.offsetLeft, behavior });
    }));
  });

  /* ───────── 흐르는 카드 (금융역량 관련자료, 부모님 이야기) ─────────
     마우스를 올리거나 손가락으로 만지거나 키보드로 들어오면 멈추고, 직접 넘겨 볼 수 있습니다.
     모션 줄이기 설정에서는 흐르지 않고 직접 넘기기만 합니다. */
  document.querySelectorAll('[data-flow-track]').forEach(flow => {
    const set = flow.querySelector('.flow-set');
    if (reduced || !set) return;
    const gap = parseFloat(getComputedStyle(flow).columnGap) || 12;
    const loop = () => set.offsetWidth + gap;
    // 화면보다 짧은 카드 묶음은 끊김 없이 이어지도록 복제본을 충분히 붙입니다.
    let guard = 0;
    do {
      const clone = set.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
      flow.appendChild(clone);
      guard += 1;
    } while (flow.scrollWidth < flow.clientWidth + loop() + 4 && guard < 6);
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
        if (pos >= loop()) pos -= loop();
        flow.scrollLeft = pos;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  /* ───────── 설계 원칙 카드 (좌우 넘기기) ───────── */
  const ev = document.querySelector('[data-ev-track]');
  if (ev) bindRail(ev, document.querySelector('[data-ev-prev]'), document.querySelector('[data-ev-next]'));

  /* ───────── 홈 요약 플레이어: 장면을 순서대로 보여 줍니다 ───────── */
  document.querySelectorAll('[data-flow]').forEach(fp => {
    const scenes = [...fp.querySelectorAll('[data-scene]')];
    const dots = [...fp.querySelectorAll('[data-flow-dot]')];
    const cap = fp.querySelector('[data-flow-caption]');
    const BASE_RATE = 2.2;
    const rateOf = s => Number(s.dataset.rate) || BASE_RATE;
    let i = 0, timer = null, first = true;
    // 장면 자체의 페이드(트랜지션)는 건드리지 않고, 안쪽 CSS 애니메이션만 멈추거나 처음부터 재생합니다.
    const cssAnims = el => el.getAnimations({ subtree: true }).filter(a => 'animationName' in a);
    let swap = null;
    function show(n) {
      i = n;
      clearTimeout(swap);
      // 먼저 이전 장면을 걷어내고, 다 사라진 뒤에 다음 장면을 처음부터 재생해 장면이 겹쳐 보이지 않게 합니다.
      scenes.forEach(s => {
        s.classList.remove('is-active');
        s.setAttribute('aria-hidden', 'true');
        cssAnims(s).forEach(a => a.pause());
      });
      dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === n)));
      if (cap) cap.textContent = scenes[n].dataset.caption || '';
      const go = () => {
        const s = scenes[n];
        s.classList.add('is-active');
        s.setAttribute('aria-hidden', 'false');
        cssAnims(s).forEach(a => { a.currentTime = 0; a.playbackRate = rateOf(s); a.play(); });
      };
      if (first) { first = false; go(); } else { swap = setTimeout(go, 200); }
    }
    const stop = () => { clearTimeout(timer); timer = null; };
    // 장면마다 재생 속도가 달라서, 그 장면이 끝날 때쯤 다음 장면으로 넘어갑니다.
    const start = () => {
      stop();
      if (reduced) return;
      const tick = () => { show((i + 1) % scenes.length); timer = setTimeout(tick, 9000 / rateOf(scenes[i]) + 500); };
      timer = setTimeout(tick, 9000 / rateOf(scenes[i]) + 500);
    };
    dots.forEach((d, k) => d.addEventListener('click', () => { show(k); if (timer) start(); }));
    const step = d => { show((i + d + scenes.length) % scenes.length); if (timer) start(); };
    fp.querySelector('[data-flow-prev]')?.addEventListener('click', () => step(-1));
    fp.querySelector('[data-flow-next]')?.addEventListener('click', () => step(1));
    // 손가락으로 좌우로 밀어 넘기기
    let sx = 0, sy = 0;
    const stage = fp.querySelector('.flow-stage');
    stage?.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stage?.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    show(0);
    if (!reduced && 'IntersectionObserver' in window) {
      new IntersectionObserver(es => { if (es[0].isIntersecting && !document.hidden) start(); else stop(); }).observe(fp);
    } else if (!reduced) { start(); }
  });

  /* ───────── 단계 카드 줄: 좌우로 넘기고, 보이는 카드의 애니메이션만 처음부터 재생 ───────── */
  document.querySelectorAll('[data-cardrail]').forEach(rail => {
    const track = rail.querySelector('[data-ct]');
    const prev = rail.querySelector('[data-ct-prev]');
    const next = rail.querySelector('[data-ct-next]');
    const upd = () => {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * 0.8, behavior }));
    next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * 0.8, behavior }));
    track.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    window.addEventListener('resize', upd);
    upd();
    // 도식 크기 맞추기
    const fit = () => track.querySelectorAll('.step-scale').forEach(box => {
      const w = box.clientWidth;
      if (!w) return;
      const k = Math.min(1, w / 346);
      box.style.setProperty('--k', k.toFixed(4));
      box.style.setProperty('--x', Math.max(0, (w - 346 * k) / 2).toFixed(1) + 'px');
    });
    fit();
    window.addEventListener('resize', fit);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(track);
    const sims = [...track.querySelectorAll('[data-step-sim]')];
    if (!sims.length) return;
    const RATES = [2.2, 2.2, 2.2, 1.8, 1.8, 2.2];
    const anims = el => el.getAnimations({ subtree: true }).filter(a => 'animationName' in a);
    const inCard = new Set();
    let railVisible = false;
    const apply = () => sims.forEach((s, k) => {
      const on = railVisible && inCard.has(s) && !document.hidden;
      if (on && !s.dataset.playing) {
        s.dataset.playing = '1';
        anims(s).forEach(a => { a.currentTime = 0; a.playbackRate = RATES[k] || 2.2; a.play(); });
      } else if (!on && s.dataset.playing) {
        delete s.dataset.playing;
        anims(s).forEach(a => a.pause());
      }
    });
    sims.forEach(s => anims(s).forEach(a => a.pause()));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) inCard.add(e.target); else inCard.delete(e.target); }); apply(); }, { root: track, threshold: 0.6 });
      sims.forEach(s => io.observe(s));
      new IntersectionObserver(es => { railVisible = es[0].isIntersecting; apply(); }).observe(rail);
    } else { railVisible = true; sims.forEach(s => inCard.add(s)); apply(); }
  });

  /* ───────── 12시 전 오후 카드 시연: 화면에 보일 때만 재생 ───────── */
  document.querySelectorAll('[data-sim]').forEach(sim => {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => sim.classList.toggle('is-playing', es[0].isIntersecting && !document.hidden)).observe(sim);
    } else { sim.classList.add('is-playing'); }
  });
})();
