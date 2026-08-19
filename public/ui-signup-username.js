/* UPlanner signup username warning
 * Shows the same-name warning during signup using the backend's actual
 * next available login username. The backend remains authoritative.
 */
(function () {
  'use strict';

  var timer = null;
  var lastValue = '';
  var requestId = 0;

  function findInput() {
    return document.getElementById('su-input');
  }

  function findHint(input) {
    var hint = document.getElementById('up-su-input-hint');
    if (hint) return hint;
    hint = document.createElement('p');
    hint.id = 'up-su-input-hint';
    hint.className = 'up-login-hint hidden';
    input.insertAdjacentElement('afterend', hint);
    return hint;
  }

  function hide(hint) {
    hint.classList.add('hidden');
    hint.textContent = '';
  }

  function check(input) {
    var value = input.value.trim();
    var hint = findHint(input);
    lastValue = value;

    if (!value) {
      hide(hint);
      return;
    }

    var currentRequest = ++requestId;
    fetch('/api/username-check', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: value })
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Username check failed.');
        return data;
      });
    }).then(function (data) {
      if (currentRequest !== requestId || input.value.trim() !== lastValue) return;
      if (!data.duplicate) {
        hide(hint);
        return;
      }
      hint.textContent = 'Another person is named ' + data.requested_username +
        '. Your name will stay ' + data.requested_username +
        ', but your login will be ' + data.login_username + '.';
      hint.classList.remove('hidden');
    }).catch(function () {
      if (currentRequest === requestId) hide(hint);
    });
  }

  function install() {
    var input = findInput();
    if (!input || input.dataset.upSignupUsernameInstalled) return;
    input.dataset.upSignupUsernameInstalled = 'true';
    var hint = findHint(input);
    hide(hint);
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { check(input); }, 180);
    });
    check(input);
  }

  install();
  new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
})();
