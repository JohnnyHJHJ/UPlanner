/* UPlanner branding: uploaded logo, warmer typography, and landing copy. */
(function () {
  'use strict';

  var LOGO_SRC = '/uplanner-logo.svg';
  var OLD_TAGLINE = 'Your schedule, organized';
  var NEW_TAGLINE = 'Find time that works for everyone without bouncing between spreadsheets, screenshots, and group chats.';

  function addStyles() {
    if (document.getElementById('up-branding-styles')) return;
    var style = document.createElement('style');
    style.id = 'up-branding-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
      body, button, input, select, textarea { font-family:'Nunito',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important; }
      h1,h2,h3,h4,h5,h6 { font-family:'Nunito',ui-sans-serif,system-ui,sans-serif !important; letter-spacing:-.025em; }
      .up-brand-logo { width:32px;height:32px;object-fit:contain;display:block;flex:0 0 auto; }
      .up-hero-logo { width:76px;height:76px;object-fit:contain;display:block;margin:0 auto 16px;filter:drop-shadow(0 10px 24px rgba(191,8,17,.18)); }
      .up-home-tagline { display:block!important; max-width:680px; margin:10px auto 0; color:#cbd5e1; font-size:clamp(1rem,2vw,1.18rem); line-height:1.65; font-weight:500; letter-spacing:-.01em; }
      [data-template-id="nav-brand"] { font-family:'Nunito',sans-serif !important; font-weight:800 !important; }
    `;
    document.head.appendChild(style);
  }

  function makeLogo(className, alt) {
    var img = document.createElement('img');
    img.className = className;
    img.src = LOGO_SRC;
    img.alt = alt || 'UPlanner';
    img.setAttribute('aria-hidden', alt ? 'false' : 'true');
    return img;
  }

  function addFavicon() {
    var link = document.querySelector('link[data-up-logo-favicon]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.dataset.upLogoFavicon = 'true';
      document.head.appendChild(link);
    }
    link.href = LOGO_SRC;
  }

  function brandNav() {
    document.querySelectorAll('[data-template-id="nav-brand"]').forEach(function (brand) {
      if (!brand.querySelector('.up-brand-logo')) brand.insertBefore(makeLogo('up-brand-logo', 'UPlanner'), brand.firstChild);
    });
  }

  function brandHeadings() {
    document.querySelectorAll('h1,h2,h3').forEach(function (heading) {
      if (heading.closest('#main-nav')) return;
      if (heading.dataset.upBranded === 'true') return;
      if (heading.textContent.trim() !== 'UPlanner') return;
      heading.dataset.upBranded = 'true';
      heading.insertBefore(makeLogo('up-hero-logo', 'UPlanner'), heading.firstChild);
    });
  }

  function replaceLandingTagline() {
    var found = false;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,span').forEach(function (el) {
      if (el.closest('#main-nav')) return;
      if (el.children.length) return;
      if (el.textContent.trim() !== OLD_TAGLINE) return;
      var tagline = document.createElement('p');
      tagline.className = 'up-home-tagline';
      tagline.textContent = NEW_TAGLINE;
      el.replaceWith(tagline);
      found = true;
    });

    if (document.querySelector('.up-home-tagline')) return;
    if (!found) {
      var heading = Array.from(document.querySelectorAll('h1,h2,h3')).find(function (el) {
        return !el.closest('#main-nav') && el.textContent.trim() === 'UPlanner';
      });
      if (heading) {
        var tagline = document.createElement('p');
        tagline.className = 'up-home-tagline';
        tagline.textContent = NEW_TAGLINE;
        heading.insertAdjacentElement('afterend', tagline);
      }
    }
  }

  function apply() {
    addStyles();
    addFavicon();
    brandNav();
    brandHeadings();
    replaceLandingTagline();
  }

  function boot() {
    apply();
    var observer = new MutationObserver(function () { apply(); });
    observer.observe(document.body, { childList:true, subtree:true });
    setTimeout(apply, 500);
    setTimeout(apply, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
