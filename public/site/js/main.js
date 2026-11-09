// ===== 모바일 네비 토글 =====
const navToggle = document.getElementById('navToggle');
const navMobile = document.getElementById('navMobile');
if (navToggle && navMobile){
  navToggle.setAttribute('aria-controls', 'navMobile');
  function setNavOpen(open){
    navMobile.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  }
  const desktop = window.matchMedia('(min-width: 860px)');
  desktop.addEventListener('change', e=>{ if(e.matches) setNavOpen(false); });
  setNavOpen(false);
  navToggle.addEventListener('click', ()=> setNavOpen(!navMobile.classList.contains('open')));
  navMobile.addEventListener('click', e=>{ if(e.target.closest('a')) setNavOpen(false); });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && navMobile.classList.contains('open')){
      setNavOpen(false);
      navToggle.focus();
    }
  });
}

// ===== 공용 CTA — "쿠앵크 시작하기" 블록 (홈 · 서비스소개 등에서 재사용, 마크업은 여기 한 곳에서만 관리) =====
document.querySelectorAll('[data-cta-install]').forEach(el=>{
  el.innerHTML = `
    <p class="cta-kicker">우리 아이의 바른 생활 습관 형성의 시작</p>
    <h2>지금 바로 시작해보세요!</h2>
    <div style="margin-top:22px;">
      <a class="btn btn-primary" href="https://cooanc.vercel.app/">쿠앵크 시작하기</a>
      <p class="free-note">홈 화면에 추가하는 방법 · <a href="/site/guide.html" style="text-decoration:underline;">가이드 보기</a></p>
    </div>
  `;
});

// ===== 가이드 목차 스크롤스파이 (현재 위치만 볼드+밑줄) =====
const tocLinks = document.querySelectorAll('.toc a[href^="#"]');
if (tocLinks.length && typeof IntersectionObserver !== 'undefined'){
  const targets = Array.from(tocLinks)
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  const spy = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (!entry.isIntersecting) return;
      const link = document.querySelector(`.toc a[href="#${entry.target.id}"]`);
      if (!link) return;
      tocLinks.forEach(l=>l.classList.remove('active'));
      link.classList.add('active');
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
  targets.forEach(t=>spy.observe(t));
}

// ===== 탭 전환 (data-tabgroup 단위로 여러 그룹 지원) =====
document.querySelectorAll('.tabbtn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const group = btn.closest('[data-tabgroup]');
    if(!group) return;
    group.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
    group.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    group.querySelector('#' + btn.dataset.tab).classList.add('active');
  });
});

// ===== 문의하기: 해시(#blog, #faq, #partner)로 서브탭 딥링크 =====
const inquiryTabs = document.getElementById('inquiryTabs');
if (inquiryTabs){
  const hash = location.hash.replace('#', '');
  const target = ['faq','blog','partner'].includes(hash) ? 'pane-' + hash : null;
  if (target){
    inquiryTabs.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active', b.dataset.tab === target));
    inquiryTabs.querySelectorAll('.tabpanel').forEach(p=>p.classList.toggle('active', p.id === target));
  }
}

// ===== 설치 가이드: 접속 기기에 맞는 탭 기본 선택 =====
const deviceGuide = document.getElementById('deviceGuide');
if (deviceGuide){
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  const target = isIOS ? 'pane-ios' : (/Android/i.test(ua) ? 'pane-android' : null);
  if (target){
    deviceGuide.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active', b.dataset.tab === target));
    deviceGuide.querySelectorAll('.tabpanel').forEach(p=>p.classList.toggle('active', p.id === target));
  }
}

// ===== 듀얼 화면 전환 (패드 / 모바일) =====
document.querySelectorAll('[data-dual-view]').forEach(root=>{
  root.querySelectorAll('.dual-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      root.querySelectorAll('.dual-btn').forEach(b=>b.classList.remove('active'));
      root.querySelectorAll('.dual-pane').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      root.querySelector(`[data-dual-pane="${btn.dataset.dual}"]`).classList.add('active');
    });
  });
});

// ===== 탭 + 프리뷰 캐러셀 (한 프레임 안에서 클릭/스와이프로 전환) =====
document.querySelectorAll('[data-pv-carousel]').forEach(root=>{
  const tabs = root.querySelectorAll('.pv-tab');
  const dots = root.querySelectorAll('.pv-dot');
  const track = root.querySelector('.pv-track');
  const viewport = root.querySelector('.pv-viewport');
  const slideCount = root.querySelectorAll('.pv-slide').length;
  let index = 0;

  function render(){
    track.style.transform = `translateX(-${index * 100}%)`;
    tabs.forEach((t,i)=> t.classList.toggle('active', i === index));
    dots.forEach((d,i)=> d.classList.toggle('active', i === index));
  }
  function goTo(i){
    index = Math.max(0, Math.min(slideCount - 1, i));
    render();
  }
  tabs.forEach((t,i)=> t.addEventListener('click', ()=> goTo(i)));
  dots.forEach((d,i)=> d.addEventListener('click', ()=> goTo(i)));

  // 스와이프 / 드래그
  let dragging = false, startX = 0, deltaX = 0, viewportWidth = 0;
  function dragStart(clientX){
    dragging = true;
    startX = clientX;
    deltaX = 0;
    viewportWidth = viewport.getBoundingClientRect().width || 1;
    track.classList.add('dragging');
  }
  function dragMove(clientX){
    if (!dragging) return;
    deltaX = clientX - startX;
    const percent = (deltaX / viewportWidth) * 100;
    track.style.transform = `translateX(calc(-${index * 100}% + ${percent}%))`;
  }
  function dragEnd(){
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    const percent = (deltaX / viewportWidth) * 100;
    if (percent < -12 && index < slideCount - 1) goTo(index + 1);
    else if (percent > 12 && index > 0) goTo(index - 1);
    else render();
  }
  viewport.addEventListener('touchstart', e=> dragStart(e.touches[0].clientX), {passive:true});
  viewport.addEventListener('touchmove', e=> dragMove(e.touches[0].clientX), {passive:true});
  viewport.addEventListener('touchend', dragEnd);
  viewport.addEventListener('mousedown', e=>{ e.preventDefault(); dragStart(e.clientX); });
  window.addEventListener('mousemove', e=> dragMove(e.clientX));
  window.addEventListener('mouseup', dragEnd);

  window.addEventListener('resize', render);
  render();
});

// ===== 이메일 주소 복사 =====
document.querySelectorAll('[data-copy-email]').forEach(button=>{
  button.addEventListener('click', async ()=>{
    const status = document.getElementById('emailCopyStatus');
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
      status.textContent = '이메일 주소를 복사했어요.';
    } catch {
      status.textContent = '복사하지 못했어요. 위 이메일 주소를 직접 선택해 복사해주세요.';
    }
  });
});
