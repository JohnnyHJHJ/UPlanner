/* UPlanner schedule statistics enhancement. */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function formatTime(value) {
    if (!value) return '—';
    var parts = String(value).split(':');
    var hour = Number(parts[0]);
    var minute = Number(parts[1] || 0);
    if (!Number.isFinite(hour)) return esc(value);
    var suffix = hour >= 12 ? 'PM' : 'AM';
    var displayHour = hour % 12 || 12;
    return displayHour + ':' + String(minute).padStart(2, '0') + ' ' + suffix;
  }

  function render(stats) {
    var grid = document.querySelector('.u-dashboard-grid');
    if (!grid) return false;
    var card = document.getElementById('up-schedule-stats');
    if (!card) {
      card = document.createElement('article');
      card.id = 'up-schedule-stats';
      card.className = 'card u-dashboard-card up-schedule-stats';
      grid.appendChild(card);
    }

    var busiest = stats.busiest_day;
    card.innerHTML = '<div class="u-card-icon">📊</div>' +
      '<div class="flex-1"><div class="flex items-start justify-between gap-3"><div>' +
      '<p class="text-xs font-bold uppercase tracking-wider text-gray-500">Your schedule</p>' +
      '<h2 class="text-lg font-bold text-gray-50 mt-1">Schedule statistics</h2>' +
      '</div><span class="text-xs text-gray-500">' + esc(stats.schedules) + ' schedule' + (stats.schedules === 1 ? '' : 's') + '</span></div>' +
      '<div class="up-schedule-stat-grid mt-4">' +
      '<div><b>' + esc(stats.class_count) + '</b><span>classes</span></div>' +
      '<div><b>' + esc(stats.subject_count) + '</b><span>subjects</span></div>' +
      '<div><b>' + esc(Number(stats.class_hours || 0).toFixed(1)) + '</b><span>class hours</span></div>' +
      '<div><b>' + esc(stats.class_days) + '</b><span>days</span></div>' +
      '</div>' +
      '<div class="up-schedule-stat-details mt-4">' +
      '<span>Earliest <b>' + formatTime(stats.earliest_start) + '</b></span>' +
      '<span>Latest <b>' + formatTime(stats.latest_end) + '</b></span>' +
      (busiest ? '<span>Busiest <b>' + esc(busiest.day) + '</b></span>' : '') +
      '</div></div>';
    return true;
  }

  function load() {
    if (!document.querySelector('.u-dashboard-grid')) return;
    fetch('/api/schedules?action=stats', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || 'Unable to load schedule statistics.');
          return data;
        });
      })
      .then(function (data) { render(data.stats || {}); })
      .catch(function () {});
  }

  var style = document.createElement('style');
  style.textContent = '.up-schedule-stats{display:flex;gap:1rem;align-items:flex-start}.up-schedule-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem}.up-schedule-stat-grid>div{padding:.65rem .55rem;border:1px solid rgba(148,163,184,.12);border-radius:.7rem;background:rgba(148,163,184,.045)}.up-schedule-stat-grid b,.up-schedule-stat-grid span{display:block}.up-schedule-stat-grid b{font-size:1.05rem;color:#f8fafc}.up-schedule-stat-grid span{font-size:.65rem;color:#64748b;margin-top:.1rem}.up-schedule-stat-details{display:flex;flex-wrap:wrap;gap:.8rem;font-size:.72rem;color:#64748b}.up-schedule-stat-details b{color:#cbd5e1}@media(max-width:640px){.up-schedule-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(style);

  var lastPath = '';
  function install() {
    var path = location.pathname + location.hash;
    if (path === lastPath && document.getElementById('up-schedule-stats')) return;
    lastPath = path;
    setTimeout(load, 100);
  }

  install();
  new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
})();
