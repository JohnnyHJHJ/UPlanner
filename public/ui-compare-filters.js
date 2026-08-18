/* Isolated Compare filters, matching the compact People/Search workflow. */
(function () {
  'use strict';
  var state = { school: [], degree: [], group: [], open: false };
  function esc(value) { return window.escHtml ? window.escHtml(value) : String(value || ''); }
  function schedules() { return window.getRecords ? window.getRecords('schedule') : []; }
  function owner(schedule) { return window.findUserById ? window.findUserById(schedule.user_id) : null; }
  function values(key) { var seen = {}; schedules().forEach(function (schedule) { var person = owner(schedule); var value = person && person[key]; if (value) seen[value] = true; }); return Object.keys(seen).sort(); }
  function groups() { var session = window.getSession && window.getSession(); return session && window.getUserGroups ? window.getUserGroups(session.userId) : []; }
  function chip(value, type, label) { var active = state[type].indexOf(value) >= 0; return '<button type="button" class="ucf-chip ' + (active ? 'active' : '') + '" data-ucf-type="' + type + '" data-ucf-value="' + esc(value) + '" aria-pressed="' + active + '">' + esc(label || value) + (active ? ' ✓' : '') + '</button>'; }
  function groupContains(groupId, userId) { return (window.getGroupMembers ? window.getGroupMembers(groupId) : []).some(function (member) { return member.target_user_id === userId; }); }
  function match(schedule) { var person = owner(schedule) || {}; return (!state.school.length || state.school.indexOf(person.school) >= 0) && (!state.degree.length || state.degree.indexOf(person.degree_program) >= 0) && (!state.group.length || state.group.some(function (groupId) { return groupContains(groupId, schedule.user_id); })); }
  function apply() { document.querySelectorAll('#compare-checklist label').forEach(function (label) { var input = label.querySelector('input'); var id = input && (input.getAttribute('onchange') || '').match(/'([^']+)'/); var schedule = id && schedules().find(function (item) { return item.schedule_id === id[1]; }); label.style.display = schedule && match(schedule) ? '' : 'none'; }); }
  function selectedCount() { return state.school.length + state.degree.length + state.group.length; }
  function render() {
    var card = document.getElementById('compare-search') && document.getElementById('compare-search').closest('.card');
    if (!card || document.getElementById('ucf-filters')) return;
    var box = document.createElement('div'); box.id = 'ucf-filters'; box.className = 'ucf-filters';
    box.innerHTML = '<button type="button" class="ucf-toggle" data-ucf-toggle aria-expanded="' + state.open + '"><span>Filters' + (selectedCount() ? ' (' + selectedCount() + ')' : '') + '</span><span aria-hidden="true">' + (state.open ? '−' : '+') + '</span></button><div class="ucf-body' + (state.open ? '' : ' hidden') + '"><div><b>School</b><div class="ucf-chips">' + (values('school').map(function (value) { return chip(value, 'school'); }).join('') || '<span>No schools available.</span>') + '</div></div><div><b>Degree / course</b><div class="ucf-chips">' + (values('degree_program').map(function (value) { return chip(value, 'degree'); }).join('') || '<span>No degrees available.</span>') + '</div></div><div><b>My groups</b><div class="ucf-chips">' + (groups().map(function (group) { return chip(group.group_id, 'group', group.name); }).join('') || '<span>No groups yet.</span>') + '</div></div><button type="button" class="btn-secondary text-xs" data-ucf-clear>Clear filters</button></div>';
    box.addEventListener('click', function (event) {
      if (event.target.closest('[data-ucf-toggle]')) { state.open = !state.open; box.remove(); render(); return; }
      if (event.target.closest('[data-ucf-clear]')) { state.school = []; state.degree = []; state.group = []; box.remove(); render(); apply(); return; }
      var button = event.target.closest('[data-ucf-type]'); if (!button) return;
      var type = button.dataset.ucfType, value = button.dataset.ucfValue, at = state[type].indexOf(value);
      if (at < 0) state[type].push(value); else state[type].splice(at, 1);
      box.remove(); render(); apply();
    });
    card.insertBefore(box, document.getElementById('compare-checklist')); apply();
  }
  function install() { if (!window.renderCompareChecklist || window.__uCompareFiltersInstalled) return; window.__uCompareFiltersInstalled = true; var originalChecklist = window.renderCompareChecklist; window.renderCompareChecklist = function () { originalChecklist(); apply(); }; setInterval(render, 500); var style = document.createElement('style'); style.textContent = '.ucf-filters{margin:.85rem 0;padding:.7rem .8rem;border:1px solid rgba(148,163,184,.15);border-radius:.75rem;background:rgba(15,23,42,.48)}.ucf-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:none;color:#e2e8f0;font-size:.82rem;font-weight:800;cursor:pointer}.ucf-body{display:grid;gap:.65rem;padding-top:.8rem}.ucf-body b{font-size:.76rem;color:#cbd5e1}.ucf-body span{font-size:.76rem;color:#64748b}.ucf-chips{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem}.ucf-chip{padding:.32rem .62rem;border-radius:999px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.76);color:#cbd5e1;font-size:.74rem}.ucf-chip.active{background:rgba(244,63,94,.17);border-color:#fb7185;color:#fff}'; document.head.appendChild(style); }
  install();
})();
