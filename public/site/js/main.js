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
  function startAuto(){ timer = setInterval(next, 4200); }
  function stopAuto(){ clearInterval(timer); }
  dots.forEach((d,i)=> d.addEventListener('click', ()=>{ goTo(i); stopAuto(); startAuto(); }));
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);
  startAuto();
}

