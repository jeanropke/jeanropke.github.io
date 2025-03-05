/**
 * Display various Free Mode Events.
 * 
 * Created by Richard Westenra, stripped to only display next 2 events.
 * For the full experience, please visit his websites at:
 * 
 * Website: https://www.richardwestenra.com/rdr2-free-roam-event-schedule
 * Patreon: https://www.patreon.com/bePatron?u=24592842
 * GitHub: https://github.com/richardwestenra
 * 
 * License: MIT
 */

const FME = {
  /**
   * The last retrieved events JSON
   */
  _eventsJson: null,

  /**
   * A list of notifications that have already been sent to prevent dupes.
   * Doesn't account for people refreshing just in time.
   * Maybe make this persistent later, but there's no real need for it.
   */
  _sentNotifications: [],

  /**
   * A list of flags to use for the FME enabled settings
   */
  flags: {
    none: 0,
    fme_master_archer: 1,
    fme_dispatch_rider: 2,
    fme_challenge_river_fishing: 4,
    fme_fools_gold: 8,
    fme_cold_dead_hands: 16,
    fme_king_of_the_castle: 32,
    fme_railroad_baron: 64,
    fme_challenges: 128,
    fme_role_animal_tagging: 256,
    fme_role_condor_egg: 512,
    fme_role_day_of_reckoning: 1024,
    fme_role_protect_legendary_animal: 2048,
    fme_role_manhunt: 4096,
    fme_role_trade_route: 8192,
    fme_wildlife_photographer: 16384,
    fme_role_salvage: 32768,
    fme_challenge_wild_animals_kills: 65536,
    fme_challenge_lake_fishing: 131072,
    fme_challenge_swamp_fishing: 262144,
  },

  /**
   * DOM elements for the FME card
   */
  elements: {
    general: {
      nextEventImage: document.getElementById('next-general-image'),
      nextEventName: document.getElementById('next-general-name'),
      nextEventEta: document.getElementById('next-general-eta'),
      nextEventBodyMobile: document.getElementById('next-general-mobile'),
    },
    role: {
      nextEventImage: document.getElementById('next-role-image'),
      nextEventName: document.getElementById('next-role-name'),
      nextEventEta: document.getElementById('next-role-eta'),
      nextEventBodyMobile: document.getElementById('next-role-mobile'),
    }
  },

  /**
   * Update the FME data
   * @param {Array} schedule List of event times
   */
  updateEvent: function (schedule, key) {
    const frequencies = {
      general: Settings.fmeDisplayGeneralPeriod,
      role: Settings.fmeDisplayRolePeriod
    };

    const elements = FME.elements[key];
    const frequency = FME.minutesToMilliseconds(frequencies[key]);
    let hasValidNext = false;

    schedule.forEach(function (e, i) {
      const event = FME.getEventObject(e, frequency);

      if (!(Settings.fmeEnabledEvents & FME.flags[event.name])) return;
      if (event.eta > 0 && event.eta < frequency) {
        hasValidNext = true;

        // No need to update DOM when it's not visible.
        if (Settings.isFmeDisplayEnabled) {
          const fmeName = event.nameText;
          const fmeBody = Language.get('menu.fme.time.starts_in').replace('{time}', event.etaText);

          if (elements.nextEventImage.src.filename() !== event.imageSrc.filename())
            elements.nextEventImage.src = event.imageSrc;

          elements.nextEventName.innerHTML = fmeName;
          elements.nextEventEta.innerHTML = fmeBody;
          elements.nextEventBodyMobile.innerHTML = `<span class="next-title">${fmeName}</span><span class="next-time"> - ${event.etaText}</span>`;
        }

        FME.notify(event);
      }
    });

    // Preview mode removes this element.
    const nextEvent = document.getElementById(`next-${key}-event`);
    if (nextEvent)
      nextEvent.style.display = hasValidNext ? '' : 'none';
  },

  /**
   * Convert minutes to milliseconds
   * @param {number} time Time in minutes
   * @return {number} Time in milliseconds
   */
  minutesToMilliseconds: function (time) {
    return time * 60 * 1000;
  },

  /**
   * Format the event date and perform time-zone calculations
   * @param {Array} event Event data coming from the FME.json file
   * @return {Object} Formatted event data
   */
  getEventObject: function (d, frequency) {
    const eventTime = d[0];
    const now = MapBase.mapTime().valueOf();
    const oneDay = this.minutesToMilliseconds(24 * 60);
    let dateTime = this.getDateTime(now, eventTime);
    let eta = dateTime - now;

    // Ensure that event dates are not in the past or too far
    // in the future, where timezone is not UTC
    if (eta > frequency) {
      dateTime = this.getDateTime(now - oneDay, eventTime);
      eta = dateTime - now;
    }

    // Ensure that all event dates are in the future, to fix timezone bug
    if (eta <= 0) {
      dateTime = this.getDateTime(now + oneDay, eventTime);
      eta = dateTime - now;
    }

    return {
      id: d[1],
      dateTime: dateTime,
      name: d[1],
      nameText: Language.get(`menu.fme.${d[1]}`),
      image: `${d[1]}.png`,
      imageSrc: `./assets/images/fme/${d[1]}.png`,
      eta: eta,
      etaText: FME.getEtaText(eta),
    };
  },

  getDateTime: function (date, eventTime) {
    return new Date(
      [new Date(date).toDateString(), eventTime, "UTC"].join(" ")
    );
  },

  /**
   * Display time remaining in minutes or seconds
   * @param {number} t Time in milliseconds
   * @return {string} Translated string
   */
  getEtaText: function (time) {
    time = time / 1000; // convert to seconds
    function pluralize(time) {
      return time === 1 ? '' : 's';
    }
    if (time < 60) {
      return Language.get('menu.fme.time.less_than_a_minute');
    }
    time = Math.round(time / 60); // convert to minutes
    return Language.get('menu.fme.time.minute' + pluralize(time)).replace('{minutes}', time);
  },

  /**
   * Update the FME card
   */
  update: function () {
    if (!Settings.isFmeDisplayEnabled && !Settings.isFmeNotificationEnabled) {
      FME.updateVisiblity();
      return;
    }

    if (FME._eventsJson === null) return;

    FME.updateEvent(FME._eventsJson.general, "general");
    FME.updateEvent(FME._eventsJson.role, "role");

    FME.updateVisiblity();
  },

  /**
   * Update the visibility of the FME card
   */
  updateVisiblity: function () {
    // Preview mode removes this element.
    const fmeContainer = document.getElementById('fme-container');
    if (!fmeContainer) return;
    fmeContainer.style.display = Settings.isFmeDisplayEnabled ? '' : 'none';
  },

  markNotSupported: function () {
    Settings.isFmeNotificationEnabled = false;
    const fmeNoti = document.getElementById('fme-notification');
    const fmeNotiPP = fmeNoti.parentElement.parentElement;
    fmeNoti.checked = false;
    fmeNoti.disabled = true;
    fmeNotiPP.classList.add('disabled');
    fmeNotiPP.disabled = true;
    fmeNotiPP.setAttribute('data-help', 'fme_notification.no_support');
    document.getElementById('fme-notification-period').parentElement.style.display = 'none';
  },

  markPermissionDenied: function () {
    Settings.isFmeNotificationEnabled = false;
    const fmeNoti = document.getElementById('fme-notification');
    const fmeNotiPP = fmeNoti.parentElement.parentElement;
    fmeNoti.checked = false;
    fmeNoti.disabled = true;
    fmeNotiPP.classList.add('disabled');
    fmeNotiPP.disabled = true;
    fmeNotiPP.setAttribute('data-help', 'fme_notification.denied');
    document.getElementById('fme-notification-period').parentElement.style.display = 'none';
  },

  /**
   * Retrieve the FME data from FME.json
   */
  init: function () {
    SettingProxy.addSetting(Settings, 'fmeEnabledEvents', {
      default: Object.values(FME.flags).reduce((acc, value) => acc + value, 0),
    });

    function createInputContainer({ key, min, max, value, defaultValue }) {
      const id = key.replace(/_/g, '-');
      const settingsKey = key
        .split('_')
        .map((part, idx) => idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      const container = document.querySelector(`.input-container[data-help="${key}"]`);
      const isDesktop = window.matchMedia('(min-width: 768px)').matches;
      const inputType = isDesktop ? 'range' : 'number';
  
      container.innerHTML = `
        <label for="${id}" data-text="menu.${key}"></label>
        <input id="${id}" class="input-text ${isDesktop ? 'type-range fme-type-range' : 'narrow-select-menu'}" type="${inputType}" min="${min}" max="${max}" value="${value}" data-tippy-content-range=""/>
        ${inputType === 'range' ? `<div class="type-range-tooltip"></div>` : ''}
      `;
    
      const input = document.getElementById(id);
    
      if (isDesktop) {
        const tooltip = tippy(input, {
          theme: 'menu-theme',
          content: input.value,
          trigger: 'manual',
          arrow: false,
          placement: 'top',
          offset: [0, 10],
          hideOnClick: false,
        });
  
        input.addEventListener('input', function () {
          tooltip.setContent(this.value);
          tooltip.show();
        });
        input.addEventListener('pointerdown', function () {
          tooltip.setContent(this.value);
          tooltip.show();
        });
        input.addEventListener('pointerup', () => tooltip.hide());
      }

      input.addEventListener('change', function () {
        let inputValue = parseInt(this.value);
        if (isNaN(inputValue) || inputValue < min || inputValue > max) inputValue = defaultValue;
        this.value = inputValue;
        Settings[settingsKey] = inputValue;
        if (settingsKey !== 'fmeNotificationPeriod') FME.update();
      });
    }
    
    createInputContainer({ 
      key: 'fme_display_general_period',
      min: 10, max: 45, value: 90, defaultValue: 30,
    });
    createInputContainer({
      key: 'fme_display_role_period',
      min: 10, max: 90, value: 90, defaultValue: 60,
    });
    createInputContainer({
      key: 'fme_notification_period',
      min: 1, max: 30, value: 10, defaultValue: 10,
    });

    const fmeDisplay = document.getElementById('fme-display');
    const fmeGeneralPeriod = document.getElementById('fme-display-general-period');
    const fmeRolePeriod = document.getElementById('fme-display-role-period');
    const fmeNotification = document.getElementById('fme-notification');
    const fmeNotificationPeriod = document.getElementById('fme-notification-period');
    const openFmeModal = document.getElementById('open-fme-enabled-events-modal');

    fmeDisplay.addEventListener('change', function () {
      Settings.isFmeDisplayEnabled = this.checked;
      fmeGeneralPeriod.parentElement.style.display = Settings.isFmeDisplayEnabled ? '' : 'none';
      fmeRolePeriod.parentElement.style.display = Settings.isFmeDisplayEnabled ? '' : 'none';
      openFmeModal.style.display = (Settings.isFmeDisplayEnabled || Settings.isFmeNotificationEnabled) ? '' : 'none';
      FME.update();
    });

    fmeNotification.addEventListener('change', function () {
      Settings.isFmeNotificationEnabled = this.checked;

      Notification.requestPermission().then(function (permission) {
        if (permission === "denied") {
          FME.markPermissionDenied();
        }
      });

      fmeNotificationPeriod.parentElement.style.display = Settings.isFmeNotificationEnabled ? '' : 'none';
      openFmeModal.style.display = (Settings.isFmeDisplayEnabled || Settings.isFmeNotificationEnabled) ? '' : 'none';
    });

    if (!("Notification" in window)) {
      this.markNotSupported();
    } else if (Notification.permission === "denied") {
      this.markPermissionDenied();
    }

    fmeDisplay.checked = Settings.isFmeDisplayEnabled;
    fmeGeneralPeriod.value = Settings.fmeDisplayGeneralPeriod;
    fmeGeneralPeriod.parentElement.style.display = Settings.isFmeDisplayEnabled ? '' : 'none';
    fmeRolePeriod.value = Settings.fmeDisplayRolePeriod;
    fmeRolePeriod.parentElement.style.display = Settings.isFmeDisplayEnabled ? '' : 'none';
    fmeNotification.checked = Settings.isFmeNotificationEnabled;
    fmeNotificationPeriod.value = Settings.fmeNotificationPeriod;
    fmeNotificationPeriod.parentElement.style.display = Settings.isFmeNotificationEnabled ? '' : 'none';
    openFmeModal.style.display = (Settings.isFmeDisplayEnabled || Settings.isFmeNotificationEnabled) ? '' : 'none';

    document.querySelectorAll('input[name="fme-enabled-events[]"]').forEach(function() {
      const id = this.getAttribute('id');
      this.checked = (Settings.fmeEnabledEvents && FME.flags[id]);
    });

    const fmeModal = new bootstrap.Modal(document.getElementById('fme-enabled-events-modal'));
    openFmeModal.addEventListener('click', function () {
      fmeModal.show();
    });

    return Loader.promises['fme'].consumeJson(eventsData => {
      const [general, role] = ['default', 'themed'].map(key => {
        return Object.entries(eventsData[key]).reduce((acc, [time, { name, variation }]) => {
          return [...acc, [time, variation || name]];
        }, []);
      });

      FME._eventsJson = { general, role };
      FME.update();
      FME.initModal();
      window.setInterval(FME.update, 10000);
      console.info('%c[FME] Loaded!', 'color: #bada55; background: #242424');
    });
  },

  initModal: function () {
    const fmeModalEl = document.getElementById('fme-enabled-events-modal');

    Object.keys(this.flags).forEach(f => {
      if (f === "none") return;
      const snippet = document.createElement('div');
      snippet.className = "input-container";
      snippet.innerHTML = `
          <label for="${f}" data-text="menu.fme.${f}"></label>
          <div class="input-checkbox-wrapper">
            <input class="input-checkbox" type="checkbox" name="fme-enabled-events[]" value="${this.flags[f]}"
              id="${f}" ${(Settings.fmeEnabledEvents & FME.flags[f]) ? "checked" : ""} />
            <label class="input-checkbox-label" for="${f}"></label>
          </div>
      `;

      snippet.addEventListener('change', function() {
        let total = 0;
        document.querySelectorAll('input[name="fme-enabled-events[]"]:checked').forEach(function() {
          const value = parseInt(this.value);
          total += value;
        });
        Settings.fmeEnabledEvents = total;
        FME.update();
      });

      fmeModalEl.querySelector('#events').appendChild(Language.translateDom(snippet));
    });

    const items = Array.from(fmeModalEl.querySelectorAll('#events .input-container'));
    items.sort(function(a, b) {
      return a.querySelector('label').textContent.toLowerCase().localeCompare(b.querySelector('label').textContent.toLowerCase());
    });
    items.forEach(item => fmeModalEl.querySelector('#events').appendChild(item));
  },

  /**
   * Notify a user when an event is coming up in 10 minutes
   * @param {Object} event The event to send a notification for
   */
  notify: function (event) {
    // Disabled in settings.
    if (!Settings.isFmeNotificationEnabled) return;

    // No support.
    if (!("Notification" in window)) {
      this.markNotSupported();
      return;
    }

    // Already sent.
    if (this._sentNotifications.includes(event.eventDateTime)) return;

    // Only send a notification if it's +-20 seconds away from the notification period.
    const timeMax = FME.minutesToMilliseconds(Settings.fmeNotificationPeriod);
    const timeMin = FME.minutesToMilliseconds(Settings.fmeNotificationPeriod - 0.33);
    if (!(event.eta > timeMin && event.eta < timeMax)) return;

    // Use the formatted time in case we want to change the notification period later
    const notificationBody = Language.get('notification.fme.body')
      .replace('{name}', event.nameText)
      .replace('{time}', event.etaText);

    try {
      if (Notification.permission === "granted") {
        new Notification(event.nameText, {
          body: notificationBody,
          icon: event.imageSrc,
          lang: Settings.language,
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
          if (permission === "granted") {
            new Notification(event.nameText, {
              body: notificationBody,
              icon: event.imageSrc,
              lang: Settings.language,
            });
          }
        });
      }
    } catch (error) {
      // Notifications not supported.
      this.markPermissionDenied();
    }

    if (Notification.permission === "denied") {
      this.markPermissionDenied();
    }

    // Always add this to really make sure there's no dupes, even when the user denied permissions.
    this._sentNotifications.push(event.eventDateTime);
  }
};