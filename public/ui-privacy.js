/* UPlanner privacy controls — isolated from the legacy frontend. */
(function () {
  'use strict';
  var state = { people: [], visibility: null, audience: [] };
  var esc = window.escHtml || function (value) { return String(value || '').replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); };

  function request(url, options) {
    options = options || {};
    options.credentials = 'include';
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Request failed.');
        return data;
      });
    });
  }

  function toast(message, type) { window.toast ? window.toast(message, type) : alert(message); }

  function load() {
    return Promise.all([
      request('/api/profile?action=visibility'),
      request('/api/people')
    ]).then(function (results) {
      state.visibility = results[0].visibility;
      state.audience = results[0].audience_user_ids || [];
      state.people = results[1].people || [];
      return state;
    });
  }

  function peopleForGroup(groupId) {
    var members = window.getGroupMembers ? window.getGroupMembers(groupId) : [];
    var ids = members.map(function (member) { return member.target_user_id; });
    return state.people.filter(function (person) { return ids.indexOf(person.user_id) >= 0; });
  }

  function openVisibility() {
    load().then(function () {
      var modal = document.createElement('div');
      modal.id = 'uplanner-privacy-modal';
      modal.className = 'upv-backdrop';
      document.body.appendChild(modal);
      renderModal(modal);
    }).catch(function (error) { toast(error.message, 'error'); });
  }

  function renderModal(modal) {
    var allowlist = state.visibility && state.visibility.audience_mode === 'allowlist';
    var selected = new Set(state.audience);
    var groups = window.getUserGroups && window.getSession ? window.getUserGroups(window.getSession().userId) : [];
    function list() {
      return state.people.map(function (person) {
        return '<label class="upv-person"><input type="checkbox" data-upv-person="' + esc(person.user_id) + '" ' + (selected.has(person.user_id) ? 'checked' : '') + '><span>' + esc(person.profile_emoji || '😊') + '</span><span><b>' + esc(person.username) + '</b>' + (person.full_name ? '<small>' + esc(person.full_name) + '</small>' : '') + '</span></label>';
      }).join('') || '<p class="upv-empty">No available people to add yet.</p>';
    }
    modal.innerHTML = '<section class="upv-modal card" role="dialog" aria-modal="true" aria-labelledby="upv-title">'
      + '<div class="upv-head"><div><p class="upv-kicker">Privacy</p><h2 id="upv-title">Who can see me?</h2></div><button class="btn-secondary" data-upv-close>Close</button></div>'
      + '<p class="text-gray-300 text-sm mt-2">Choose <b>Only selected people</b> to stay hidden from everyone else. People you block cannot see your schedule.</p>'
      + '<label class="upv-mode"><input type="checkbox" data-upv-mode ' + (allowlist ? 'checked' : '') + '> Only selected people can find me or view my schedule</label>'
      + '<div class="upv-tools"><button class="btn-secondary text-xs" data-upv-select="all">Select all</button><button class="btn-secondary text-xs" data-upv-select="none">Select none</button><button class="btn-secondary text-xs" data-upv-select="saved">Saved people</button>'
      + (groups || []).map(function (group) { return '<button class="btn-secondary text-xs" data-upv-select="group" data-upv-group="' + esc(group.group_id) + '">' + esc(group.name) + '</button>'; }).join('') + '</div>'
      + '<div class="upv-list">' + list() + '</div><p class="upv-status text-sm text-gray-400"></p><div class="upv-foot"><button class="btn-primary" data-upv-save>Save visibility</button></div></section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.closest('[data-upv-close]')) { modal.remove(); return; }
      var select = event.target.closest('[data-upv-select]');
      if (select) {
        var action = select.dataset.upvSelect;
        if (action === 'all') state.people.forEach(function (person) { selected.add(person.user_id); });
        if (action === 'none') selected.clear();
        if (action === 'saved') state.people.filter(function (person) { return person.saved; }).forEach(function (person) { selected.add(person.user_id); });
        if (action === 'group') peopleForGroup(select.dataset.upvGroup).forEach(function (person) { selected.add(person.user_id); });
        modal.querySelectorAll('[data-upv-person]').forEach(function (box) { box.checked = selected.has(box.dataset.upvPerson); });
      }
      if (event.target.closest('[data-upv-save]')) {
        var mode = modal.querySelector('[data-upv-mode]').checked ? 'allowlist' : 'public';
        modal.querySelectorAll('[data-upv-person]').forEach(function (box) { if (box.checked) selected.add(box.dataset.upvPerson); else selected.delete(box.dataset.upvPerson); });
        request('/api/profile', { method: 'PATCH', body: JSON.stringify({ action: 'visibility', visibility: { discoverable: true, show_school_tag: true, show_degree_tag: true, audience_mode: mode, audience_user_ids: Array.from(selected) } }) })
          .then(function () { toast(mode === 'allowlist' ? 'Your selected audience can now see you.' : 'Your profile is visible to everyone.'); modal.remove(); })
          .catch(function (error) { modal.querySelector('.upv-status').textContent = error.message; });
      }
    });
  }

  function addButton() {
    if (document.getElementById('upv-open')) return;
    var heading = document.querySelector('.u-page-heading, #app > div > div');
    if (!heading || !/People|Search/.test(heading.textContent || '')) return;
    var button = document.createElement('button');
    button.id = 'upv-open'; button.className = 'btn-secondary text-xs'; button.textContent = 'Visibility';
    button.addEventListener('click', openVisibility); heading.appendChild(button);
  }

  function addBlockButtons() {
    if (!state.people.length) load().then(addBlockButtons).catch(function () {});
    document.querySelectorAll('.u-person-card').forEach(function (card) {
      if (card.querySelector('[data-upv-block]')) return;
      var title = card.querySelector('h3');
      var person = state.people.find(function (item) { return title && item.username === title.textContent.trim(); });
      var actions = card.querySelector('.u-person-actions');
      if (!person || !actions) return;
      var button = document.createElement('button');
      button.className = 'btn-secondary text-xs'; button.dataset.upvBlock = person.user_id; button.textContent = 'Block';
      button.addEventListener('click', function () {
        if (!confirm('Block ' + person.username + '? They will no longer be able to find you or see your schedule.')) return;
        request('/api/people', { method: 'POST', body: JSON.stringify({ action: 'block', user_ids: [person.user_id] }) })
          .then(function () { card.remove(); toast(person.username + ' has been blocked.'); })
          .catch(function (error) { toast(error.message, 'error'); });
      });
      actions.appendChild(button);
    });
  }

  function install() {
    addButton();
    var style = document.createElement('style');
    style.textContent = '.upv-backdrop{position:fixed;inset:0;z-index:2100;display:grid;place-items:center;padding:1rem;background:rgba(2,6,23,.78);backdrop-filter:blur(7px)}.upv-modal{width:min(660px,100%);max-height:90vh;overflow:auto;padding:1.25rem}.upv-head{display:flex;justify-content:space-between;gap:1rem;align-items:start}.upv-head h2{font-size:1.35rem;font-weight:800;color:#f8fafc}.upv-kicker{color:#fb7185;font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.upv-mode{display:flex;gap:.55rem;align-items:flex-start;margin:1rem 0;padding:.8rem;border:1px solid rgba(251,113,133,.25);border-radius:.75rem;color:#e2e8f0;font-size:.9rem}.upv-tools{display:flex;gap:.45rem;flex-wrap:wrap;margin:.8rem 0}.upv-list{display:grid;gap:.4rem;max-height:300px;overflow:auto;border:1px solid rgba(148,163,184,.18);border-radius:.75rem;padding:.55rem}.upv-person{display:flex;gap:.65rem;align-items:center;padding:.55rem;border-radius:.55rem;color:#e2e8f0}.upv-person:hover{background:rgba(148,163,184,.08)}.upv-person b,.upv-person small{display:block}.upv-person small{color:#94a3b8;font-size:.75rem}.upv-empty{padding:.8rem;color:#94a3b8}.upv-foot{display:flex;justify-content:flex-end;margin-top:1rem}@media(max-width:520px){.upv-modal{padding:1rem}.upv-foot .btn-primary{width:100%}}';
    document.head.appendChild(style);
    setInterval(function () { addButton(); addBlockButtons(); }, 700);
  }
  install();
})();
