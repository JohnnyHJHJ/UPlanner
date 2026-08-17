(function () {
  'use strict';

  const originalPeopleView = window.peopleView;
  const originalGroupsView = window.groupsView;
  const originalCompareView = window.compareView;
  const originalOwnSchedule = window.ownSchedule;
  const originalShowView = window.showView;

  let peopleCache = [];
  let peopleLoaded = false;
  let peopleLoading = false;
  let peopleSavedOnly = false;
  let peopleQuery = '';
  let groupModalUser = null;

  const escH = window.escHtml || (v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const escA = window.esc || escH;
  const session = () => window.getSession ? window.getSession() : null;
  const toastSafe = (m, t) => window.toast ? window.toast(m, t) : alert(m);

  function apiJson(url, options = {}) {
    return fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options })
      .then(async r => { const text = await r.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch {} if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`); return data; });
  }

  async function loadPeople(force = false) {
    if (peopleLoading) return;
    if (peopleLoaded && !force) return renderPeopleResults();
    peopleLoading = true;
    const root = document.getElementById('unified-people-results');
    if (root) root.innerHTML = '<div class="loading-overlay"><span class="spinner"></span><span>Loading people…</span></div>';
    try {
      const data = await apiJson('/api/people', { headers: { Accept: 'application/json' } });
      peopleCache = Array.isArray(data.people) ? data.people : [];
      peopleLoaded = true;
      renderPeopleResults();
    } catch (e) {
      if (root) root.innerHTML = `<div class="card p-6 text-center"><p class="text-red-300 font-medium">Could not load people.</p><p class="text-gray-400 text-sm mt-1">${escH(e.message)}</p><button class="btn-primary mt-4" onclick="window.__uLoadPeople(true)">Retry</button></div>`;
    } finally { peopleLoading = false; }
  }

  function filteredPeople() {
    const q = peopleQuery.trim().toLowerCase();
    return peopleCache.filter(p => {
      if (peopleSavedOnly && !p.saved) return false;
      if (!q) return true;
      return [p.username, p.full_name, p.school, p.degree_program, p.year_level, p.section, ...(p.school_tags || []).map(x => x.display_name), ...(p.degree_tags || []).map(x => x.display_name)]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }

  function tag(text) { return text ? `<span class="u-person-tag">#${escH(text)}</span>` : ''; }
  function dateText(v) {
    if (!v) return 'Birthday not provided';
    const d = new Date(`${v}T00:00:00`);
    return Number.isNaN(d.getTime()) ? escH(v) : d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  }

  function renderPeopleResults() {
    const root = document.getElementById('unified-people-results');
    if (!root) return;
    const list = filteredPeople();
    if (!list.length) {
      root.innerHTML = `<div class="card p-8 text-center"><div class="text-3xl mb-2">⌕</div><p class="font-semibold text-gray-100">${peopleSavedOnly ? 'No saved people yet' : 'No people found'}</p><p class="text-gray-400 text-sm mt-1">${peopleSavedOnly ? 'Save someone from the directory and they will appear here.' : 'Try another name, school, or degree.'}</p></div>`;
      return;
    }
    root.innerHTML = `<div class="u-people-grid">${list.map(personCard).join('')}</div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function personCard(p) {
    const schoolTags = (p.school_tags || []).map(x => `<span class="u-meta-tag">${escH(x.display_name)}</span>`).join('');
    const degreeTags = (p.degree_tags || []).map(x => `<span class="u-meta-tag">${escH(x.display_name)}</span>`).join('');
    const saved = !!p.saved;
    const age = p.age == null ? '' : `${p.age} years old`;
    const identity = p.full_name ? `<div class="text-sm text-gray-300">${escH(p.full_name)}</div>` : '';
    return `<article class="card u-person-card">
      <div class="u-person-head"><div class="u-avatar" style="background:${escA(p.profile_color || '#fca5a5')}">${escH(p.profile_emoji || '😊')}</div><div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><h3 class="font-bold text-gray-50 truncate">${escH(p.username)}</h3>${tag(p.username)}${saved ? '<span class="u-saved-badge">Saved</span>' : ''}</div>${identity}</div></div>
      <div class="u-person-info">
        <div><span class="u-label">Birthday</span><span>${dateText(p.birthday)}</span></div>
        <div><span class="u-label">Age</span><span>${age || 'Not provided'}</span></div>
        ${schoolTags ? `<div><span class="u-label">School</span><div class="u-tag-row">${schoolTags}</div></div>` : ''}
        ${degreeTags ? `<div><span class="u-label">Degree</span><div class="u-tag-row">${degreeTags}</div></div>` : ''}
        ${(p.year_level || p.section) ? `<div><span class="u-label">Year / Section</span><span>${escH([p.year_level,p.section].filter(Boolean).join(' · '))}</span></div>` : ''}
      </div>
      <div class="u-person-actions">
        <button class="btn-primary text-xs" onclick="window.__uProfile('${escA(p.user_id)}')">View Profile</button>
        <button class="btn-secondary text-xs" onclick="window.__uToggleSave('${escA(p.user_id)}',${saved})">${saved ? 'Remove Saved' : 'Save Person'}</button>
        <button class="btn-secondary text-xs" onclick="window.__uGroup('${escA(p.user_id)}')">Add to Group</button>
        <button class="btn-secondary text-xs" onclick="addToCompareFromDir('${escA(p.user_id)}')">Compare</button>
        <button class="btn-secondary text-xs" onclick="toggleHide('${escA(p.user_id)}')">Hide</button>
      </div>
    </article>`;
  }

  function unifiedPeopleView() {
    const s = session(); if (!s) { originalShowView('landing'); return ''; }
    const savedCount = peopleCache.filter(p => p.saved).length;
    const div = document.createElement('div');
    div.innerHTML = `<section>
      <div class="u-page-heading"><div><p class="u-section-kicker">Directory</p><h1 class="text-2xl sm:text-3xl font-bold text-gray-50">People</h1><p class="text-gray-400 mt-1">Search people, see the details they allow you to see, and organize them.</p></div></div>
      <div class="u-people-toolbar card p-3 mt-5">
        <div class="u-search-row"><div class="u-search-wrap"><i data-lucide="search"></i><input id="unified-people-search" class="input-field" value="${escA(peopleQuery)}" placeholder="Search by name, school, degree, or tag…" oninput="window.__uPeopleQuery(this.value)"></div><button class="${peopleSavedOnly ? 'btn-primary' : 'btn-secondary'}" onclick="window.__uSavedOnly()">Saved people <span class="u-count">${savedCount}</span></button></div>
        <div class="flex items-center justify-between gap-2 mt-3"><span class="text-xs text-gray-500">${peopleSavedOnly ? 'Showing only people you saved.' : 'Showing everyone available to you.'}</span><button class="btn-secondary text-xs" onclick="window.__uLoadPeople(true)">Refresh</button></div>
      </div>
      <div id="unified-people-results" class="mt-5"></div>
    </section>`;
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); loadPeople(); }, 0);
    return div;
  }

  async function toggleSave(userId, currentlySaved) {
    try {
      await apiJson('/api/people', { method:'POST', body:JSON.stringify({ action: currentlySaved ? 'remove' : 'save', user_ids:[userId] }) });
      const p = peopleCache.find(x => x.user_id === userId); if (p) p.saved = !currentlySaved;
      toastSafe(currentlySaved ? 'Removed from saved people.' : 'Saved person.');
      renderPeopleResults();
    } catch (e) { toastSafe(e.message, 'error'); }
  }

  function openProfile(userId) { originalShowView('view-profile', { userId }); }

  function openGroupModal(userId) {
    const s = session(); if (!s) return;
    groupModalUser = userId;
    const groups = (window.getUserGroups ? window.getUserGroups(s.userId) : []).filter(Boolean);
    const user = peopleCache.find(p => p.user_id === userId);
    const modal = document.createElement('div'); modal.id = 'u-group-modal'; modal.className='u-modal-backdrop';
    modal.innerHTML = `<div class="u-modal card" role="dialog" aria-modal="true"><div class="flex items-center justify-between gap-3"><div><p class="u-section-kicker">Organize</p><h2 class="text-xl font-bold text-gray-50">Add ${escH(user?.username || 'person')} to a group</h2></div><button class="btn-secondary" onclick="window.__uCloseGroup()">Close</button></div><div class="mt-4 space-y-2">${groups.length ? groups.map(g => `<button class="u-group-option" onclick="window.__uAddGroup('${escA(g.group_id)}')"><span>${escH(g.name)}</span><span>+</span></button>`).join('') : '<p class="text-gray-400 text-sm">You have no groups yet.</p>'}</div><div class="border-t border-gray-700 mt-5 pt-4"><label class="form-label">Create a new group</label><div class="flex gap-2"><input id="u-new-group" class="input-field" placeholder="e.g. Blockmates"><button class="btn-primary" onclick="window.__uCreateGroup()">Create & Add</button></div><p id="u-group-error" class="text-red-300 text-sm mt-2 hidden"></p></div></div>`;
    document.body.appendChild(modal);
  }

  function closeGroupModal() { document.getElementById('u-group-modal')?.remove(); groupModalUser = null; }

  async function addGroup(groupId) {
    const s = session(); if (!s || !groupModalUser) return;
    try {
      const members = window.getGroupMembers ? window.getGroupMembers(groupId) : [];
      if (members.some(m => m.target_user_id === groupModalUser)) { toastSafe('Already in that group.'); closeGroupModal(); return; }
      const rec = window.createGroupMemberRecord(s.userId, groupId, groupModalUser);
      const res = await window.createRecord(rec);
      if (!res?.isOk) throw new Error('Unable to add person to group.');
      toastSafe('Added to group.'); closeGroupModal();
    } catch(e) { toastSafe(e.message, 'error'); }
  }

  async function createGroupAndAdd() {
    const s = session(); const input = document.getElementById('u-new-group'); const err = document.getElementById('u-group-error');
    if (!s || !input) return;
    const name = input.value.trim(); err.classList.add('hidden');
    if (!name) { err.textContent='Enter a group name.'; err.classList.remove('hidden'); return; }
    if ((window.getUserGroups(s.userId)||[]).some(g => g.name.toLowerCase() === name.toLowerCase())) { err.textContent='You already have a group with that name.'; err.classList.remove('hidden'); return; }
    try {
      const groupId = window.genId();
      const gr = await window.createRecord(window.createGroupRecord(s.userId, groupId, name));
      if (!gr?.isOk) throw new Error('Unable to create group.');
      const mr = await window.createRecord(window.createGroupMemberRecord(s.userId, groupId, groupModalUser));
      if (!mr?.isOk) throw new Error('Group created, but person could not be added.');
      toastSafe(`Created ${name} and added ${peopleCache.find(p=>p.user_id===groupModalUser)?.username || 'person'}.`); closeGroupModal();
    } catch(e) { err.textContent=e.message; err.classList.remove('hidden'); }
  }

  function revampedGroupsView() {
    const s = session(); if (!s) { originalShowView('landing'); return ''; }
    const groups = window.getUserGroups(s.userId) || [];
    const div = document.createElement('div');
    div.innerHTML = `<section><div class="u-page-heading"><div><p class="u-section-kicker">Organize</p><h1 class="text-2xl sm:text-3xl font-bold text-gray-50">Groups</h1><p class="text-gray-400 mt-1">Keep people together for quick access and schedule comparison.</p></div><button class="btn-primary" onclick="window.__uQuickGroup()">New Group</button></div><div class="u-groups-grid mt-6">${groups.length ? groups.map(g => { const members=window.getGroupMembers(g.group_id)||[]; const names=members.map(m=>window.findUserById(m.target_user_id)).filter(Boolean).slice(0,4); return `<article class="card u-group-card"><div class="u-group-icon"><i data-lucide="users"></i></div><div class="flex-1"><h2 class="font-bold text-lg text-gray-50">${escH(g.name)}</h2><p class="text-gray-400 text-sm mt-1">${members.length} member${members.length===1?'':'s'}</p><div class="u-group-members mt-3">${names.map(u=>`<span class="u-mini-person">${escH(u.profile_emoji||'😊')} ${escH(u.username)}</span>`).join('') || '<span class="text-gray-500 text-sm">Empty group</span>'}</div></div><div class="u-group-actions"><button class="btn-primary text-xs" onclick="showView('group-detail',{groupId:'${escA(g.group_id)}'})">Open</button><button class="btn-secondary text-xs" onclick="renameGroup('${escA(g.group_id)}')">Rename</button><button class="btn-danger text-xs" onclick="confirmDeleteGroup('${escA(g.group_id)}')">Delete</button></div></article>`; }).join('') : `<div class="card p-8 text-center col-span-full"><div class="text-3xl">👥</div><p class="font-semibold text-gray-100 mt-2">No groups yet</p><p class="text-gray-400 text-sm mt-1">Create one from here or use Add to Group on a person.</p><button class="btn-primary mt-4" onclick="window.__uQuickGroup()">Create your first group</button></div>`}</div></section>`;
    setTimeout(()=>window.lucide?.createIcons(),0); return div;
  }

  async function quickGroup() {
    const s = session(); if (!s) return;
    const name = prompt('Group name'); if (!name?.trim()) return;
    const existing = window.getUserGroups(s.userId) || [];
    if (existing.some(g => g.name.toLowerCase() === name.trim().toLowerCase())) { toastSafe('You already have a group with that name.', 'error'); return; }
    const result = await window.createRecord(window.createGroupRecord(s.userId, window.genId(), name.trim()));
    if (result?.isOk) { toastSafe('Group created.'); originalShowView('groups'); } else toastSafe('Unable to create group.', 'error');
  }

  function revampedCompareView() {
    const original = originalCompareView();
    setTimeout(() => decorateCompare(), 0);
    return original;
  }
  function decorateCompare() {
    document.querySelectorAll('#compare-checklist label, #compare-checklist button, #compare-checklist div').forEach(el => {
      const txt = el.textContent || ''; if (!txt.trim() || el.dataset.uTagDone) return;
      const match = peopleCache.find(p => txt.includes(p.username));
      if (match && !txt.includes('#')) { el.dataset.uTagDone='1'; const span=document.createElement('span'); span.className='u-person-tag ml-2'; span.textContent='#'+match.username; el.appendChild(span); }
    });
  }

  // Keep the existing schedule implementation intact; it already owns schedule
  // editing and persistence. We only rename the navigation item.
  window.peopleView = unifiedPeopleView;
  window.searchView = unifiedPeopleView;
  window.groupsView = revampedGroupsView;
  window.compareView = revampedCompareView;
  window.ownSchedule = originalOwnSchedule;

  window.__uLoadPeople = loadPeople;
  window.__uPeopleQuery = v => { peopleQuery=v; renderPeopleResults(); };
  window.__uSavedOnly = () => { peopleSavedOnly=!peopleSavedOnly; renderPeopleResults(); };
  window.__uToggleSave = toggleSave;
  window.__uProfile = openProfile;
  window.__uGroup = openGroupModal;
  window.__uCloseGroup = closeGroupModal;
  window.__uAddGroup = addGroup;
  window.__uCreateGroup = createGroupAndAdd;
  window.__uQuickGroup = quickGroup;

  window.showView = function(name, params) {
    if (name === 'search') name = 'people';
    return originalShowView(name, params);
  };

  function navLabels() {
    document.querySelectorAll('[data-nav="search"]').forEach(el => el.remove());
    document.querySelectorAll('[data-nav="people"]').forEach(el => { el.dataset.nav='people'; el.innerHTML='<i data-lucide="users" aria-hidden="true"></i><span>People & Search</span>'; });
    document.querySelectorAll('[data-nav="own-schedule"] span').forEach(el => { el.textContent='My Schedule'; });
    window.lucide?.createIcons();
  }
  navLabels();
  window.addEventListener('load', navLabels);

  const style = document.createElement('style');
  style.textContent = `.u-section-kicker{font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fb7185}.u-page-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}.u-people-toolbar{background:rgba(15,23,42,.78)!important;backdrop-filter:blur(16px)}.u-search-row{display:flex;gap:.65rem;align-items:center}.u-search-wrap{position:relative;flex:1}.u-search-wrap svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;color:#64748b}.u-search-wrap input{padding-left:42px}.u-count{display:inline-flex;min-width:20px;height:20px;align-items:center;justify-content:center;border-radius:99px;background:rgba(255,255,255,.1);font-size:.7rem;margin-left:5px}.u-people-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1rem}.u-person-card{padding:1rem;display:flex;flex-direction:column;gap:.9rem;background:rgba(16,23,34,.86)!important}.u-person-head{display:flex;align-items:center;gap:.75rem}.u-avatar{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:1.35rem;flex:none}.u-person-tag,.u-meta-tag,.u-saved-badge{display:inline-flex;align-items:center;border-radius:999px;font-size:.7rem;font-weight:700;padding:.2rem .5rem}.u-person-tag{color:#fecdd3;background:rgba(244,63,94,.12);border:1px solid rgba(251,113,133,.18)}.u-meta-tag{color:#cbd5e1;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.12)}.u-saved-badge{color:#bbf7d0;background:rgba(34,197,94,.1);border:1px solid rgba(74,222,128,.15)}.u-person-info{display:grid;gap:.55rem;font-size:.82rem;color:#cbd5e1}.u-person-info>div{display:flex;gap:.5rem;align-items:flex-start;justify-content:space-between}.u-label{color:#64748b;font-size:.7rem;text-transform:uppercase;font-weight:800;letter-spacing:.06em;min-width:75px}.u-tag-row{display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end}.u-person-actions{display:flex;gap:.4rem;flex-wrap:wrap;padding-top:.2rem;border-top:1px solid rgba(148,163,184,.1)}.u-modal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(8px);z-index:1000;display:grid;place-items:center;padding:1rem}.u-modal{width:min(560px,100%);padding:1.25rem;max-height:90vh;overflow:auto}.u-group-option{width:100%;display:flex;justify-content:space-between;align-items:center;padding:.8rem 1rem;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.72);color:#e2e8f0;border-radius:12px;cursor:pointer}.u-group-option:hover{border-color:rgba(251,113,133,.35);background:rgba(244,63,94,.08)}.u-groups-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.u-group-card{padding:1.1rem;display:flex;gap:.9rem;align-items:flex-start;background:rgba(16,23,34,.86)!important}.u-group-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:rgba(244,63,94,.12);color:#fda4af;flex:none}.u-group-members{display:flex;gap:.35rem;flex-wrap:wrap}.u-mini-person{font-size:.72rem;padding:.25rem .5rem;border-radius:999px;background:rgba(148,163,184,.08);color:#cbd5e1}.u-group-actions{display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end}.u-person-card button,.u-group-card button{min-height:36px}@media(max-width:640px){.u-search-row{flex-direction:column;align-items:stretch}.u-search-row>button{width:100%}.u-person-info>div{flex-direction:column;gap:.15rem}.u-tag-row{justify-content:flex-start}.u-person-actions button{flex:1 1 auto}.u-group-card{flex-direction:column}.u-group-actions{width:100%;justify-content:flex-start}}`;
  document.head.appendChild(style);
})();
