/*
- these statements have no requirements
- code at multiple places depend on these
*/

Object.defineProperty(String.prototype, 'filename', {
  value: function (extension) {
    let s = this.replace(/\\/g, '/');
    s = s.substring(s.lastIndexOf('/') + 1);
    return extension ? s.replace(/[?#].+$/, '') : s.split('.')[0];
  }
});

// Check if an array contains another array. Used to enable random categories set (jewerly & fossils)
Object.defineProperty(Array.prototype, 'arrayContains', {
  value: function (sub) {
    const result = sub.filter(item => this.indexOf(item) > -1);
    return result.length > 0;
  }
});

HTMLElement.prototype.firstAncestorOrSelf = function (func) {
  'use strict';
  let node = this;
  while (node) {
    if (func(node)) return node;
    node = node.parentNode;
  }
  return null;
};

HTMLElement.prototype.propSearchUp = function (property) {
  'use strict';
  const element = this.firstAncestorOrSelf(function (node) {
    return node[property] !== undefined;
  });
  return element ? element[property] : undefined;
};

let uniqueSearchMarkers = [];

const colorNameMap = {
  '#00ffa2': 'aquagreen', '#ffce70': 'beige', '#292929': 'black', '#31a6c7': 'blue',
  '#7c411f': 'brown', '#416776': 'cadetblue', '#0066a2': 'darkblue', '#627134': 'darkgreen',
  '#e27839': 'darkorange', '#593769': 'darkpurple', '#a13235': 'darkred', '#444444': 'gray',
  '#70ae25': 'green', '#88dbff': 'lightblue', '#5e5e5e': 'lightgray', '#a3c62c': 'lightgreen',
  '#ff8c7d': 'lightorange', '#da4d6d': 'lightred', '#ee9232': 'orange', '#c05b9f': 'pink',
  '#6b65a4': 'purple', '#d43d29': 'red', '#ffffff': 'white', '#ffcc5c': 'yellow',
};
const colorNameToHexMap = Object.fromEntries(
  Object.entries(colorNameMap).map(([hex, name]) => [name, hex])
);

const categories = [
  'arrowhead', 'bottle', 'bracelet', 'coastal', 'coin', 'cups', 'earring', 'egg',
  'fast_travel', 'flower', 'fossils_random', 'heirlooms',
  'jewelry_random', 'megafauna', 'nazar', 'necklace', 'oceanic', 'pentacles',
  'random', 'ring', 'swords', 'treasure', 'user_pins', 'wands', 'weekly', 'legendary_animals'
];

const parentCategories = {
  jewelry_random: ['bracelet', 'earring', 'necklace', 'ring'],
  fossils_random: ['coastal', 'megafauna', 'oceanic']
};

let enabledCategories = [...categories];
try {
  enabledCategories = JSON.parse(localStorage.getItem("rdr2collector.enabled-categories") || localStorage.getItem("enabled-categories")) || [...categories];
} catch (error) {
  // localStorage is not available due to user's browser settings.
  alert("Error retrieving settings.\n\nPlease make sure storing data is allowed for this site. Some browsers restrict storing data in private browsing modes. This website will not work properly until this is resolved.");
}

let draggableLatLngCtn = null;

/*
- Leaflet extentions require Leaflet loaded
- guaranteed by this script’s position in index.html
*/
L.DivIcon.DataMarkup = L.DivIcon.extend({
  _setIconStyles: function (img, name) {
    L.DivIcon.prototype._setIconStyles.call(this, img, name);
    if (this.options.marker)
      img.dataset.marker = this.options.marker;

    if (this.options.time) {
      const from = parseInt(this.options.time[0]);
      const to = parseInt(this.options.time[1]);

      img.dataset.time = timeRange(from, to);
    }

    if (this.options.tippy)
      img.dataset.tippy = this.options.tippy;
  }
});

// Glowing icon (legendary animals)
L.Icon.TimedData = L.Icon.extend({
  _setIconStyles: function (img, name) {
    L.Icon.prototype._setIconStyles.call(this, img, name);
    if (this.options.time && this.options.time.length) {
      img.dataset.time = this.options.time;
    }
  },
});

/*
- DOM will be ready, all scripts will be loaded (all loaded via DOM script elements)
- everything in this file here will be executed
- they can depend on their order here
- unfortunately some async dependencies are not properly taken care of (yet)
*/
document.addEventListener('DOMContentLoaded', function() {
  try {
    init();
  } catch (e) {
    if (getParameterByName('show-alert') == '1') {
      alert(e);
    }
    console.error(e);
  }
});

function init() {
  try {
    Sentry.init({ release: nocache, tracesSampleRate: isLocalHost() ? 1 : 0.3 });
  } catch (err) {
    console.log(`Sentry: ${err}`);
  }

  const navLang = navigator.language;
  const langCodesMap = {
    "zh-CN": "zh-Hans",
    "zh-SG": "zh-Hans",
    "zh-HK": "zh-Hant",
    "zh-TW": "zh-Hant",
  };
  const mappedLanguage = langCodesMap[navLang] || navLang;
  SettingProxy.addSetting(Settings, "language", {
    default: Language.availableLanguages.includes(mappedLanguage)
      ? mappedLanguage
      : "en",
  });

  Settings.language = Language.availableLanguages.includes(Settings.language) ? Settings.language : 'en';

  if (['ja', 'ko', 'zh-Hans', 'zh-Hant'].includes(Settings.language))
    MapBase.setFallbackFonts();
  
  // Open side-menu on default only on desktop
  SettingProxy.addSetting(Settings, 'isMenuOpened', {
    default: (() => {
      try {
        const height = window.screen.availHeight;
        const width = window.screen.availWidth;
        const mediaMobile = window.matchMedia('only screen and (max-width: 760px)').matches;
        return (height > width && mediaMobile) ? false : true;
      } catch (err) {
        return false;
      }
    })(),
  });

  //Convert some old settings here
  //amount and collected items are converted in mapping
  Object.keys(localStorage).forEach(key => {
    if(key.startsWith('main.')) {
      localStorage.setItem(`rdr2collector.${key.replace('main.', '')}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key == 'customMarkersColors') {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key.startsWith('routes.')) {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key.startsWith('inventory.')) {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key == 'enabled-categories') {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
  });

  const mapping = Mapping.init();
  const setMapTime = MapBase.setMapTime();
  Menu.init();
  const lootTables = MapBase.loadLootTable();
  const jewelryTimestamps = MapBase.loadJewelryTimestamps();
  const itemsCollectionsWeekly = Promise.all([mapping, jewelryTimestamps]).then(() => Item.init()); // Item.items (without .markers), Collection.collections, Collection.weekly*
  itemsCollectionsWeekly.then(MapBase.loadOverlays);
  MapBase.mapInit(); // MapBase.map
  const languages = Language.init().then(() => Language.setMenuLanguage());
  changeCursor();

  // MapBase.markers (without .lMarker), Item.items[].markers
  const markers = Promise.all([itemsCollectionsWeekly, lootTables]).then(Marker.init);
  const cycles = Promise.all([itemsCollectionsWeekly, markers, setMapTime]).then(Cycles.load);
  markers.then(Marker.createMarkerColorCustomPanel);
  Promise.all([languages, markers]).then(() => Pins.init());
  
  Inventory.init();
  MapBase.loadFastTravels();
  const filters = MapBase.loadFilters();
  FME.init();

  const treasures = Treasure.init();
  const legendaries = Legendary.init();
  Promise.all([languages, markers, cycles]).then(MapBase.afterLoad);
  Routes.init();
  Promise.all([itemsCollectionsWeekly, markers, cycles, treasures, legendaries, filters])
    .then(Loader.resolveMapModelLoaded);

  if (!MapBase.isPreviewMode)
    MadamNazar.loadMadamNazar();

  if (Settings.isMenuOpened) document.querySelector('.menu-toggle').click();

  document.documentElement.style.setProperty('--ctrl-meta-key', detectPlatform() === 'macOS' ? '"⌘"' : '"Ctrl"');

  document.querySelectorAll('.map-alert').forEach(alert => { alert.style.display = Settings.alertClosed ? 'none' : '' });

  document.getElementById('language').value = Settings.language;
  document.getElementById('marker-opacity').value = Settings.markerOpacity;
  document.getElementById('invisible-removed-markers').checked = Settings.isInvisibleRemovedMarkers;
  document.getElementById('override-search').checked = Settings.overrideBrowserSearch;

  document.getElementById('tools').value = Settings.toolType;
  document.getElementById('filter-type').value = Settings.filterType;
  document.getElementById('marker-size').value = Settings.markerSize;
  document.getElementById('reset-markers').checked = Settings.resetMarkersDaily;
  document.getElementById('marker-cluster').checked = Settings.isMarkerClusterEnabled;
  document.getElementById('tooltip-map').checked = Settings.showTooltipsMap;
  document.getElementById('enable-marker-popups').checked = Settings.isPopupsEnabled;
  document.getElementById('enable-marker-popups-hover').checked = Settings.isPopupsHoverEnabled;
  document.getElementById('enable-marker-shadows').checked = Settings.isShadowsEnabled;
  document.getElementById('enable-legendary-backgrounds').checked = Settings.isLaBgEnabled;
  document.getElementById('legendary-animal-marker-type').value = Settings.legendarySpawnIconType;
  document.getElementById('legendary-animal-marker-size').value = Settings.legendarySpawnIconSize;
  document.getElementById('enable-dclick-zoom').checked = Settings.isDoubleClickZoomEnabled;
  document.getElementById('pins-place-mode').checked = Settings.isPinsPlacingEnabled;
  document.getElementById('pins-edit-mode').checked = Settings.isPinsEditingEnabled;
  document.getElementById('show-help').checked = Settings.showHelp;
  document.getElementById('show-coordinates').checked = Settings.isCoordsOnClickEnabled;
  document.getElementById('map-boundaries').checked = Settings.isMapBoundariesEnabled;
  document.getElementById('timestamps-24').checked = Settings.isClock24Hour;
  document.getElementById('enable-cycles').checked = Settings.isCyclesVisible;
  document.getElementById('enable-cycle-input').checked = Settings.isCycleInputEnabled;
  document.getElementById('enable-right-click').checked = Settings.isRightClickEnabled;
  document.getElementById('enable-debug').checked = Settings.isDebugEnabled;
  document.getElementById('enable-cycle-changer').checked = Settings.isCycleChangerEnabled;

  document.getElementById('show-utilities').checked = Settings.showUtilitiesSettings;
  document.getElementById('show-customization').checked = Settings.showCustomizationSettings;
  document.getElementById('show-routes').checked = Settings.showRoutesSettings;
  document.getElementById('show-import-export').checked = Settings.showImportExportSettings;
  document.getElementById('show-debug').checked = Settings.showDebugSettings;

  document.getElementById("help-container").style.display = Settings.showHelp ? '' : 'none';

  document.querySelectorAll('.input-cycle').forEach(el => { el.classList.toggle('hidden', !Settings.isCycleInputEnabled); });
  document.querySelectorAll('.cycle-icon').forEach(el => { el.classList.toggle('hidden', !Settings.isCyclesVisible || Settings.isCycleInputEnabled); });
  document.querySelectorAll('.cycle-display').forEach(el => { el.classList.toggle('hidden', !Settings.isCyclesVisible); });
  document.getElementById('cycle-changer-container').classList.toggle('hidden', !Settings.isCycleChangerEnabled);

  document.getElementById('utilities-container').classList.toggle('opened', Settings.showUtilitiesSettings);
  document.getElementById('customization-container').classList.toggle('opened', Settings.showCustomizationSettings);
  document.getElementById('routes-container').classList.toggle('opened', Settings.showRoutesSettings);
  document.getElementById('import-export-container').classList.toggle('opened', Settings.showImportExportSettings);
  document.getElementById('debug-container').classList.toggle('opened', Settings.showDebugSettings);

  if (!MapBase.isPreviewMode)
    Updates.init();

  updateTopWidget();

  /*
  - clockTick() relies on DOM and jquery
  - guaranteed only by this script’s position at end of index.html
  */
  setInterval(clockTick, 1000);
}

function isLocalHost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function changeCursor() {
  const isCoordsEnabled = Settings.isCoordsOnClickEnabled || RouteSettings.customRouteEnabled;
  const pointer = 'url(assets/images/crosshair_thick.png) 12 12, pointer';
  document.querySelector('.leaflet-grab').style.cursor = isCoordsEnabled ? pointer : 'grab';

  const latLngCtn = document.querySelector('.lat-lng-container');
  latLngCtn.style.display = isCoordsEnabled ? 'block' : 'none';
  if (isCoordsEnabled) {
    draggableLatLngCtn ||= new PlainDraggable(latLngCtn);
  } else if (draggableLatLngCtn) {
    draggableLatLngCtn.remove();
    draggableLatLngCtn = null;
  }
}

function updateTopWidget() {
  const pEl = document.querySelectorAll('.top-widget > p');

  pEl.forEach((el, idx) => {
      if (Settings.topWidgetState !== idx) el.classList.add('hidden'); 
      else el.classList.remove('hidden');
  });
}

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function setClipboardText(text) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function downloadAsFile(filename, text) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function clockTick() {
  'use strict';
  const now = MapBase.mapTime();
  const gameTime = new Date(now * 30);
  const gameHour = gameTime.getUTCHours();
  const nightTime = gameHour >= 22 || gameHour < 5;
  const clockFormat = {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: Settings.isClock24Hour ? 'h23' : 'h12',
  };

  // Preview mode removes these elements.
  const timeInGame = document.getElementById('time-in-game');
  if (timeInGame)
    timeInGame.textContent = gameTime.toLocaleString(Settings.language, clockFormat);

  const dayCycleEl = document.getElementById('day-cycle');
  if (dayCycleEl) {
    const file = dayCycleEl.getAttribute('src').filename;
    if ((nightTime && file !== "moon") || (!nightTime && file !== "sun")) {
      dayCycleEl.classList.remove('hidden');
      dayCycleEl.setAttribute('src', `./assets/images/${nightTime ? 'moon' : 'sun'}.png`);
    }
  }

  const cycleResetTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const delta = new Date(cycleResetTime - now);
  const deltaFormat = {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  };

  // Preview mode removes this element.
  const countdown = document.getElementById('countdown');
  if (countdown)
    countdown.textContent = delta.toLocaleString([], deltaFormat);

  document.querySelectorAll('[data-marker*="provision_wldflwr_agarita"], [data-marker*="provision_wldflwr_blood_flower"]').forEach(marker => {
    const isImportant = marker.classList.contains('highlight-items');
    const whiteGlow = 'drop-shadow(0 0 .5rem #fff) drop-shadow(0 0 .3rem #fff)';
    const redGlow = 'drop-shadow(0 0 .5rem #cc0000) drop-shadow(0 0 .4rem #cc0000)';
    const pinkGlow = 'drop-shadow(0 0 .5rem #ff6fc7) drop-shadow(0 0 .3rem #ff6fc7)';
    if (MapBase.isPreviewMode) {
      marker.style.filter = 'none';
    } else if (isImportant && nightTime) {
      marker.style.filter = pinkGlow;
    } else if (isImportant) {
      marker.style.filter = redGlow;
    } else {
      marker.style.filter = nightTime ? whiteGlow : 'none';
    }
  });

  document.querySelectorAll('.leaflet-marker-icon[data-time]').forEach(marker => {
    let time = marker.dataset.time || '';
    if (time === '') return;
    if (time.split(',').includes(gameHour + '') && !MapBase.isPreviewMode) {
        marker.style.filter = 'drop-shadow(0 0 .5rem #fff) drop-shadow(0 0 .25rem #fff)';
    } else {
        marker.style.filter = 'none';
    }
  });
}

/*
- rest of file: event handler registrations (and some more functions)
- registrations require DOM ready and jquery
  - guaranteed only by this script’s position at end of index.html
- some handlers require scripts to be initialized and data loaded
  - NOT GUARANTEED
  - only hope: user does not do anything until that happens
- please move them out of here to their respective owners
*/
const sideMenu = document.querySelector('.side-menu');
const scrollerLineTop = document.querySelector('.scroller-line-tp');
const scrollerArrowTop = document.querySelector('.scroller-arrow-tp');
const scrollerLineBottom = document.querySelector('.scroller-line-bt');
const scrollerArrowBottom = document.querySelector('.scroller-arrow-bt');
const backToTop = document.getElementById('back-to-top');
const draggableBackToTop = draggify(backToTop, { storageKey: 'rdr2collector.backToTopPosition' });
let wasAtTop = true;
let wasAtBottom = false;
let lastScrollY = sideMenu.scrollTop;

sideMenu.addEventListener('scroll', function () {
  // These are not equality checks because of mobile weirdness.
  const atTop = this.scrollTop <= 0;
  const atBottom = Math.abs(this.scrollHeight - this.scrollTop - this.clientHeight) < 1;

  if (atTop !== wasAtTop) {
    scrollerLineTop.style.display = atTop ? '' : 'none';
    scrollerArrowTop.style.display = atTop ? 'none' : '';
    wasAtTop = atTop;
  }
  if (atBottom !== wasAtBottom) {
    scrollerLineBottom.style.display = atBottom ? '' : 'none';
    scrollerArrowBottom.style.display = atBottom ? 'none' : '';
    wasAtBottom = atBottom;
  }

  if (this.scrollTop !== 0 && this.scrollTop < lastScrollY) {
    backToTop.classList.add('is-visible');
  } else if (this.scrollTop === 0 || this.scrollTop > lastScrollY) {
    backToTop.classList.remove('is-visible');
  }
  lastScrollY = this.scrollTop;
});

backToTop.addEventListener('click', () => {
  if (draggableBackToTop.getDistanceMoved() < 5) {
    sideMenu.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

document.querySelectorAll('.top-widget > p').forEach((p) => {
  p.addEventListener('click', function () {
    const pEl = document.querySelectorAll('.top-widget > p').length;
    Settings.topWidgetState = (Settings.topWidgetState + 1) % pEl;
    updateTopWidget();
  });
});

document.getElementById('show-all-markers').addEventListener('change', function () {
  MapBase.showAllMarkers = this.checked;
  MapBase.addMarkers();
});

document.getElementById('enable-right-click').addEventListener('change', function () {
  Settings.isRightClickEnabled = this.checked;
});

const overrideSearch = document.getElementById('override-search');
overrideSearch.addEventListener('change', function () {
  Settings.overrideBrowserSearch = this.checked;
});

document.getElementById('show-utilities').addEventListener('change', function () {
  Settings.showUtilitiesSettings = this.checked;
  document.getElementById('utilities-container').classList.toggle('opened', Settings.showUtilitiesSettings);
});

document.getElementById('show-customization').addEventListener('change', function () {
  Settings.showCustomizationSettings = this.checked;
  document.getElementById('customization-container').classList.toggle('opened', Settings.showCustomizationSettings);
});

document.getElementById('show-routes').addEventListener('change', function () {
  Settings.showRoutesSettings = this.checked;
  document.getElementById('routes-container').classList.toggle('opened', Settings.showRoutesSettings);
});

document.getElementById('show-import-export').addEventListener('change', function () {
  Settings.showImportExportSettings = this.checked;
  document.getElementById('import-export-container').classList.toggle('opened', Settings.showImportExportSettings);
});

document.getElementById('show-debug').addEventListener('change', function () {
  Settings.showDebugSettings = this.checked;
  document.getElementById('debug-container').classList.toggle('opened', Settings.showDebugSettings);
});

document.getElementById('enable-debug').addEventListener('change', function () {
  Settings.isDebugEnabled = this.checked;
});

document.getElementById('enable-cycle-changer').addEventListener('change', function () {
  Settings.isCycleChangerEnabled = this.checked;
  document.getElementById('cycle-changer-container').classList.toggle('hidden', !Settings.isCycleChangerEnabled);
  if (!Settings.isCycleChangerEnabled) Cycles.resetCycle();
});

const searchInput = document.getElementById('search');
const suggestionsContainer = document.getElementById('query-suggestions');
const searchContainer = document.querySelector('#search').closest('.input-container');
const searchHotkey = document.getElementById('search-hotkey');
const suggestionsHotkeys = document.getElementById('query-suggestions-hotkeys');
let hideSuggestionsTimeout;

searchInput.addEventListener('input', function () {
  searchHotkey.style.opacity = searchInput.value ? '0' : '1';
  document.getElementById('filter-type').value = 'none';
  if (!isMobile()) {
    suggestionsHotkeys.style.display = searchInput.value.trim() === '' ? '' : 'none';
    document.querySelectorAll('#weekly-container .header, #weekly-container p').forEach((el) => el.classList.add('blurred'));
  }
  
  MapBase.onSearch(searchInput.value);
  MapBase.onQuerySuggestions(searchInput.value);
});

searchInput.addEventListener('focus', function () {
  if (!isMobile()) {
    suggestionsHotkeys.classList.toggle('focused', searchInput.value.trim() === '');
    document.querySelectorAll('#weekly-container .header, #weekly-container p').forEach((el) => el.classList.add('blurred'));
  }
  this.addEventListener('keydown', function handleEscKey(event) {
    if (event.key === 'Escape') {
      this.blur();
      this.removeEventListener('keydown', handleEscKey);
    }
  });
});

let activeSuggestionIndex = -1;
searchInput.addEventListener('keydown', function (e) {
  const suggestions = suggestionsContainer.querySelectorAll('.query-suggestion');
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
      suggestionsContainer.classList.add('scroll-visible');
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
      suggestionsContainer.classList.add('scroll-visible');
      break;
    case 'Enter':
      if (activeSuggestionIndex > -1 && suggestions.length > 0) {
        e.preventDefault();
        suggestions[activeSuggestionIndex].click();
        this.scrollLeft = this.scrollWidth;
      }
      break;
    default:
      return;
  }
  suggestions.forEach((el, index) => {
    el.classList.toggle('active', index === activeSuggestionIndex);
    if (index === activeSuggestionIndex) el.scrollIntoView({ block: 'nearest' });
  });
});

searchInput.addEventListener('blur', () => {
  hideSuggestionsTimeout = setTimeout(() => {
    if (!isMobile()) {
      suggestionsHotkeys.classList.remove('focused');
      document.querySelectorAll('#weekly-container .header, #weekly-container p').forEach((el) => el.classList.remove('blurred'));
    }
    suggestionsContainer.style.display = 'none';
    suggestionsContainer.innerHTML = '';
  }, 300);
  suggestionsContainer.classList.remove('scroll-visible');
});

suggestionsContainer.addEventListener('mouseleave', () => {
  suggestionsContainer.classList.remove('scroll-visible');
});

suggestionsContainer.addEventListener('mouseenter', () => {
  suggestionsContainer.classList.add('scroll-visible');
});

searchContainer.addEventListener('mouseleave', () => {
  hideSuggestionsTimeout = setTimeout(() => {
    suggestionsContainer.style.display = 'none';
    suggestionsContainer.innerHTML = '';
  }, 300);
});

searchContainer.addEventListener('mouseenter', () => {
  clearTimeout(hideSuggestionsTimeout);
});

document.getElementById('copy-search-link').addEventListener('click', function () {
  setClipboardText(`http://jeanropke.github.io/RDR2CollectorsMap/?search=${searchInput.value}`);
});

document.getElementById('clear-search').addEventListener('click', function () {
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  document.querySelectorAll('#weekly-container .header, #weekly-container p').forEach((el) => el.classList.remove('blurred'));
});

document.getElementById('reset-markers').addEventListener('change', function () {
  Settings.resetMarkersDaily = this.checked;
});

document.getElementById('clear-markers').addEventListener('click', function () {
  Object.values(MapBase.markers).forEach(marker => {
    marker.isCollected = false;
  });

  Menu.refreshMenu();
  MapBase.addMarkers();
});

document.getElementById('disable-all-collected-items').addEventListener('click', function () {
  MapBase.markers.forEach(marker => {
    if (marker.isRandomizedItem || marker.item.amount === 0) return;
    marker.isCollected = true;
  });
  MapBase.addMarkers();
});

document.getElementById('clear-inventory').addEventListener('click', function () {
  Item.items.forEach(item => item.amount = 0);
  Inventory.updateItemHighlights();
  Menu.refreshMenu();
  MapBase.addMarkers();
});

document.getElementById('custom-routes').addEventListener('change', function () {
  RouteSettings.customRouteEnabled = this.checked;
  changeCursor();
  const mapRoute = Routes.customRouteConnections.join(',');
  RouteSettings.customRoute = mapRoute;
});

document.getElementById('clear-custom-routes').addEventListener('click', Routes.clearCustomRoutes);

document.querySelectorAll('.map-alert').forEach(alert => {
  alert.addEventListener('click', function () {
    Settings.alertClosed = true;
    document.querySelectorAll('.map-alert').forEach(alert => {
      alert.classList.add('hidden');
    });
  });
});

document.querySelectorAll('.map-cycle-alert').forEach(alert => {
  alert.addEventListener('click', function () {
    document.querySelectorAll('.map-cycle-alert').forEach(alert => {
      alert.classList.add('hidden');
    });
  });
});

document.getElementById('show-coordinates').addEventListener('change', function () {
  Settings.isCoordsOnClickEnabled = this.checked;
  changeCursor();

  const routeStart = document.getElementById('generate-route-start');
  if (!this.checked && routeStart.value === 'MapClick') {
    routeStart.value = prevRouteStartSelect || 'SW';;
    routeStart.dispatchEvent(new Event('change'));
    FancySelect.update(routeStart);
  }
});

document.getElementById('map-boundaries').addEventListener('change', function () {
  Settings.isMapBoundariesEnabled = this.checked;
  MapBase.map.setMaxBounds(); //Remove boundaries
  MapBase.updateMapBoundaries();
});

document.getElementById('timestamps-24').addEventListener('change', function () {
  Settings.isClock24Hour = this.checked;
  clockTick();
});

document.getElementById('language').addEventListener('change', function () {
  Settings.language = this.value;
  if (searchInput.value.trim()) document.getElementById('clear-search').click();

  Language.setMenuLanguage();
  MapBase.initFuse();
  MapBase.setFallbackFonts();
  Menu.refreshMenu();
  Cycles.setLocaleDate();
  MapBase.addMarkers();
  Treasure.onLanguageChanged();
  Legendary.onLanguageChanged();
});

document.getElementById('marker-opacity').addEventListener('change', function () {
  Settings.markerOpacity = Number(this.value);
  MapBase.addMarkers();
});

document.getElementById('invisible-removed-markers').addEventListener('change', function () {
  Settings.isInvisibleRemovedMarkers = this.checked;
  MapBase.addMarkers();
});

document.getElementById('marker-size').addEventListener('change', function () {
  Settings.markerSize = Number(this.value);
  MapBase.addMarkers();
  Treasure.onSettingsChanged();
  Legendary.onSettingsChanged();
});

document.getElementById('filter-type').addEventListener('change', function () {
  Settings.filterType = this.value;
});

document.getElementById('filter-min-amount-items').addEventListener('change', function () {
  InventorySettings.maxAmountLowInventoryItems = Number(this.value);
});

document.getElementById('enable-cycles').addEventListener('change', function () {
  Settings.isCyclesVisible = this.checked;
  document.querySelectorAll('.cycle-icon').forEach(el => { el.classList.toggle('hidden', !Settings.isCyclesVisible || Settings.isCycleInputEnabled); });
  document.querySelectorAll('.cycle-display').forEach(el => { el.classList.toggle('hidden', !Settings.isCyclesVisible); });
  MapBase.addMarkers();
});

document.getElementById('enable-cycle-input').addEventListener('change', function () {
  Settings.isCycleInputEnabled = this.checked;
  document.querySelectorAll('.input-cycle').forEach(el => { el.classList.toggle('hidden', !Settings.isCycleInputEnabled); });
  document.querySelectorAll('.cycle-icon').forEach(el => { el.classList.toggle('hidden', !Settings.isCyclesVisible || Settings.isCycleInputEnabled); });
});

// Remove item from map when using the menu
document.addEventListener('click', function({target}) {
  if (target.closest('.collectible-wrapper[data-type]')) {
    const collectible = target.closest('.collectible-wrapper').getAttribute('data-type');
    const category = target.closest('.collectible-wrapper').parentElement.getAttribute('data-type');
    
    MapBase.removeItemFromMap(Cycles.categories[category], collectible, collectible, category, !InventorySettings.isMenuUpdateEnabled);
  }
});

document.querySelector('.menu-toggle').addEventListener('click', function () {
  const isMenuOpened = sideMenu.classList.toggle('menu-opened');
  this.setAttribute('data-menu-opened', isMenuOpened);
  Settings.isMenuOpened = isMenuOpened;
  document.querySelector('.top-widget').classList.toggle('top-widget-menu-opened', isMenuOpened);
  document.getElementById('fme-container').classList.toggle('fme-menu-opened', isMenuOpened);
});

document.getElementById('tooltip-map').addEventListener('change', function () {
  Settings.showTooltipsMap = this.checked;
  MapBase.updateTippy('tooltip');
});

document.getElementById('marker-cluster').addEventListener('change', function () {
  Settings.isMarkerClusterEnabled = this.checked;
  MapBase.addMarkers();
});

document.getElementById('enable-marker-popups').addEventListener('change', function () {
  Settings.isPopupsEnabled = this.checked;
  MapBase.addMarkers();
});

document.getElementById('enable-marker-popups-hover').addEventListener('change', function () {
  Settings.isPopupsHoverEnabled = this.checked;
});

document.getElementById('enable-marker-shadows').addEventListener('change', function () {
  Settings.isShadowsEnabled = this.checked;
  Treasure.onSettingsChanged();
  Legendary.onSettingsChanged();
  MapBase.addMarkers();
});

document.getElementById('enable-legendary-backgrounds').addEventListener('change', function () {
  Settings.isLaBgEnabled = this.checked;
  Legendary.onSettingsChanged();
});

document.getElementById('legendary-animal-marker-type').addEventListener('change', function () {
  Settings.legendarySpawnIconType = this.value;
  Legendary.onSettingsChanged();
});

document.getElementById('legendary-animal-marker-size').addEventListener('change', function () {
  Settings.legendarySpawnIconSize = Number(this.value);
  Legendary.onSettingsChanged();
});

document.getElementById('enable-dclick-zoom').addEventListener('change', function () {
  Settings.isDoubleClickZoomEnabled = this.checked;
  if (Settings.isDoubleClickZoomEnabled) {
    MapBase.map.doubleClickZoom.enable();
  } else {
    MapBase.map.doubleClickZoom.disable();
  }
});

document.getElementById('enable-inventory').addEventListener('change', function () {
  InventorySettings.isEnabled = this.checked;

  MapBase.addMarkers();

  document.getElementById('inventory-container').classList.toggle('opened', InventorySettings.isEnabled);
});

document.getElementById('enable-inventory-popups').addEventListener('change', function () {
  InventorySettings.isPopupsEnabled = this.checked;

  MapBase.addMarkers();
});

document.getElementById('reset-inventory-daily').addEventListener('change', function () {
  InventorySettings.resetInventoryDaily = this.checked;
});

document.getElementById('enable-additional-inventory-options').addEventListener('change', function () {
  InventorySettings.enableAdvancedInventoryOptions = this.checked;
});

document.getElementById('highlight_low_amount_items').addEventListener('change', function () {
  InventorySettings.highlightLowAmountItems = this.checked;
  MapBase.addMarkers();
});

document.getElementById('enable-inventory-menu-update').addEventListener('change', function () {
  InventorySettings.isMenuUpdateEnabled = this.checked;
});

document.getElementById('auto-enable-sold-items').addEventListener('change', function () {
  InventorySettings.autoEnableSoldItems = this.checked;
});

document.getElementById('inventory-stack').addEventListener('change', function () {
  const min = parseInt(this.min);
  const max = parseInt(this.max);
  let inputValue = parseInt(this.value);
  
  this.value = (isNaN(inputValue) || inputValue < min || inputValue > max) ? max : inputValue;
  InventorySettings.stackSize = inputValue;
});

document.getElementById('soft-flowers-inventory-stack').addEventListener('change', function () {
  const min = parseInt(this.min);
  const max = parseInt(this.max);
  let inputValue = parseInt(this.value);

  this.value = (isNaN(inputValue) || inputValue < min || inputValue > max) ? max : inputValue;
  InventorySettings.flowersSoftStackSize = inputValue;
});

document.getElementById('cookie-export').addEventListener('click', function () {
  try {
    let settings = localStorage;

    const exportDate = new Date().toISOUTCDateString();
    localStorage.setItem('rdr2collector.date', exportDate);

    // Remove irrelevant properties (permanently from localStorage):
    delete settings.randid;

    // Remove irrelevant properties (from COPY of localStorage, only to do not export them):
    settings = Object.assign({}, localStorage);

    //Now we can just export this map settings :)
    Object.keys(settings).forEach(function(key){
      if(!key.startsWith('rdr2collector.'))
        delete settings[key];
    });

    delete settings['pinned-items'];
    delete settings['rdr2collector.pinned-items'];
    delete settings['rdr2collector.routes.customRoute'];

    // Set file version
    settings.version = 2;

    const settingsJson = JSON.stringify(settings, null, 4);

    downloadAsFile(`collectible-map-settings-(${exportDate}).json`, settingsJson);
  } catch (error) {
    console.error(error);
    alert(Language.get('alerts.feature_not_supported'));
  }
});

function setSettings(settings) {
  // Sorry, old settings! :-(
  if (settings.version === undefined) {
    location.reload();
    return;
  }

  delete settings.version;

  for (const key in settings) {
    //Skip `rdo.` keys.
    if (!key.startsWith('rdo.')) {
        localStorage.setItem(key, settings[key]);
    }
  }
  // Do this for now, maybe look into refreshing the menu completely (from init) later.
  location.reload();
}

document.getElementById('cookie-import').addEventListener('click', function () {
  try {
    let settings = null;
    const file = document.getElementById('cookie-import-file').files[0];
    let fallback = false;

    if (!file) {
      alert(Language.get('alerts.file_not_found'));
      return;
    }

    try {
      file.text().then((text) => {
        try {
          settings = JSON.parse(text);

          setSettings(settings);

        } catch (error) {
          alert(Language.get('alerts.file_not_valid'));
          return;
        }
      });
    } catch (error) {
      fallback = true;
    }

    if (fallback) {
      const reader = new FileReader();

      reader.addEventListener('loadend', (e) => {
        const text = e.srcElement.result;

        try {
          settings = JSON.parse(text);
          setSettings(settings);
        } catch (error) {
          alert(Language.get('alerts.file_not_valid'));
          return;
        }
      });

      reader.readAsText(file);
    }

    for (const key in localStorage) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    // console.error(error);
    alert(Language.get('alerts.feature_not_supported'));
  }
});

document.getElementById('generate-route-generate-on-visit').addEventListener('change', function () {
  RouteSettings.runOnStart = this.checked;
});

document.getElementById('generate-route-ignore-collected').addEventListener('change', function () {
  RouteSettings.ignoreCollected = this.checked;
  Routes.generatePath();
});

document.getElementById('generate-route-important-only').addEventListener('change', function () {
  RouteSettings.importantOnly = this.checked;
  Routes.generatePath();
});

document.getElementById('generate-route-auto-update').addEventListener('change', function () {
  RouteSettings.autoUpdatePath = this.checked;
});

document.getElementById('generate-route-distance').addEventListener('change', function () {
  let inputValue = parseInt(this.value);
  inputValue = !isNaN(inputValue) && inputValue > 0 ? inputValue : 25;
  RouteSettings.maxDistance = inputValue;
  Routes.generatePath();
});

let prevRouteStartSelect = null;
document.getElementById('generate-route-start').addEventListener('change', function () {
  const inputValue = this.value;
  const latInput = document.getElementById('generate-route-start-lat');
  const lngInput = document.getElementById('generate-route-start-lng');

  const coordinates = {
    N: [-11.875, 86.875],
    NE: [-27.4375, 161.2813],
    SE: [-100.75, 131.125],
    SW: [-119.9063, 8.0313]
  };
  const [startLat, startLng] = coordinates[inputValue] || coordinates.SW;
  latInput.value = startLat;
  lngInput.value = startLng;
  RouteSettings.genPathStart = inputValue;
  RouteSettings.startMarkerLat = startLat;
  RouteSettings.startMarkerLng = startLng;
  Routes.generatePath();

  const showCoords = inputValue === 'Custom';
  latInput.parentElement.style.display = showCoords ? 'block' : 'none';
  lngInput.parentElement.style.display = showCoords ? 'block' : 'none';
  if (showCoords) return;

  const isMapClick = inputValue === 'MapClick';
  if (!isMapClick) prevRouteStartSelect = inputValue;
  Settings.isCoordsOnClickEnabled = isMapClick;
  document.getElementById('show-coordinates').checked = isMapClick;
  document.querySelector('.lat-lng-container').style.display = isMapClick ? 'block' : 'none';
  changeCursor();
});

document.getElementById('generate-route-start-lat').addEventListener('change', function () {
  let inputValue = parseFloat(this.value);
  inputValue = !isNaN(inputValue) ? inputValue : -119.9063;
  RouteSettings.startMarkerLat = inputValue;
  Routes.generatePath();
});

document.getElementById('generate-route-start-lng').addEventListener('change', function () {
  let inputValue = parseFloat(this.value);
  inputValue = !isNaN(inputValue) ? inputValue : 8.0313;
  RouteSettings.startMarkerLng = inputValue;
  Routes.generatePath();
});

document.getElementById('generate-route-use-pathfinder').addEventListener('change', function () {
  RouteSettings.usePathfinder = this.checked;

  // Hide incompatible options.
  if (RouteSettings.usePathfinder) {
    document.getElementById('generate-route-distance').parentElement.style.display = 'none';
    document.getElementById('generate-route-auto-update').parentElement.parentElement.style.display = 'none';
    document.getElementById('generate-route-fasttravel-weight').parentElement.style.display = '';
    document.getElementById('generate-route-railroad-weight').parentElement.style.display = '';
  } else {
    document.getElementById('generate-route-distance').parentElement.style.display = '';
    document.getElementById('generate-route-auto-update').parentElement.parentElement.style.display = '';
    document.getElementById('generate-route-fasttravel-weight').parentElement.style.display = 'none';
    document.getElementById('generate-route-railroad-weight').parentElement.style.display = 'none';
  }

  // Prevent both routes being stuck on screen.
  Routes.clearPath();

  Routes.generatePath();
});

document.getElementById('generate-route-fasttravel-weight').addEventListener('change', function () {
  RouteSettings.fasttravelWeight = parseFloat(this.value);
  Routes.generatePath();
});

document.getElementById('generate-route-railroad-weight').addEventListener('change', function () {
  RouteSettings.railroadWeight = parseFloat(this.value);
  Routes.generatePath();
});

document.getElementById('show-help').addEventListener('change', function () {
  Settings.showHelp = this.checked;
  document.getElementById('help-container').style.display = Settings.showHelp ? '' : 'none';
});

document.addEventListener('contextmenu', function (e) {
  if (!Settings.isRightClickEnabled) e.preventDefault();
});

document.getElementById('delete-all-settings').addEventListener('click', function () {
  for (const key in localStorage) {
    if(key.startsWith('rdr2collector.'))
      localStorage.removeItem(key);
  };

  location.reload(true);
});

/*
Reload convenience shortcut requested by @Adam Norton#6811.
Map’s tile area is reduced to a smaller area after lock-unlock cycle on iOS
if opened via iOS homescreen bookmarks. (Which has no reload button.)
*/
document.getElementById('reload-map').addEventListener('click', function () {
  location.reload(true);
});

const clearMarkersModal = new bootstrap.Modal(document.getElementById('clear-markers-modal'));
document.getElementById('open-clear-markers-modal').addEventListener('click', function () {
  clearMarkersModal.show();
});

const clearImportantItemsModal = new bootstrap.Modal(document.getElementById('clear-important-items-modal'));
document.getElementById('open-clear-important-items-modal').addEventListener('click', function () {
  clearImportantItemsModal.show();
});

const clearInventoryModal = new bootstrap.Modal(document.getElementById('clear-inventory-modal'));
document.getElementById('open-clear-inventory-modal').addEventListener('click', function () {
  clearInventoryModal.show();
});

const clearRoutesModal = new bootstrap.Modal(document.getElementById('clear-routes-modal'));
document.getElementById('open-clear-routes-modal').addEventListener('click', function () {
  clearRoutesModal.show();
});

const deleteAllSettingsModal = new bootstrap.Modal(document.getElementById('delete-all-settings-modal'));
document.getElementById('open-delete-all-settings-modal').addEventListener('click', function () {
  deleteAllSettingsModal.show();
});

const removeAllPinsModal = new bootstrap.Modal(document.getElementById('remove-all-pins-modal'));
document.getElementById('open-remove-all-pins-modal').addEventListener('click', function () {
  removeAllPinsModal.show();
});

document.getElementById('open-updates-modal').addEventListener('click', function () {
  Updates.showModal();
});

const importRDOInventoryModal = new bootstrap.Modal(document.getElementById('import-rdo-inventory-modal'));
document.getElementById('open-import-rdo-inventory-modal').addEventListener('click', function () {
  const textarea = document.getElementById('rdo-inventory-textarea');
  if(textarea) textarea.value = '';
  importRDOInventoryModal.show();
});

function formatLootTableLevel(table, rate = 1, level = 0) {
  const result = document.createElement('div');

  const items = MapBase.lootTables.loot[table];
  const hasItems = !!items;

  // Max. 2 digits but no trailing.
  const formatted = Number((rate * 100).toPrecision(2));

  if (hasItems) {
    const title = document.createElement('span');
    title.className = `loot-table-title level-${level + 1}`;
    if (level === 0) {
      const h4 = document.createElement('h4');
      h4.setAttribute('data-text', `menu.${table}`);
      title.appendChild(h4);
    } else {
      const h5 = document.createElement('h5');
      h5.setAttribute('data-text', `menu.${table}`);
      title.appendChild(h5);
      const rateEl = document.createElement('h5');
      rateEl.className = 'rate';
      rateEl.textContent = `${formatted}%`;
      title.appendChild(rateEl);
    }
    result.appendChild(title);

    const wrapper = document.createElement('div');
    wrapper.className = `loot-table-wrapper level-${level + 1}`;
    Object.keys(items).forEach(key => {
      wrapper.appendChild(formatLootTableLevel(key, rate * items[key], level + 1));
    });
    result.appendChild(wrapper);
  } else {
    const item = document.createElement('div');
    item.className = 'loot-table-item';
    item.innerHTML = `<span data-text="${table}.name"></span><span class="rate">~${formatted}%</span>`;
    result.appendChild(item);
  }

  return result;
}

const videoModalEl = document.getElementById('video-modal');
const videoFrameEl = document.getElementById('video-frame');
videoModalEl.addEventListener('show.bs.modal', function (event) {
  const button = event.relatedTarget;

  const parentDiv = button.firstAncestorOrSelf((node) => node.tagName === 'DIV');
  document.getElementById('video-modal-title').textContent =
    parentDiv.querySelector('h1').innerText || Language.get('map.video');

  const url = new URL(button.getAttribute('data-video-url'));
  if (['youtube', 'youtu.be'].some((value) => url.host.includes(value))) {
    const videoId = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    const startTime = parseInt(url.searchParams.get('t'), 10) || 0;
    videoFrameEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${startTime}`;
  } else if (url.host.includes('bilibili')) {
    const videoId = url.pathname.split('/')[2];
    const startTime = url.searchParams.get('t') || 0;
    videoFrameEl.src = `https://player.bilibili.com/player.html?bvid=${videoId}&high_quality=1&t=${startTime}`;
  }
});
videoModalEl.addEventListener('hidden.bs.modal', function () {
  videoFrameEl.src = '';
});

const lootTableModalEl = document.getElementById('loot-table-modal');
lootTableModalEl.addEventListener('show.bs.modal', function (event) {
  // Get related loot table.
  const button = event.relatedTarget;
  const table = button.getAttribute('data-loot-table');
  let wrapper = document.createElement('div');
  wrapper.classList.add('loot-tables-wrapper');

  // Format loot table.
  const tables = MapBase.lootTables.categories[table];
  tables.forEach(table => {
    wrapper.appendChild(formatLootTableLevel(table));
  });

  // Append loot table to modal.
  const translatedContent = Language.translateDom(wrapper).outerHTML;
  lootTableModalEl.querySelector('#loot').innerHTML = translatedContent;
});

const customMarkerColorModal = new bootstrap.Modal(document.getElementById('custom-marker-color-modal'));
document.getElementById('open-custom-marker-color-modal').addEventListener('click', event => {
  customMarkerColorModal.show();
});

if (isMobile()) {
  searchHotkey.style.display = 'none';

  Settings.overrideBrowserSearch = false;
  overrideSearch.check = false;
  overrideSearch.parentElement.parentElement.classList.add('disabled');
  overrideSearch.parentElement.parentElement.disabled = true;
}

function filterMapMarkers() {
  uniqueSearchMarkers = [];
  let filterType = () => true;
  let enableMainCategory = true;
  const searchInputVal = document.getElementById('search').value;

  if (Settings.filterType === 'none') {
    const searchSet = new Set(
      (searchInputVal || '')
        .replace(/^[;\s]+|[;\s]+$/g, '')
        .split(';')
        .filter(Boolean)
    );

    if (searchSet.size)
      MapBase.onSearch(searchInputVal, true);
    else
      uniqueSearchMarkers = MapBase.markers;

    MapBase.addMarkers();
    return;
  }
  else if (['moonshiner', 'naturalist'].includes(Settings.filterType)) {
    const roleItems = [].concat(...Object.values(MapBase.filtersData[Settings.filterType]));
    filterType = marker => roleItems.includes(marker.itemId);
  }
  else if (Settings.filterType === 'weekly') {
    const weeklyItems = Weekly.current.collectibleItems.map(item => item.itemId);
    filterType = marker => weeklyItems.includes(marker.itemId);
  }
  else if (Settings.filterType === 'weeklyAndRandom') {
    const weeklyItems = Weekly.current.collectibleItems.map(item => item.itemId);
    filterType = marker =>
      weeklyItems.includes(marker.itemId) ||
      weeklyItems.some(item => marker.possibleItems && marker.possibleItems.includes(item));
  }
  else if (Settings.filterType === 'important') {
    const importantItems = Item.items.filter(item => item.isImportant).map(item => item.itemId);
    filterType = marker => importantItems.includes(marker.itemId);
  }
  else if (Settings.filterType === 'static') {
    filterType = marker => !marker.legacyItemId.includes('random');
  }
  // hides only flowers not belongs to any moonshine recipe
  else if (Settings.filterType === 'hideFlowers') {
    const roleItems = [].concat(...Object.values(MapBase.filtersData['moonshiner']));
    filterType = marker => roleItems.includes(marker.itemId) || marker.category !== 'flower';
  }
  else if (Settings.filterType === 'coinsSpots') {
    filterType = marker => ['coin', 'random'].includes(marker.category) && marker.tool === 2;
  }
  else if (Settings.filterType === 'lowInventoryItems') {
    enableMainCategory = false;
    const maxAmount = InventorySettings.maxAmountLowInventoryItems;
    const lowItems = Item.items.filter(item => item.amount < maxAmount).map(item => item.itemId);
    filterType = marker => lowItems.includes(marker.itemId);
  }
  else if (Settings.filterType === 'lowInventoryItemsAndRandom') {
    enableMainCategory = false;
    const maxAmount = InventorySettings.maxAmountLowInventoryItems;
    const lowItems = Item.items.filter(item => item.amount < maxAmount).map(item => item.itemId);
    filterType = marker =>
      lowItems.includes(marker.itemId) ||
      lowItems.some(item => marker.possibleItems && marker.possibleItems.includes(item));
  }

  MapBase.markers
    .filter(filterType)
    .forEach(marker => {
      uniqueSearchMarkers.push(marker);
      if (!enabledCategories.includes(marker.category) && enableMainCategory) {
        enabledCategories.push(marker.category);
        document.querySelectorAll(`[data-type="${marker.category}"]`).forEach(el => { el.classList.remove('disabled'); });
      }
    });

  MapBase.addMarkers();
}

/**
  linear proportion with cut values out of range:
  value - number to convert,
  iMin - input range minimum,
  iMax - input range maximum,
  oMin - output range minimum,
  oMax - output range maximum;
**/
function linear(value, iMin, iMax, oMin, oMax) {
  const clamp = (num, min, max) => {
    return num <= min ? min : num >= max ? max : num;
  }
  return clamp((((value - iMin) / (iMax - iMin)) * (oMax - oMin) + oMin), oMin, oMax);
}

// converts number to correct 12/24 hours time:
function convertToTime(hours = '00', minutes = '00') {
  return Settings.isClock24Hour ?
    `${hours}:${minutes}` :
    `${+hours % 12 || 12}:${minutes} ${+hours >= 12 ? 'PM' : 'AM'}`;
}

// returns an Array with all hours between from...to
function timeRange(from, to) {
  const times = [];

  let hour = from;
  while (hour !== to) {
    times.push(hour);
    hour = (hour + 1) % 24;
    if (times.length >= 24) break;
  }
  return times;
}

function isEmptyObject(obj) {
  if (obj == null) return true;
  if (typeof obj !== 'object') return false;
  return Object.keys(obj).length === 0;
}

/**
 * Loads a specified font and adds it to the document's font set.
 *
 * @param {string} name - The name of the font.
 * @param {Object} urls - An object containing URLs for different font formats.
 * @param {string} [urls.woff2] - The URL for the WOFF2 font format.
 * @param {string} [urls.woff] - The URL for the WOFF font format.
 * @param {string} [urls.ttf] - The URL for the TTF font format.
 * @returns {Promise<FontFace>} A promise that resolves to the loaded FontFace object.
 * 
 * @example
 * const urls = {
 *   woff2: '/assets/fonts/font.woff2',
 *   woff: '/assets/fonts/font.woff',
 *   ttf: '/assets/fonts/font.ttf'
 * };
 */
function loadFont(name, urls = {}) {
  const sources = [
    { url: urls.woff2, format: 'woff2' },
    { url: urls.woff, format: 'woff' },
    { url: urls.ttf, format: 'truetype' }
  ]
    .filter(({ url }) => url)
    .map(({ url, format }) => `url(${url}) format('${format}')`)
    .join(', ');

  const fontFace = new FontFace(name, sources, { style: 'normal', weight: '400' });
  return fontFace.load().then(() => {
    document.fonts.add(fontFace);
    return fontFace;
  });
}

function isMobile() {
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hasTouchPoints = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
  const isMobileUAData = navigator.userAgentData ? navigator.userAgentData.mobile : false;
  const isMobileUserAgent = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return isCoarsePointer || hasTouchPoints || isMobileUAData || isMobileUserAgent;
}

function detectPlatform() {
  const { userAgentData, userAgent, vendor } = navigator;
  const platform = userAgentData?.platform || userAgent || vendor || window.opera || '';
  const platforms = {
    macOS: /Macintosh|MacIntel|MacPPC|Mac68K|Mac OS X/i,
    Windows: /Windows|Win32|Win64|WOW64|WinCE/i,
    Android: /Android/i,
    Linux: /Linux/i,
  };
  for (const [key, regex] of Object.entries(platforms)) {
    if (regex.test(platform)) return key;
  }

  return 'other';
}

/**
 * Converts placeholders within a translated string into corresponding HTML elements.
 * This function processes a DOM element's innerHTML and replaces specific placeholder
 * tokens (e.g., {↑}, {↓}, {Enter}) with the corresponding HTML representations provided
 * in the placeholders object.
 * 
 * @param {HTMLElement} el - The DOM element containing the translated text with placeholders.
 * @param {Object} placeholders - An object mapping placeholder tokens to their HTML representations.
 *                                The keys are the placeholders and the values are the HTML strings.
 * @returns {void}
 * 
 * @example
 * const el = document.getElementById('query-suggestions-hotkeys');
 * const placeholders = {
 *   '↑': '<kbd class="hotkey">↑</kbd>',
 *   '↓': '<kbd class="hotkey">↓</kbd>',
 *   'Enter': '<kbd class="hotkey">Enter</kbd>'
 * };
 * placeholdersToHtml(el, placeholders);
 * // The innerHTML of the element will be:
 * // 'Search in suggestions, Press <kbd class="hotkey">↑</kbd> <kbd class="hotkey">↓</kbd> <kbd class="hotkey">Enter</kbd> for general search.'
 */
function placeholdersToHtml(el, placeholders) {
  let html = el.innerHTML;
  Object.entries(placeholders).forEach(
    ([key, value]) => (html = html.split(`{${key}}`).join(value))
  );
  el.innerHTML = html;
}

/**
 * Makes an element draggable.
 *
 * @param {HTMLElement} el - The element to make draggable.
 * @param {Object} options - Configuration options for the draggable functionality.
 * @param {string} options.storageKey - The key used to save the element's position in localStorage.
 * @returns {Object} An object containing:
 *  - `isDragging`: A function that returns a boolean indicating if the element is being dragged.
 *  - `getDistanceMoved`: A function that returns the distance moved since the drag started.
 */
function draggify(el, { storageKey }) {
  if (!el) {
    console.error('Element not found');
    return;
  }

  let isDragging = false;
  let startX, startY, initialX, initialY;
  let currentX = 0, currentY = 0;

  const savePosition = () => {
    const position = { x: currentX, y: currentY };
    localStorage.setItem(storageKey, JSON.stringify(position));
  };

  const restorePosition = () => {
    const savedPosition = localStorage.getItem(storageKey);
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      currentX = x;
      currentY = y;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  const onDragStart = (e) => {
    isDragging = true;
    startX = e.clientX || e.touches[0].clientX;
    startY = e.clientY || e.touches[0].clientY;
    initialX = currentX;
    initialY = currentY;
    el.style.transition = 'none';
    el.style.cursor = 'grabbing';
    requestAnimationFrame(updatePosition);
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    currentX = initialX + (clientX - startX);
    currentY = initialY + (clientY - startY);
  };

  const onDragEnd = () => {
    isDragging = false;
    el.style.transition = '0.2s all';
    el.style.cursor = 'grab';
    savePosition();
  };

  const updatePosition = () => {
    if (isDragging) {
      el.style.transform = `translate(${currentX}px, ${currentY}px)`;
      requestAnimationFrame(updatePosition);
    }
  };

  el.addEventListener('pointerdown', onDragStart);
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragEnd);

  el.addEventListener('touchstart', onDragStart);
  document.addEventListener('touchmove', onDragMove);
  document.addEventListener('touchend', onDragEnd);
  document.addEventListener('touchcancel', onDragEnd);

  restorePosition();

  return {
    isDragging: () => isDragging,
    getDistanceMoved: () =>
      Math.sqrt((currentX - initialX) ** 2 + (currentY - initialY) ** 2)
  };
}

function animateValue(el, start, end, duration) {
  const startTime = performance.now();
  function step(currTime) {
    const progress = Math.min((currTime - startTime) / duration, 1);
    const value = start + (end - start) * progress;

    el.textContent = `$${value.toFixed(2)}`;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}