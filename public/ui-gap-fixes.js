/* UPlanner gap fixes
 * Isolated UI layer: restores People filters, condensed mode, schedule timetable,
 * and a sign-in tutorial without replacing the legacy frontend.
 */
(function () {
  'use strict';

  var people = [];
  var peopleLoaded = false;
  var peopleLoading = false;
  var peopleQuery = '';
  var savedOnly = false;
  var condensed = localStorage.getItem('uplanner_people_density') === 'condensed';
  var selectedSchools = [];
  var selectedDegrees = [];
  var selectedGroups = [];
  var filtersExpanded = false;
  var lastSessionUser = null;
  var tourShownFor = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function api(url, options) {
    options = options || {};
    options.credentials = 'include';
    options.headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, options.headers || {});
    return fetch(url, options).then(function (response) {
      return response.text().then(function (body) {
        var data = {};
        try { data = body ? JSON.parse(body) : {}; } catch (_) {}
        if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ')');
        return data;
      });
    });
  }

  function dateText(value) {
    if (!value) return 'Not provided';
    var raw = String(value);
    var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var date = match
      ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
      : new Date(raw);
    if (Number.isNaN(date.getTime())) return esc(raw);
    return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function tags(person, key) {
    return (person[key] || []).map(function (tag) { return tag.display_name || tag.canonical_name || ''; }).filter(Boolean);
  }

  function allTags(key) {
    var seen = {};
    people.forEach(function (person) {
      (person[key] || []).forEach(function (tag) { seen[String(tag.id)] = tag; });
    });
    return Object.keys(seen).map(function (id) { return seen[id]; }).sort(function (a, b) {
      return String(a.display_name).localeCompare(String(b.display_name));
    });
  }

  function matchesOne(personTags, selected) {
    if (!selected.length) return true;
    var ids = personTags.map(function (tag) { return String(tag.id); });
    return selected.some(function (id) { return ids.indexOf(String(id)) !== -1; });
  }

  function filteredPeople() {
    var query = peopleQuery.trim().toLowerCase();
    return people.filter(function (person) {
      if (savedOnly && !person.saved) return false;
      if (!matchesOne(person.school_tags || [], selectedSchools)) return false;
      if (!matchesOne(person.degree_tags || [], selectedDegrees)) return false;
      if (selectedGroups.length && !selectedGroups.some(function (groupId) { return (window.getGroupMembers ? window.getGroupMembers(groupId) : []).some(function (member) { return member.target_user_id === person.user_id; }); })) return false;
      if (!query) return true;
      var values = [
        person.username, '#' + (person.username || ''), person.full_name,
        person.year_level, person.section
      ].concat(tags(person, 'school_tags'), tags(person, 'degree_tags'));
      return values.some(function (value) { return String(value || '').toLowerCase().indexOf(query) !== -1; });
    });
  }

  function chip(tag, type, selected) {
    return '<button type="button" class="ugap-chip' + (selected ? ' active' : '') + '" data-ugap-filter="' + type + '" data-tag-id="' + esc(tag.id) + '" aria-pressed="' + selected + '">' + esc(tag.display_name) + (selected ? ' <span aria-hidden="true">✓</span>' : '') + '</button>';
  }

  function personCard(person) {
    var school = tags(person, 'school_tags').map(function (name) { return '<span class="ugap-tag">' + esc(name) + '</span>'; }).join('');
    var degree = tags(person, 'degree_tags').map(function (name) { return '<span class="ugap-tag">' + esc(name) + '</span>'; }).join('');
    var saved = person.saved ? '<span class="ugap-saved">Saved</span>' : '';
    var details = condensed ? '' :
      '<div class="ugap-details">' +
        '<div><span>Birthday</span><b>' + dateText(person.birthday) + '</b></div>' +
        '<div><span>Age</span><b>' + (person.age == null ? 'Not provided' : esc(person.age + ' years old')) + '</b></div>' +
        (school ? '<div><span>School</span><b class="ugap-tags">' + school + '</b></div>' : '') +
        (degree ? '<div><span>Degree</span><b class="ugap-tags">' + degree + '</b></div>' : '') +
        ((person.year_level || person.section) ? '<div><span>Year / Section</span><b>' + esc([person.year_level, person.section].filter(Boolean).join(' · ')) + '</b></div>' : '') +
      '</div>';
    return '<article class="card ugap-person-card' + (condensed ? ' condensed' : '') + '">' +
      '<div class="ugap-person-top"><div class="ugap-avatar" style="background:' + esc(person.profile_color || '#fca5a5') + '">' + esc(person.profile_emoji || '😊') + '</div>' +
      '<div><h3>' + esc(person.username || 'Unknown') + ' <small>#' + esc(person.username || '') + '</small> ' + saved + '</h3>' +
      (person.full_name ? '<p>' + esc(person.full_name) + '</p>' : '') +
      (condensed ? '<div class="ugap-tags">' + school + degree + '</div>' : '') + '</div></div>' + details +
      '<div class="ugap-actions">' +
      '<button type="button" class="btn-primary" data-ugap-action="profile" data-person-id="' + esc(person.user_id) + '">View Profile</button>' +
      '<button type="button" class="btn-secondary" data-ugap-action="save" data-person-id="' + esc(person.user_id) + '">' + (person.saved ? 'Remove Saved' : 'Save Person') + '</button>' +
      '<button type="button" class="btn-secondary" data-ugap-action="compare" data-person-id="' + esc(person.user_id) + '">Compare</button>' +
      (condensed ? '' : '<button type="button" class="btn-secondary" data-ugap-action="group" data-person-id="' + esc(person.user_id) + '">Add to Group</button><button type="button" class="btn-secondary" data-ugap-action="hide" data-person-id="' + esc(person.user_id) + '">Hide</button>') +
      '</div></article>';
  }

  function renderPeopleResults() {
    var root = document.getElementById('ugap-people-results');
    if (!root) return;
    var list = filteredPeople();
    root.innerHTML = list.length
      ? '<div class="ugap-grid">' + list.map(personCard).join('') + '</div>'
      : '<div class="card p-8 text-center"><p class="font-semibold text-gray-100">' + (savedOnly ? 'No saved people match these filters.' : 'No people found.') + '</p><p class="text-gray-400 text-sm mt-1">Try changing your search or filters.</p></div>';
  }

  function renderPeopleView() {
    var session = window.getSession && window.getSession();
    if (!session) { window.showView('landing'); return ''; }
    var schoolTags = allTags('school_tags');
    var degreeTags = allTags('degree_tags');
    var selectedCount = selectedSchools.length + selectedDegrees.length + selectedGroups.length;
    var groups = window.getUserGroups ? window.getUserGroups(session.userId) : [];
    var div = document.createElement('div');
    div.innerHTML = '<section class="ugap-page">' +
      '<div class="ugap-heading"><div><p class="ugap-kicker">Directory</p><h1>People &amp; Search</h1><p>Find people by name, tag, visible school or degree, year, and section.</p></div>' +
      '<button type="button" class="btn-secondary" data-ugap-action="density">' + (condensed ? 'Expanded View' : 'Condensed View') + '</button></div>' +
      '<div class="card ugap-toolbar"><input id="ugap-people-query" class="input-field" value="' + esc(peopleQuery) + '" placeholder="Search by name, #tag, school, degree, year, or section" />' +
      '<button type="button" class="' + (savedOnly ? 'btn-primary' : 'btn-secondary') + '" data-ugap-action="saved">Saved People <span class="ugap-count">' + people.filter(function (p) { return p.saved; }).length + '</span></button>' +
      '<button type="button" class="btn-secondary" data-ugap-action="clear">Clear filters' + (selectedCount ? ' (' + selectedCount + ')' : '') + '</button></div>' +
      '<div class="card ugap-filter-panel"><button type="button" class="ugap-filter-toggle" data-ugap-action="toggle-filters" aria-expanded="' + filtersExpanded + '"><span>Filters' + (selectedCount ? ' (' + selectedCount + ')' : '') + '</span><span aria-hidden="true">' + (filtersExpanded ? '−' : '+') + '</span></button><div class="ugap-filter-body' + (filtersExpanded ? '' : ' hidden') + '"><div><strong>School</strong><div class="ugap-chips">' + (schoolTags.length ? schoolTags.map(function (tag) { return chip(tag, 'school', selectedSchools.indexOf(String(tag.id)) !== -1); }).join('') : '<span>No visible school tags available.</span>') + '</div></div>' +
      '<div><strong>Degree / course</strong><div class="ugap-chips">' + (degreeTags.length ? degreeTags.map(function (tag) { return chip(tag, 'degree', selectedDegrees.indexOf(String(tag.id)) !== -1); }).join('') : '<span>No visible degree tags available.</span>') + '</div></div>' +
      '<div><strong>My groups</strong><div class="ugap-chips">' + (groups.length ? groups.map(function (group) { return chip({ id: group.group_id, display_name: group.name }, 'group', selectedGroups.indexOf(String(group.group_id)) !== -1); }).join('') : '<span>No groups yet.</span>') + '</div></div></div></div>' +
      '<div id="ugap-people-results" class="mt-5"></div></section>';
    setTimeout(function () { renderPeopleResults(); }, 0);
    return div;
  }

  function loadPeople(force) {
    if (peopleLoading || (peopleLoaded && !force)) return Promise.resolve(people);
    peopleLoading = true;
    return api('/api/people').then(function (data) {
      people = Array.isArray(data.people) ? data.people : [];
      peopleLoaded = true;
      return people;
    }).catch(function (error) {
      if (window.toast) window.toast(error.message || 'Could not load people.', 'error');
      throw error;
    }).finally(function () { peopleLoading = false; });
  }

  function toggleSelected(list, id) {
    id = String(id);
    var at = list.indexOf(id);
    if (at === -1) list.push(id); else list.splice(at, 1);
  }

  function savePerson(userId) {
    var person = people.find(function (candidate) { return candidate.user_id === userId; });
    if (!person) return;
    api('/api/people', { method: 'POST', body: JSON.stringify({ action: person.saved ? 'remove' : 'save', user_ids: [userId] }) })
      .then(function () {
        person.saved = !person.saved;
        if (window.toast) window.toast(person.saved ? 'Saved person.' : 'Removed from saved people.', 'success');
        window.showView('people');
      }).catch(function (error) { if (window.toast) window.toast(error.message, 'error'); });
  }

  function handlePeopleEvent(event) {
    var button = event.target.closest('[data-ugap-action]');
    if (button) {
      var action = button.dataset.ugapAction;
      var userId = button.dataset.personId;
      if (action === 'saved') { savedOnly = !savedOnly; window.showView('people'); }
      if (action === 'clear') { selectedSchools = []; selectedDegrees = []; selectedGroups = []; peopleQuery = ''; savedOnly = false; window.showView('people'); }
      if (action === 'toggle-filters') { filtersExpanded = !filtersExpanded; window.showView('people'); }
      if (action === 'density') { condensed = !condensed; localStorage.setItem('uplanner_people_density', condensed ? 'condensed' : 'expanded'); window.showView('people'); }
      if (action === 'profile') window.showView('view-profile', { userId: userId });
      if (action === 'save') savePerson(userId);
      if (action === 'group' && window.__uGroup) window.__uGroup(userId);
      if (action === 'compare' && window.addToCompareFromDir) window.addToCompareFromDir(userId);
      if (action === 'hide' && window.toggleHide) window.toggleHide(userId);
      if (action === 'schedule-edit') window.showView('edit-schedule', { scheduleId: button.dataset.scheduleId });
    }
    var filter = event.target.closest('[data-ugap-filter]');
    if (filter) {
      toggleSelected(filter.dataset.ugapFilter === 'school' ? selectedSchools : filter.dataset.ugapFilter === 'degree' ? selectedDegrees : selectedGroups, filter.dataset.tagId);
      window.showView('people');
    }
  }

  document.addEventListener('click', handlePeopleEvent);
  document.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'ugap-people-query') {
      peopleQuery = event.target.value || '';
      renderPeopleResults();
    }
  });

  function timeToMinutes(value) {
    var parts = String(value || '').slice(0, 5).split(':');
    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
  }

  function timetableView() {
    var session = window.getSession && window.getSession();
    if (!session || !window.getUserSchedules || !window.getScheduleEntries) return null;
    var schedules = window.getUserSchedules(session.userId) || [];
    var schedule = schedules.find(function (item) { return item.name === session.username; }) || schedules[0];
    if (!schedule) return null;
    var entries = window.getScheduleEntries(schedule.schedule_id) || [];
    if (!entries.length) return null;
    var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var start = Math.min.apply(Math, entries.map(function (item) { return timeToMinutes(item.start_time); }).concat([480]));
    var end = Math.max.apply(Math, entries.map(function (item) { return timeToMinutes(item.end_time); }).concat([1080]));
    start = Math.floor(start / 60) * 60;
    end = Math.ceil(end / 60) * 60;
    var hourCount = Math.max(1, (end - start) / 60);
    var labels = [];
    for (var minute = start; minute <= end; minute += 60) labels.push('<div>' + String(Math.floor(minute / 60)).padStart(2, '0') + ':00</div>');
    var blocks = entries.map(function (entry, index) {
      var day = days.indexOf(entry.day);
      if (day < 0) return '';
      var top = ((timeToMinutes(entry.start_time) - start) / 60) * 52;
      var height = Math.max(34, ((timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time)) / 60) * 52 - 4);
      var color = ['#60a5fa','#a78bfa','#34d399','#f472b6','#fbbf24','#fb7185','#22d3ee'][index % 7];
      return '<div class="ugap-class" style="left:calc(' + (day * (100 / 7)) + '% + 3px);width:calc(' + (100 / 7) + '% - 6px);top:' + top + 'px;height:' + height + 'px;background:' + color + '"><strong>' + esc(entry.subject) + '</strong><small>' + esc(String(entry.start_time).slice(0,5) + '–' + String(entry.end_time).slice(0,5)) + '</small></div>';
    }).join('');
    var div = document.createElement('div');
    div.innerHTML = '<section class="ugap-schedule"><div class="ugap-heading"><div><p class="ugap-kicker">My schedule</p><h1>' + esc(schedule.name) + '</h1><p>Your saved classes at a glance.</p></div><button type="button" class="btn-primary" data-ugap-action="schedule-edit" data-schedule-id="' + esc(schedule.schedule_id) + '">Edit Schedule</button></div><div class="card ugap-timetable-wrap"><div class="ugap-timetable"><div class="ugap-day-head"><span>Time</span>' + days.map(function (day) { return '<span>' + day.slice(0,3) + '</span>'; }).join('') + '</div><div class="ugap-times" style="height:' + (hourCount * 52) + 'px">' + labels.join('') + '</div><div class="ugap-grid-lines" style="height:' + (hourCount * 52) + 'px">' + blocks + '</div></div></div></section>';
    return div;
  }

  function showTour() {
    if (document.getElementById('ugap-tour') || document.querySelector('[id^="uplanner-"][id$="-modal"]')) return;
    var modal = document.createElement('div');
    modal.id = 'ugap-tour';
    modal.className = 'ugap-tour-backdrop';
    modal.innerHTML = '<div class="card ugap-tour" role="dialog" aria-modal="true" aria-labelledby="ugap-tour-title"><p class="ugap-kicker">Welcome to UPlanner</p><h2 id="ugap-tour-title">Start with these three steps</h2><ol><li><b>Build your schedule.</b><span>Add your subjects, days, and class times.</span></li><li><b>Find people.</b><span>Search by name or tag and use school and degree filters.</span></li><li><b>Save and organize.</b><span>Save people you want to revisit, then add them to groups.</span></li></ol><div class="ugap-tour-actions"><button type="button" class="btn-secondary" data-ugap-tour="close">Explore first</button><button type="button" class="btn-primary" data-ugap-tour="schedule">Create my schedule</button></div></div>';
    modal.addEventListener('click', function (event) {
      var action = event.target.closest('[data-ugap-tour]');
      if (!action) return;
      modal.remove();
      if (action.dataset.ugapTour === 'schedule') window.showView('own-schedule');
    });
    document.body.appendChild(modal);
  }

  function checkSignInTutorial() {
    var session = window.getSession && window.getSession();
    if (!session) { lastSessionUser = null; tourShownFor = null; return; }
    if (lastSessionUser !== session.userId) { lastSessionUser = session.userId; tourShownFor = null; }
    if (tourShownFor === session.userId) return;
    // Keep required profile setup unobstructed; show the tutorial as soon as
    // the person reaches their dashboard instead of marking it as skipped.
    if (!document.querySelector('.u-dashboard-grid')) return;
    if (document.querySelector('[id^="uplanner-"][id$="-modal"]')) return;
    tourShownFor = session.userId;
    showTour();
  }

  function install() {
    if (!window.__uGapPeopleInstalled) {
      window.__uGapPeopleInstalled = true;
      window.peopleView = function () {
        var refreshAfterLoad = !peopleLoaded;
        var view = renderPeopleView();
        if (refreshAfterLoad) {
          loadPeople().then(function () {
            if (document.getElementById('ugap-people-results')) window.showView('people');
          }).catch(function () {});
        }
        return view;
      };
      window.searchView = window.peopleView;
    }
    if (!window.__uGapScheduleInstalled) {
      window.__uGapScheduleInstalled = true;
      var originalOwnSchedule = window.ownSchedule;
      window.ownSchedule = function () { return timetableView() || originalOwnSchedule.apply(this, arguments); };
    }
    setTimeout(checkSignInTutorial, 600);
  }

  var style = document.createElement('style');
  style.textContent = '.ugap-page,.ugap-schedule{max-width:1200px;margin:auto}.ugap-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}.ugap-heading h1{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:800;color:#f8fafc}.ugap-heading p{color:#94a3b8;margin-top:.25rem}.ugap-kicker{font-size:.72rem!important;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#fb7185}.ugap-toolbar{margin-top:1.25rem;padding:.75rem;display:flex;gap:.6rem;flex-wrap:wrap}.ugap-toolbar input{flex:1 1 360px}.ugap-count{display:inline-flex;min-width:1.25rem;justify-content:center}.ugap-filter-panel{padding:.7rem 1rem;margin-top:1rem}.ugap-filter-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:0;color:#e2e8f0;font-size:.84rem;font-weight:800;cursor:pointer}.ugap-filter-body{display:grid;gap:.85rem;padding-top:.85rem}.ugap-filter-panel strong{display:block;color:#e2e8f0;margin-bottom:.45rem}.ugap-chips{display:flex;gap:.4rem;flex-wrap:wrap}.ugap-chip{border:1px solid rgba(148,163,184,.28);border-radius:999px;padding:.35rem .65rem;background:rgba(15,23,42,.75);color:#cbd5e1;font-size:.78rem;cursor:pointer}.ugap-chip.active{background:rgba(244,63,94,.18);border-color:#fb7185;color:#fff}.ugap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1rem}.ugap-person-card{padding:1rem;display:flex;flex-direction:column;gap:.85rem}.ugap-person-card.condensed{gap:.55rem}.ugap-person-top{display:flex;gap:.75rem;align-items:center}.ugap-avatar{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:1.35rem;flex:none}.ugap-person-top h3{font-weight:800;color:#f8fafc}.ugap-person-top h3 small{font-size:.72rem;color:#fda4af}.ugap-person-top p{font-size:.85rem;color:#cbd5e1}.ugap-saved,.ugap-tag{display:inline-flex;align-items:center;border-radius:999px;padding:.2rem .48rem;font-size:.7rem;font-weight:700}.ugap-saved{background:rgba(34,197,94,.12);color:#bbf7d0}.ugap-tag{background:rgba(148,163,184,.12);color:#cbd5e1}.ugap-details{display:grid;gap:.45rem;font-size:.82rem}.ugap-details>div{display:flex;justify-content:space-between;gap:.75rem}.ugap-details span{color:#94a3b8}.ugap-details b{color:#e2e8f0;text-align:right;font-weight:500}.ugap-tags{display:flex;gap:.3rem;flex-wrap:wrap}.ugap-actions{display:flex;gap:.4rem;flex-wrap:wrap;border-top:1px solid rgba(148,163,184,.13);padding-top:.75rem}.ugap-actions button{font-size:.75rem}.ugap-timetable-wrap{margin-top:1.25rem;overflow:auto;padding:0}.ugap-timetable{min-width:760px;position:relative;padding-left:58px}.ugap-day-head{display:grid;grid-template-columns:repeat(8,1fr);height:42px;align-items:center;text-align:center;border-bottom:1px solid rgba(148,163,184,.2);color:#cbd5e1;font-size:.78rem;font-weight:700}.ugap-day-head span:first-child{margin-left:-58px}.ugap-times{position:absolute;width:58px;left:0;top:42px;display:flex;flex-direction:column;justify-content:space-between;color:#94a3b8;font-size:.68rem;text-align:right;padding-right:8px;box-sizing:border-box}.ugap-grid-lines{position:relative;background:repeating-linear-gradient(to bottom,transparent 0,transparent 51px,rgba(148,163,184,.16) 52px),repeating-linear-gradient(to right,transparent 0,transparent calc(14.285% - 1px),rgba(148,163,184,.13) calc(14.285% - 1px),rgba(148,163,184,.13) 14.285%)}.ugap-class{position:absolute;border-radius:8px;padding:.35rem;box-sizing:border-box;color:#07111f;overflow:hidden;font-size:.72rem;box-shadow:0 2px 8px rgba(0,0,0,.22)}.ugap-class strong,.ugap-class small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ugap-class small{margin-top:.15rem;opacity:.75}.ugap-tour-backdrop{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:1rem;background:rgba(2,6,23,.76);backdrop-filter:blur(5px)}.ugap-tour{width:min(520px,100%);padding:1.4rem}.ugap-tour h2{font-size:1.35rem;font-weight:800;color:#f8fafc;margin:.3rem 0 1rem}.ugap-tour ol{display:grid;gap:.9rem;padding-left:1.25rem;color:#e2e8f0}.ugap-tour li span{display:block;color:#94a3b8;font-size:.9rem;margin-top:.15rem}.ugap-tour-actions{display:flex;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;margin-top:1.3rem}@media(max-width:640px){.ugap-toolbar>*{width:100%}.ugap-details>div{flex-direction:column;gap:.1rem}.ugap-details b{text-align:left}.ugap-actions button{flex:1 1 40%}}';
  document.head.appendChild(style);
  install();
  setInterval(checkSignInTutorial, 700);
})();
