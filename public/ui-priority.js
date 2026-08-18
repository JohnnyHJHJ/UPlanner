/* UPlanner priority enhancements: login hint, birthdays, compare, dashboard. */
(function () {
  'use strict';
  var esc = window.escHtml || function (v) { return String(v || '').replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var birthdayPeople = [];
  var birthdayState = { month: '', query: '', savedOnly: false, school: [], degree: [] };
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
    document.querySelectorAll('[data-nav]').forEach(function (item) { item.classList.remove('active'); item.removeAttribute('aria-current'); });
    var birthdayNav = document.getElementById('up-calendar-nav'); if (birthdayNav) { birthdayNav.classList.add('active'); birthdayNav.setAttribute('aria-current', 'page'); }
    root.innerHTML = '<section class="up-birthday-page"><div class="up-page-head"><div><p class="up-kicker">People calendar</p><h1>Birthdays</h1><p>Find birthdays with the same search and tag filters you use in People.</p></div><button id="up-birthday-back" class="btn-secondary">Back</button></div><div id="up-birthday-controls" class="card up-birthday-controls"><input id="up-birthday-search" class="input-field" placeholder="Search by name or username…"><button id="up-birthday-saved" class="btn-secondary text-xs">Saved people</button><button id="up-birthday-clear" class="btn-secondary text-xs">Clear filters</button><div id="up-birthday-months" class="up-birthday-months"></div></div><div id="up-birthday-filters" class="card up-birthday-filters"></div><div id="up-birthday-body" class="up-loading">Loading birthdays…</div></section>';
    document.getElementById('up-birthday-back').addEventListener('click', function () { window.showView('dashboard'); });
    document.getElementById('up-birthday-search').addEventListener('input', function (event) { birthdayState.query = event.target.value; renderBirthdays(); });
    document.getElementById('up-birthday-saved').addEventListener('click', function () { birthdayState.savedOnly = !birthdayState.savedOnly; this.className = (birthdayState.savedOnly ? 'btn-primary' : 'btn-secondary') + ' text-xs'; renderBirthdays(); });
    document.getElementById('up-birthday-clear').addEventListener('click', function () { birthdayState = { month: '', query: '', savedOnly: false, school: [], degree: [] }; document.getElementById('up-birthday-search').value = ''; document.getElementById('up-birthday-saved').className = 'btn-secondary text-xs'; renderBirthdays(); });
    api('/api/people').then(function (data) {
      var me = window.getSession && window.findUserById ? window.findUserById(window.getSession().userId) : null;
      birthdayPeople = (data.people || []).concat(me ? [me] : []).filter(function (p) { return p.birthday; });
      renderBirthdays();
    }).catch(function (error) { document.getElementById('up-birthday-body').textContent = error.message; });
  }

  function birthdayTags(person, key) { return (person[key] || []).map(function (tag) { return { id: String(tag.id || tag.display_name || tag.canonical_name || ''), name: tag.display_name || tag.canonical_name || '' }; }).filter(function (tag) { return tag.id && tag.name; }); }
  function birthdayCatalog(key) { var seen = {}; birthdayPeople.forEach(function (person) { birthdayTags(person, key).forEach(function (tag) { seen[tag.id] = tag; }); }); return Object.keys(seen).map(function (id) { return seen[id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function birthdayMatchesTags(person, type) { var selected = birthdayState[type]; if (!selected.length) return true; var key = type === 'school' ? 'school_tags' : 'degree_tags'; return birthdayTags(person, key).some(function (tag) { return selected.indexOf(tag.id) !== -1; }); }
  function birthdayFilterChip(tag, type) { var active = birthdayState[type].indexOf(tag.id) !== -1; return '<button type="button" class="up-birthday-chip ' + (active ? 'active' : '') + '" data-birthday-filter="' + type + '" data-birthday-tag="' + esc(tag.id) + '" aria-pressed="' + active + '">' + esc(tag.name) + (active ? ' ✓' : '') + '</button>'; }
  function renderBirthdayFilters() { var root = document.getElementById('up-birthday-filters'); if (!root) return; var schools = birthdayCatalog('school_tags'); var degrees = birthdayCatalog('degree_tags'); root.innerHTML = '<div><strong>School</strong><div class="up-birthday-chips">' + (schools.length ? schools.map(function (tag) { return birthdayFilterChip(tag, 'school'); }).join('') : '<span>No visible school tags available.</span>') + '</div></div><div><strong>Degree / course</strong><div class="up-birthday-chips">' + (degrees.length ? degrees.map(function (tag) { return birthdayFilterChip(tag, 'degree'); }).join('') : '<span>No visible degree tags available.</span>') + '</div></div>';
    root.onclick = function (event) { var button = event.target.closest('[data-birthday-filter]'); if (!button) return; var type = button.dataset.birthdayFilter; var id = button.dataset.birthdayTag; var at = birthdayState[type].indexOf(id); if (at === -1) birthdayState[type].push(id); else birthdayState[type].splice(at, 1); renderBirthdays(); };
  }

  function renderBirthdays() {
    var body = document.getElementById('up-birthday-body'); if (!body) return;
    var now = new Date();
    renderBirthdayFilters();
    var monthRoot = document.getElementById('up-birthday-months');
    if (monthRoot) monthRoot.innerHTML = '<button class="up-birthday-chip ' + (!birthdayState.month ? 'active' : '') + '" data-month="">All</button>' + Array.from({ length:12 }, function (_, month) { return '<button class="up-birthday-chip ' + (String(month) === birthdayState.month ? 'active' : '') + '" data-month="' + month + '">' + new Date(2024, month, 1).toLocaleDateString(undefined, { month:'short' }) + '</button>'; }).join('');
    if (monthRoot && !monthRoot.dataset.bound) { monthRoot.dataset.bound='true'; monthRoot.addEventListener('click', function (event) { var chip = event.target.closest('[data-month]'); if (!chip) return; birthdayState.month = chip.dataset.month; renderBirthdays(); }); }
    var months = Array.from({ length:12 }, function (_, month) { return month; }).map(function (month) {
      var people = birthdayPeople.filter(function (p) { var matchesMonth = new Date(String(p.birthday).slice(0,10) + 'T00:00:00').getMonth() === month; var matchesFilter = !birthdayState.month || Number(birthdayState.month) === month; var haystack = [p.username,p.full_name].join(' ').toLowerCase(); return matchesMonth && matchesFilter && (!birthdayState.savedOnly || p.saved) && birthdayMatchesTags(p, 'school') && birthdayMatchesTags(p, 'degree') && haystack.indexOf(birthdayState.query.toLowerCase()) >= 0; })
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
    var button = document.createElement('button'); button.id = 'up-calendar-nav'; button.type = 'button'; button.className = 'nav-link'; button.innerHTML='<i data-lucide="cake-slice" style="width:20px;height:20px"></i><span class="hidden md:inline">Birthdays</span>';
    button.addEventListener('click', birthdayView); compare.insertAdjacentElement('afterend', button);
    window.lucide && window.lucide.createIcons();
  }

  function decorateCompare() {
    var input = document.getElementById('compare-search'); if (!input || input.dataset.upStyled) return;
    input.dataset.upStyled = 'true'; input.placeholder = 'Search people to add…'; input.classList.add('up-compare-search');
    var card = input.closest('.card'); if (card) { card.classList.add('up-compare-card'); var label = card.querySelector('label'); if (label) label.innerHTML = 'Choose your people <span class="up-compare-subtitle">Search, select, then compare schedules.</span>'; if (!card.querySelector('.up-compare-banner')) { var banner = document.createElement('div'); banner.className='up-compare-banner'; banner.innerHTML='<span>1</span> Search <b>→</b> <span>2</span> Select people <b>→</b> <span>3</span> Find shared time'; card.insertBefore(banner, input); } }
  }

  function decorateDashboard() {
    var grid = document.querySelector('.u-dashboard-grid'); if (!grid || grid.dataset.upStyled) return;
    grid.dataset.upStyled='true'; grid.classList.add('up-dashboard-grid');
    var head = grid.previousElementSibling; if (head) head.classList.add('up-dashboard-head');
    if (!document.getElementById('up-dashboard-summary')) { var session = window.getSession && window.getSession(); var schedules = session && window.getUserSchedules ? window.getUserSchedules(session.userId) : []; var groups = session && window.getUserGroups ? window.getUserGroups(session.userId) : []; var summary = document.createElement('div'); summary.id='up-dashboard-summary'; summary.className='up-dashboard-summary'; summary.innerHTML='<div><b>' + schedules.length + '</b><span>schedule' + (schedules.length === 1 ? '' : 's') + '</span></div><div><b>' + groups.length + '</b><span>group' + (groups.length === 1 ? '' : 's') + '</span></div><button class="btn-secondary text-xs" type="button">Open birthdays</button>'; summary.querySelector('button').addEventListener('click', birthdayView); head && head.appendChild(summary); }
    var fixes = { 'Compare time':'git-compare', 'Find people':'users', 'My profile':'user' }; grid.querySelectorAll('.u-dashboard-card').forEach(function (card) { var heading = card.querySelector('h2'); var icon = card.querySelector('.u-card-icon'); if (heading && icon && fixes[heading.textContent.trim()] && !icon.querySelector('svg')) icon.innerHTML='<i data-lucide="' + fixes[heading.textContent.trim()] + '" style="width:21px;height:21px"></i>'; }); window.lucide && window.lucide.createIcons();
  }

  function install() {
    var style = document.createElement('style');
    style.textContent = '.up-login-hint{margin-top:.55rem;padding:.65rem .75rem;border-radius:.65rem;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.28);color:#fde68a;font-size:.82rem}.up-page-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}.up-kicker{font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fb7185}.up-page-head h1{font-size:clamp(1.75rem,4vw,2.45rem);font-weight:800;color:#f8fafc}.up-page-head p:not(.up-kicker){color:#94a3b8;margin-top:.3rem}.up-loading{padding:2rem;color:#94a3b8}.up-birthday-page{max-width:1100px;margin:auto}.up-birthday-controls,.up-birthday-filters{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap;margin-top:1.25rem;padding:.8rem}.up-birthday-controls input{flex:1 1 210px}.up-birthday-months,.up-birthday-chips{display:flex;gap:.35rem;flex-wrap:wrap;width:100%}.up-birthday-filters{display:grid;gap:1rem}.up-birthday-filters strong{display:block;color:#e2e8f0;font-size:.76rem;margin-bottom:.4rem}.up-birthday-filters span{font-size:.78rem;color:#64748b}.up-birthday-chip{padding:.28rem .55rem;border-radius:999px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.7);color:#cbd5e1;font-size:.72rem}.up-birthday-chip.active{border-color:#fb7185;background:rgba(244,63,94,.16);color:#fff}.up-birthday-page #up-birthday-body{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:1rem;margin-top:1.5rem}.up-month{padding:1rem}.up-month-now{border-color:rgba(251,113,133,.48)!important;box-shadow:0 12px 30px rgba(251,113,133,.08)}.up-month h2{font-weight:800;color:#f8fafc;margin-bottom:.7rem}.up-birthday-list{display:grid;gap:.45rem}.up-birthday-person{display:flex;align-items:center;gap:.6rem;padding:.45rem;border-radius:.6rem;background:rgba(148,163,184,.06);color:#e2e8f0}.up-birthday-person b,.up-birthday-person small{display:block}.up-birthday-person small{font-size:.72rem;color:#94a3b8}.up-date{width:2rem;text-align:center;font-weight:800;color:#fda4af}.up-avatar{font-size:1.15rem}.up-compare-card{background:linear-gradient(135deg,rgba(30,41,59,.86),rgba(15,23,42,.9))!important;border-color:rgba(251,113,133,.2)!important}.up-compare-subtitle{display:block;font-size:.76rem;font-weight:400;color:#94a3b8;margin-top:.2rem}.up-compare-banner{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;color:#cbd5e1;font-size:.78rem;margin:.65rem 0}.up-compare-banner span{display:inline-grid;place-items:center;width:1.25rem;height:1.25rem;border-radius:99px;background:rgba(251,113,133,.2);color:#fecdd3;font-weight:800}.up-compare-banner b{color:#64748b}.up-compare-search{box-shadow:inset 0 0 0 1px rgba(148,163,184,.12)}.up-dashboard-head{padding:1.25rem;border:1px solid rgba(251,113,133,.2);border-radius:1rem;background:radial-gradient(circle at top right,rgba(251,113,133,.16),transparent 42%),rgba(15,23,42,.76)}.up-dashboard-summary{display:flex;align-items:center;gap:.85rem;flex-wrap:wrap;margin-top:1rem}.up-dashboard-summary div{display:flex;align-items:baseline;gap:.35rem;padding:.45rem .65rem;border-radius:.6rem;background:rgba(255,255,255,.06);color:#cbd5e1;font-size:.75rem}.up-dashboard-summary b{font-size:1.05rem;color:#fff}.up-dashboard-grid .u-dashboard-card{border-color:rgba(148,163,184,.16)!important;background:rgba(15,23,42,.78)!important}.up-dashboard-grid .u-dashboard-card:first-child{background:linear-gradient(145deg,rgba(244,63,94,.18),rgba(15,23,42,.84))!important}@media(max-width:640px){.up-page-head button{width:100%}.up-birthday-page #up-birthday-body{grid-template-columns:1fr}}';
    document.head.appendChild(style);
    setInterval(function () { loginHint(); addCalendarNav(); decorateCompare(); decorateDashboard(); }, 500);
  }
  install();
})();
