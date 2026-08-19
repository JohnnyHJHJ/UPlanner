/* UPlanner identity enhancement: distinguish display names from login names. */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function decorate() {
    document.querySelectorAll('.u-person-card').forEach(function (card) {
      if (card.dataset.upIdentity) return;
      var heading = card.querySelector('.u-person-head h3');
      if (!heading) return;

      var fullName = '';
      var identity = heading.parentElement && heading.parentElement.parentElement
        ? heading.parentElement.parentElement.querySelector('.text-sm.text-gray-300')
        : null;
      if (identity) fullName = identity.textContent.trim();

      var login = heading.textContent.trim();
      if (!login) return;

      heading.textContent = fullName || login;
      heading.classList.remove('truncate');
      heading.title = fullName || login;

      var loginLine = document.createElement('div');
      loginLine.className = 'up-person-login';
      loginLine.textContent = '@' + login;
      heading.parentElement.appendChild(loginLine);

      if (identity) identity.remove();
      card.dataset.upIdentity = 'true';
    });
  }

  var style = document.createElement('style');
  style.textContent = '.up-person-login{font-size:.72rem;color:#64748b;line-height:1.2;margin-top:.12rem}.u-person-head h3{overflow:visible;text-overflow:clip}';
  document.head.appendChild(style);

  decorate();
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
})();
