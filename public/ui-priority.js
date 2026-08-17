/* UPlanner priority enhancements: login hint, birthdays, compare, dashboard. */
(function () {
  'use strict';
  var esc = window.escHtml || function (v) { return String(v || '').replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var birthdayPeople = [];
  function api(url) { return fetch(url, { credentials:'include' }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Unable to load people.'); return d; }); }); }

  function loginHint() {
    var input = document.getElementById('li-input');
    if (!input || document.getElementById('up-login-hint')) return;
    var hint = document.createElement('p'); hint.id = 'up-login-hint'; hint.className = 'up-login-hint hidden';
    hint.textContent = 'Another user is named Jed. If this is you, sign in as jed2.';
    input.insertAdjacentElement('afterend', hint);
    input.addEventListener('input', function () { hint.classList.toggle('hidden', !/^jed$/i.test(input.value.trim())); });
  }

  function birthdayView() {
    var root = document.getElementById('app'); if (!root) return;
    root.innerHTML = '<section class="up-birthday-page"><div class="up-page-head"><div><p class="up-kicker">People calendar</p><h1>Birthdays</h1><p>Never miss a chance to celebrate the people in your UPlanner circle.</p></div><button id="up-birthday-back" class="btn-secondary">Back</button></div><div id="up-birthday-body" class="up-loading">Loading birthdays…</div></section>';
    document.getElementById('up-birthday-back').addEventListener('click', function () { window.showView('dashboard'); });
    api('/api/people').then(function (data) {
      var me = window.getSession && window.findUserById ? window.findUserById(window.getSession().userId) : null;
      birthdayPeople = (data.people || []).concat(me ? [me] : []).filter(function (p) { return p.birthday; });
      renderBirthdays();
    }).catch(function (error) { document.getElementById('up-birthday-body').textContent = error.message; });
  }

  function renderBirthdays() {
    var body = document.getElementById('up-birthday-body'); if (!body) return;
    var now = new Date();
    var months = Array.from({ length:12 }, function (_, month) { return month; }).map(function (month) {
      var people = birthdayPeople.filter(function (p) { return new Date(String(p.birthday).slice(0,10) + 'T00:00:00').getMonth() === month; })
        .sort(function (a,b) { return new Date(a.birthday).getDate() - new Date(b.birthday).getDate(); });
      if (!people.length) return '';
      var label = new Date(2024, month, 1).toLocaleDateString(undefined, { month:'long' });
      return '<article class="card up-month ' + (month === now.getMonth() ? 'up-month-now' : '') + '"><h2>' + label + '</h2><div class="up-birthday-list">' + people.map(function (p) { var date = new Date(String(p.birthday).slice(0,10)+'T00:00:00'); return '<div class="up-birthday-person"><span class="up-date">' + date.getDate() + '</span><span class="up-avatar">' + esc(p.profile_emoji || '🎂') + '</span><span><b>' + esc(p.username) + '</b>' + (p.full_name ? '<small>' + esc(p.full_name) + '</small>' : '') + '</span></div>'; }).join('') + '</div></article>';
    }).join('');
    body.innerHTML = months || '<div class="card p-6 text-gray-300">No birthdays are available yet.</div>';
  }

  function addCalendarNav() {
    if (document.getElementById('up-calendar-nav')) return;
    var compare = document.querySelector('[data-nav="compare"]'); if (!compare) return;
    var button = document.createElement('button'); button.id = 'up-calendar-nav'; button.className = 'nav-link'; button.type='button'; button.innerHTML='🎂 <span class="hidden md:inline">Birthdays</span>';
    button.addEventListener('click', birthdayView); compare.insertAdjacentElement('afterend', button);
  }

  function decorateCompare() {
    var input = document.getElementById('compare-search'); if (!input || input.dataset.upStyled) return;
    input.dataset.upStyled = 'true'; input.placeholder = 'Search people to add…'; input.classList.add('up-compare-search');
    var card = input.closest('.card'); if (card) { card.classList.add('up-compare-card'); var label = card.querySelector('label'); if (label) label.innerHTML = 'Choose your people <span class="up-compare-subtitle">Search, select, then compare schedules.</span>'; }
  }

  function decorateDashboard() {
    var grid = document.querySelector('.u-dashboard-grid'); if (!grid || grid.dataset.upStyled) return;
    grid.dataset.upStyled='true'; grid.classList.add('up-dashboard-grid');
    var head = grid.previousElementSibling; if (head) head.classList.add('up-dashboard-head');
  }

  function install() {
    var style = document.createElement('style');
    style.textContent = '.up-login-hint{margin-top:.55rem;padding:.65rem .75rem;border-radius:.65rem;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.28);color:#fde68a;font-size:.82rem}.up-page-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}.up-kicker{font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fb7185}.up-page-head h1{font-size:clamp(1.75rem,4vw,2.45rem);font-weight:800;color:#f8fafc}.up-page-head p:not(.up-kicker){color:#94a3b8;margin-top:.3rem}.up-loading{padding:2rem;color:#94a3b8}.up-birthday-page{max-width:1100px;margin:auto}.up-birthday-page #up-birthday-body{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:1rem;margin-top:1.5rem}.up-month{padding:1rem}.up-month-now{border-color:rgba(251,113,133,.48)!important;box-shadow:0 12px 30px rgba(251,113,133,.08)}.up-month h2{font-weight:800;color:#f8fafc;margin-bottom:.7rem}.up-birthday-list{display:grid;gap:.45rem}.up-birthday-person{display:flex;align-items:center;gap:.6rem;padding:.45rem;border-radius:.6rem;background:rgba(148,163,184,.06);color:#e2e8f0}.up-birthday-person b,.up-birthday-person small{display:block}.up-birthday-person small{font-size:.72rem;color:#94a3b8}.up-date{width:2rem;text-align:center;font-weight:800;color:#fda4af}.up-avatar{font-size:1.15rem}.up-compare-card{background:linear-gradient(135deg,rgba(30,41,59,.86),rgba(15,23,42,.9))!important;border-color:rgba(251,113,133,.2)!important}.up-compare-subtitle{display:block;font-size:.76rem;font-weight:400;color:#94a3b8;margin-top:.2rem}.up-compare-search{box-shadow:inset 0 0 0 1px rgba(148,163,184,.12)}.up-dashboard-head{padding:1.25rem;border:1px solid rgba(251,113,133,.2);border-radius:1rem;background:radial-gradient(circle at top right,rgba(251,113,133,.16),transparent 42%),rgba(15,23,42,.76)}.up-dashboard-grid .u-dashboard-card{border-color:rgba(148,163,184,.16)!important;background:rgba(15,23,42,.78)!important}.up-dashboard-grid .u-dashboard-card:first-child{background:linear-gradient(145deg,rgba(244,63,94,.18),rgba(15,23,42,.84))!important}@media(max-width:640px){.up-page-head button{width:100%}.up-birthday-page #up-birthday-body{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    setInterval(function () { loginHint(); addCalendarNav(); decorateCompare(); decorateDashboard(); }, 500);
  }
  install();
})();
