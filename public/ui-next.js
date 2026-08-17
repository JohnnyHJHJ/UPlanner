/* UPlanner UI Next
 * Isolated enhancement layer. Does not replace existing views or APIs.
 */
(function () {
  'use strict';

  function getTag(person) {
    if (!person) return '';
    var raw = person.username_tag || person.username || person.handle || person.tag || '';
    raw = String(raw).trim().replace(/^#/, '');
    return /^[a-z0-9][a-z0-9_-]*$/i.test(raw) ? '#' + raw : '';
  }

  function addTag(el, person) {
    if (!el || el.querySelector('.ui-next-username-tag')) return;
    var tag = getTag(person);
    if (!tag) return;
    var badge = document.createElement('span');
    badge.className = 'ui-next-username-tag';
    badge.textContent = tag;
    el.appendChild(badge);
  }

  function compare() {
    document.querySelectorAll('[data-view="compare"] .compare-person, [data-view="compare"] .comparison-person, [data-view="compare"] .selected-person, #view-compare .compare-person, #view-compare .comparison-person').forEach(function (el) {
      addTag(el, el.__uplannerPerson || null);
    });
  }

  function schedule() {
    document.querySelectorAll('[data-view="schedule"], #view-schedule, #schedule-view, .schedule-view').forEach(function (root) {
      if (root.querySelector('.ui-next-schedule-edit')) return;
      var existing = Array.from(root.querySelectorAll('button')).find(function (b) {
        return /edit\s*(schedule)?/i.test(b.textContent || '');
      });
      if (existing) { existing.classList.add('ui-next-schedule-edit'); return; }
      var target = root.querySelector('[data-action="edit-schedule"], #edit-schedule, button[onclick*="editSchedule"]');
      if (!target) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-next-schedule-edit';
      btn.textContent = 'Edit Schedule';
      btn.addEventListener('click', function () { target.click(); });
      root.insertBefore(btn, root.firstChild);
    });
  }

  function groups() {
    document.querySelectorAll('[data-view="groups"], #view-groups, #groups-view').forEach(function (root) {
      root.classList.add('ui-next-groups');
      root.querySelectorAll('.group-card, [data-group-id]').forEach(function (card) {
        card.classList.add('ui-next-group-card');
      });
    });
  }

  function run() { compare(); schedule(); groups(); }

  function styles() {
    if (document.getElementById('ui-next-styles')) return;
    var s = document.createElement('style');
    s.id = 'ui-next-styles';
    s.textContent = '.ui-next-username-tag{display:inline-flex;align-items:center;margin-left:.4rem;padding:.15rem .45rem;border-radius:999px;font-size:.72rem;font-weight:600;opacity:.82;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}.ui-next-schedule-edit{display:inline-flex;align-items:center;justify-content:center;margin:.5rem 0;padding:.55rem .85rem;border-radius:.7rem;cursor:pointer}.ui-next-group-card{transition:transform .15s ease,box-shadow .15s ease}.ui-next-group-card:hover{transform:translateY(-1px)}@media (prefers-reduced-motion:reduce){.ui-next-group-card{transition:none}}';
    document.head.appendChild(s);
  }

  styles();
  run();
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  window.UPlannerUINext = { run: run, usernameTag: getTag };
})();
