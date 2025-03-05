const Language = {
  data: {},
  availableLanguages: ['en', 'af', 'ar', 'ca', 'cs', 'da', 'de', 'el', 'en-GB', 'es', 'es-MX', 'fi', 'fr', 'he', 'hu', 'id', 'it', 'ja', 'ko', 'no', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sr', 'sv', 'th', 'tr', 'uk', 'vi', 'zh-Hans', 'zh-Hant'],
  progress: {},
  allowedPlaceholders : ['↑', '↓', 'Enter'],

  init: function () {
    'use strict';
    const langs = ['en'];

    if (Settings.language !== 'en') {
      langs.push(Settings.language);
    }

    const fetchTranslations = langs.map(async language => {
      const response = await fetch(`./langs/${language.replace('-', '_')}.json?nocache=${nocache}&date=${new Date().toISOUTCDateString()}`);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} on ${response.url}. Failed to fetch translation data for ${language}`);
      }
      const json = await response.json();
      let result = {};
      
      for (const propName in json) {
        if (json[propName] !== "" && (isEmptyObject(Language.data.en) || Language.data.en[propName] !== json[propName])) {
          result[propName] = json[propName];
        }
      }

      Language.data[language] = result;
    });

    return Promise.all(fetchTranslations).then(() => {
      return Loader.promises['lang_progress'].consumeJson(data => {
        this.progress = data;
        this.updateProgress();
      });
    });
  },

  _links: {
    'GitHub': ['https://github.com/jeanropke/RDR2CollectorsMap/issues', 'GitHub'],
    'Discord': ['https://discord.gg/WWru8cP', 'Discord'],
    'int.nazar.link': ['https://twitter.com/MadamNazarIO', '@MadamNazarIO'],
    'int.random_spot.link': ['https://github.com/jeanropke/RDR2CollectorsMap/wiki/Random-Item-Possible-Loot'],
    'int.naturalist_faq.link': ['https://github.com/jeanropke/RDR2CollectorsMap/wiki/Naturalist-Update-Changes'],
    'int.rdo.overview': ['https://socialclub.rockstargames.com/games/rdo/overview']
  },

  _externalLink: function (key) {
    'use strict';
    const [url, text] = Language._links[key];
    return `<a href="${url}" target="_blank">${text ? `${text}</a>` : ''}`;
  },

  get: function (transKey, optional) {
    'use strict';
    let translation = false;

    if (Settings.isDebugEnabled) optional = false;

    if (Language._links.propertyIsEnumerable(transKey)) {
      translation = Language._externalLink(transKey);
    } else if (transKey === 'int.end.link') {
      translation = '</a>';
    } else if (transKey === 'collection') {
      transKey = Weekly.current ? `weekly.desc.${Weekly.current.weeklyId}` : '';
    }

    if (translation) {
      translation = translation.replace('{0}', optional);
    } else if (Language.data[Settings.language] && Language.data[Settings.language][transKey]) {
      translation = Language.data[Settings.language][transKey];
    } else if (Language.data.en && Language.data.en[transKey]) {
      translation = Language.data.en[transKey];
    } else {
      translation = (optional ? '' : transKey);
    }

    return translation.replace(/\{([\w.]+)\}/g, (full, key) => {
      const translation = this.get(key);
      return translation === key ? `{${key}}` : translation;
    });
  },

  translateDom: function (context) {
    'use strict';
    Array.from((context || document).querySelectorAll('[data-text]')).forEach(element => {
      const transKey = element.getAttribute('data-text');
      let string = Language.get(transKey, element.dataset.textOptional);

      // Don't dump raw variables out to the user here, instead make them appear as if they are loading.
      string = string.replace(/\{([\w.]+)\}/g, (match, p1) =>
        this.allowedPlaceholders.includes(p1) ? match : '---'
      );
      element.innerHTML = string;
    });
    return context;
  },

  setMenuLanguage: function () {
    'use strict';

    document.documentElement.setAttribute('lang', Settings.language);

    if (Language.data[Settings.language] === undefined) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `./langs/${Settings.language.replace('-', '_')}.json?nocache=${nocache}&date=${new Date().toISOUTCDateString()}`, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            const json = JSON.parse(xhr.responseText);
            let result = {};

            for (const propName in json) {
              if (json[propName] !== "" && (isEmptyObject(Language.data.en) || Language.data.en[propName] !== json[propName])) {
                result[propName] = json[propName];
              }
            }

            Language.data[Settings.language] = result;
          } else {
            console.error(`Failed to fetch translation data for ${Settings.language}. Status code: ${xhr.status}`);
          }
        }
      };
      xhr.send();
    }

    this.translateDom();

    this._postTranslation();
  },

  updateProgress: function () {
    document.querySelectorAll('#language option').forEach(option => {
      const item = option.getAttribute('value').replace('-', '_');
      let percent = this.progress[item];

      if (item === "en") percent = 100;
      if (!percent) percent = 0;

      option.textContent = `${Language.get('menu.lang_' + item)} (${percent}%)`;
    });

    let thisProg = this.progress[Settings.language.replace('-', '_')];
    if (Settings.language === "en") thisProg = 100;
    if (!thisProg) thisProg = 0;
    document.getElementById('translation-progress').textContent = Language.get('menu.translate_progress').replace('{progress}', thisProg);
  },

  _postTranslation: function () {
    const diffDays = Math.floor((new Date() - new Date('November 26, 2018')) / (1000 * 60 * 60 * 24));
    document.querySelector('#sub-header .cycle-date').setAttribute('data-tippy-content', Language.get('menu.span_game_released')
      .replace('{years}', Math.floor(diffDays / 365))
      .replace('{days}', diffDays % 365));

    const wikiPages = { 'de': '-de-DE', 'fr': '-fr-FR', 'pt-BR': '-pt-BR', 'ru': '-ru-RU' };
    document.querySelector('.wiki-page').setAttribute('href',
      `https://github.com/jeanropke/RDR2CollectorsMap/wiki/RDO-Collectors-Map-User-Guide${wikiPages[Settings.language] ?? ''}`
    );

    document.getElementById('search').setAttribute('placeholder', Language.get('menu.search_placeholder'));
    placeholdersToHtml(document.getElementById('query-suggestions-hotkeys'), {
      '↑': '<kbd class="hotkey">↑</kbd>',
      '↓': '<kbd class="hotkey">↓</kbd>',
      'Enter': '<kbd class="hotkey">Enter</kbd>'
    });
    document.getElementById('back-to-top').setAttribute('title', Language.get('menu.back_to_top'));
    
    document.querySelectorAll('.pcr-reset').forEach(btn => btn.value = Language.get('map.color_picker.reset'));
    document.querySelectorAll('.pcr-save').forEach(btn => btn.value = Language.get('map.color_picker.save'));

    FME.update();
    this.updateProgress();
    Menu.updateFancySelect();
  }
};