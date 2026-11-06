document.querySelectorAll('[data-routine-demo]').forEach(root => {
  const edit = root.querySelector('.routine-edit');
  const panel = root.querySelector('.routine-keywords');
  const chips = [...root.querySelectorAll('[data-routine]')];
  const list = root.querySelector('.routine-list');
  const status = root.querySelector('.routine-status');
  function render() {
    list.replaceChildren();
    const selected = chips.filter(chip => chip.getAttribute('aria-pressed') === 'true');
    selected.forEach(chip => {
      const row = document.createElement('div');
      row.className = 'routine-selected';
      const title = document.createElement('strong');
      title.textContent = chip.dataset.routine;
      const reward = document.createElement('span');
      reward.textContent = '크레딧 10 · 하트 1';
      row.append(title, reward);
      list.append(row);
    });
    if (!selected.length) {
      const empty = document.createElement('p');
      empty.textContent = '위에서 키워드를 고르면 여기에 미션이 생겨요.';
      list.append(empty);
    }
    return selected.length;
  }
  edit.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    edit.setAttribute('aria-expanded', String(!panel.hidden));
    edit.textContent = panel.hidden ? '미션 수정하기' : '설정 마치기';
    if (!panel.hidden) chips[0].focus({ preventScroll: true });
  });
  chips.forEach(chip => chip.addEventListener('click', () => {
    const active = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(active));
    const total = render();
    status.textContent = `${chip.dataset.routine} ${active ? '설정' : '해제'}했어요. 현재 ${total}개의 미션을 골랐어요.`;
  }));
  render();
});
