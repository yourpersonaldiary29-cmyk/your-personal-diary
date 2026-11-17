/**
 * site/site.js - the one script of the public site of Your Personal Diary (docs/site-tasks/SITE.md, section 8).
 * scripts/site/build-site.mjs publishes this file as it is, as site.js at the top of the site; every page
 * loads it with "defer". It does two things, and every page works without it:
 *
 *   1. The language chooser of the footer. Every page is written with the list of the 20 language links shown
 *      and the chooser (a select and its "Change" button) hidden, so that a browser that runs no script, or did
 *      not get this file, can still change the language. The script hides the list, shows the chooser and makes
 *      the "Change" button open the same page in the chosen language. Picking an option alone changes nothing
 *      (WCAG 3.2.2). A chooser with a part missing stays hidden and the list stays.
 *   2. The Downloads page. The three platform sections become tabs (WAI-ARIA tabs pattern: tablist, tab,
 *      tabpanel, aria-selected, aria-controls, roving tabindex; Left / Right / Home / End, with the arrows
 *      mirrored in a right-to-left page). The visitor's own platform is selected first when the browser tells
 *      it, otherwise the first tab. Without script the sections simply follow each other.
 *
 * No dependency, no network call, no storage, no cookie, no address written in this file: the addresses of the
 * other languages are the values of the options, written by the builder. scripts/site/site-js.test.mjs checks
 * all of that and runs both behaviours against a small DOM double.
 */
(function () {
  'use strict';

  var doc = document;
  var list = function (items) {
    return Array.prototype.slice.call(items);
  };

  // 1. The language chooser -------------------------------------------------------------------------------

  var chooser = doc.getElementById('lang-chooser');
  var select = doc.getElementById('lang-select');
  var change = doc.getElementById('lang-change');
  var links = doc.getElementById('lang-list');
  if (chooser && select && change) {
    var options = list(select.options);
    // A page that comes back from the browser's history shows its own language again, not the last choice.
    window.addEventListener('pageshow', function () {
      options.forEach(function (option) {
        option.selected = option.defaultSelected;
      });
    });
    change.addEventListener('click', function () {
      var chosen = options[select.selectedIndex];
      if (chosen && !chosen.defaultSelected) window.location.assign(chosen.value);
    });
    chooser.hidden = false;
    if (links) links.hidden = true;
  }

  // 2. The Downloads tabs ---------------------------------------------------------------------------------

  /** The id of the visitor's platform section, or '' when the browser does not tell. */
  var ownPlatform = function () {
    var agent = String(navigator.userAgent || '');
    if (/Android/i.test(agent)) return 'android';
    if (/iPhone|iPad|iPod/i.test(agent)) return '';
    // An iPad that asks for desktop pages calls itself a Mac; a Mac has no touch screen.
    if (/Mac/i.test(agent)) return navigator.maxTouchPoints > 1 ? '' : 'mac';
    if (/Win/i.test(agent)) return 'windows';
    return '';
  };

  var box = doc.getElementById('platforms');
  var panels = box ? list(box.querySelectorAll('.panel')) : [];
  if (panels.length > 1) {
    var rtl = doc.documentElement.getAttribute('dir') === 'rtl';
    var tablist = doc.createElement('div');
    var tabs = [];
    var current = 0;

    var show = function (index, moveFocus) {
      current = index;
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.setAttribute('tabindex', selected ? '0' : '-1');
        panels[i].hidden = !selected;
      });
      if (moveFocus) tabs[index].focus();
    };

    var onKey = function (event) {
      var last = tabs.length - 1;
      var next = -1;
      if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = current === last ? 0 : current + 1;
      else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = current === 0 ? last : current - 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = last;
      if (next < 0) return;
      event.preventDefault();
      show(next, true);
    };

    tablist.className = 'tablist';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', box.getAttribute('data-tabs-label'));
    panels.forEach(function (panel, index) {
      var tab = doc.createElement('button');
      var name = doc.createElement('bdi');
      name.textContent = panel.querySelector('h2').textContent;
      tab.setAttribute('type', 'button');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel.id);
      tab.id = 'tab-' + panel.id;
      tab.className = 'tab';
      tab.appendChild(name);
      tab.addEventListener('click', function () {
        show(index, false);
      });
      tab.addEventListener('keydown', onKey);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.setAttribute('tabindex', '0');
      tablist.appendChild(tab);
      tabs.push(tab);
    });
    box.insertBefore(tablist, panels[0]);
    box.className += ' tabs-on';

    // An address that ends with the id of a section (#android) opens that tab; otherwise the visitor's own
    // platform, when the browser tells it; otherwise the first tab.
    var indexOf = function (id) {
      var found = -1;
      panels.forEach(function (panel, index) {
        if (id && panel.id === id) found = index;
      });
      return found;
    };
    var first = indexOf(String(window.location.hash || '').slice(1));
    if (first < 0) first = indexOf(ownPlatform());
    show(first < 0 ? 0 : first, false);
  }
})();
