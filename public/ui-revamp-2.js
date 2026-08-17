(function () {
  'use strict';

  const esc = window.escHtml || (v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])));
  let people = [];
  let peoplePromise = null;

  function apiPeople() {
    if (peoplePromise) return peoplePromise;
    peoplePromise = fetch('/api/people', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('People request failed')))
      .then(data => { people = Array.isArray(data.people) ? data.people : []; return people; })
      .catch(() => { people = []; return people; });
    return peoplePromise;
  }

  function addTagToElement(el, username) {
    if (!el || !username || el.querySelector('.u-person-tag')) return;
    const tag = document.createElement('span');
    tag.className = 'u-person-tag u-compare-tag';
    tag.textContent = '#' + username;
    el.appendChild(tag);
  }

  function decorateCompareTags() {
    const root = document.querySelector('[data-view="compare"], #view-compare, .compare-view');
    if (!root) return;
    const candidates = root.querySelectorAll('button, label, .card, [role="option"]');
    candidates.forEach(el => {
      if (el.dataset.uCompareTagged === '1') return;
      const text = (el.textContent || '').trim();
      if (!text) return;
      const match = people.find(p => p.username && text.includes(p.username));
      if (match) {
        el.dataset.uCompareTagged = '1';
        addTagToElement(el, match.username);
      }
    });
  }

  function installCompareObserver() {
    apiPeople().then(decorateCompareTags);
    const observer = new MutationObserver(() => decorateCompareTags());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 120000);
  }

  function addScheduleEditButton(root) {
    if (!root || root.querySelector('.u-my-schedule-edit')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-secondary u-my-schedule-edit';
    button.innerHTML = '✎ Edit Schedule';
    button.addEventListener('click', () => {
      if (typeof window.showView === 'function') {
        window.showView('schedule');
      }
    });

    const heading = root.querySelector('h1, h2, h3');
    if (heading && heading.parentElement) {
      const wrap = heading.parentElement;
      wrap.classList.add('u-schedule-heading-row');
      wrap.appendChild(button);
    } else {
      root.insertBefore(button, root.firstChild);
    }
  }

  function installScheduleWrapper() {
    if (typeof window.ownSchedule !== 'function' || window.__uScheduleWrapped) return;
    const original = window.ownSchedule;
    window.ownSchedule = function () {
      const result = original.apply(this, arguments);
      try {
        if (result && result.nodeType) setTimeout(() => addScheduleEditButton(result), 0);
        else setTimeout(() => {
          const root = document.querySelector('#view-own-schedule, [data-view="own-schedule"], main');
          if (root) addScheduleEditButton(root);
        }, 0);
      } catch (_) {}
      return result;
    };
    window.__uScheduleWrapped = true;
  }

  function installNavigationFallback() {
    document.querySelectorAll('[data-nav="search"]').forEach(el => el.remove());
    document.querySelectorAll('[data-nav="people"]').forEach(el => {
      el.dataset.nav = 'people';
      if (!el.querySelector('span')) el.textContent = 'People & Search';
      else el.querySelector('span').textContent = 'People & Search';
    });
    document.querySelectorAll('[data-nav="own-schedule"] span').forEach(el => { el.textContent = 'My Schedule'; });
  }

  function init() {
    installNavigationFallback();
    installScheduleWrapper();
    installCompareObserver();
    window.lucide?.createIcons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.addEventListener('load', init, { once: true });
})();
