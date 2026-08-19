// ===== 모바일 네비 토글 =====
const navToggle = document.getElementById('navToggle');
const navMobile = document.getElementById('navMobile');
if (navToggle && navMobile){
  navToggle.addEventListener('click', ()=> navMobile.classList.toggle('open'));
}

// ===== fade-in on view =====
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
}, {threshold:0.12});
document.querySelectorAll('.fade').forEach(el=>io.observe(el));

// ===== 가이드 목차 스크롤스파이 (현재 위치만 볼드+밑줄) =====
const tocLinks = document.querySelectorAll('.toc a[href^="#"]');
if (tocLinks.length){
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

// ===== 설치 CTA : 기기 분기 =====
const APP_URL = 'https://cooanc.vercel.app/';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
});

function handleInstall(){
  if (deferredPrompt){
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(()=>{ deferredPrompt = null; });
  } else if (isIOS){
    const overlay = document.getElementById('iosOverlay');
    if(overlay) overlay.classList.add('show');
    else window.open(APP_URL, '_blank');
  } else {
    window.open(APP_URL, '_blank');
  }
}
document.querySelectorAll('[data-install]').forEach(btn=>{
  btn.addEventListener('click', handleInstall);
});
const iosClose = document.getElementById('iosClose');
if (iosClose){
  iosClose.addEventListener('click', ()=> document.getElementById('iosOverlay').classList.remove('show'));
}

// ===== 히어로 슬라이드 배너 =====
const slider = document.getElementById('heroSlider');
if (slider){
  const slides = slider.querySelectorAll('.slide');
  const dots = slider.querySelectorAll('.slider-dots button');
  let current = 0;
  let timer;
  function goTo(i){
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = i;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }
  function next(){ goTo((current + 1) % slides.length); }
  function startAuto(){ timer = setInterval(next, 2500); }
  function stopAuto(){ clearInterval(timer); }
  dots.forEach((d,i)=> d.addEventListener('click', ()=>{ goTo(i); stopAuto(); startAuto(); }));
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);
  startAuto();
}

// ===== 이미지 확대 보기(라이트박스) =====
const lightboxOverlay = document.getElementById('lightboxOverlay');
if (lightboxOverlay){
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  document.querySelectorAll('[data-lightbox]').forEach(img=>{
    img.addEventListener('click', ()=>{
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || '';
      lightboxOverlay.classList.add('show');
    });
  });
  lightboxClose.addEventListener('click', ()=> lightboxOverlay.classList.remove('show'));
  lightboxOverlay.addEventListener('click', (e)=>{
    if (e.target === lightboxOverlay) lightboxOverlay.classList.remove('show');
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') lightboxOverlay.classList.remove('show');
  });
}

