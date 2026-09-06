/* =====================================================================
   Timezone Converter Pro — app.js
   Convert a date+time across IANA timezones using only the built-in
   Intl API (no bundled tz database), plus a meeting-planner timeline.
   Classic script (no modules). Depends on window.WUS (core.js).
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'tzconv.state';

  var DEFAULT_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

  /* ----------------------------- DOM refs ---------------------------- */
  var sourceDate    = document.getElementById('sourceDate');
  var sourceZone    = document.getElementById('sourceZone');
  var sourceSummary = document.getElementById('sourceSummary');
  var btnNow        = document.getElementById('btnNow');
  var btnUseLocal   = document.getElementById('btnUseLocal');
  var tzList        = document.getElementById('tzList');

  var zoneInput   = document.getElementById('zoneInput');
  var btnAddZone  = document.getElementById('btnAddZone');
  var zoneChips   = document.getElementById('zoneChips');

  var resultsGrid  = document.getElementById('resultsGrid');
  var resultsEmpty = document.getElementById('resultsEmpty');
  var btnCopySummary = document.getElementById('btnCopySummary');

  var workStart = document.getElementById('workStart');
  var workEnd   = document.getElementById('workEnd');
  var timelineHeader = document.getElementById('timelineHeader');
  var timelineRows   = document.getElementById('timelineRows');
  var timelineEmpty  = document.getElementById('timelineEmpty');

  var statusBadge = document.getElementById('statusBadge');
  var statusText  = document.getElementById('statusText');

  var LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  /* =================================================================
     TIMEZONE LIST (from Intl, no bundled data)
     ================================================================= */
  var ALL_ZONES = [];
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      ALL_ZONES = Intl.supportedValuesOf('timeZone');
    }
  } catch (e) { ALL_ZONES = []; }
  if (!ALL_ZONES || !ALL_ZONES.length) {
    // Minimal fallback for older engines without Intl.supportedValuesOf.
    ALL_ZONES = [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul',
      'Europe/Moscow', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata',
      'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
      'Australia/Sydney', 'Pacific/Auckland', LOCAL_ZONE
    ];
  }

  function isValidZone(z) {
    if (!z) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; }
    catch (e) { return false; }
  }

  function populateZoneDatalist() {
    var html = '';
    for (var i = 0; i < ALL_ZONES.length; i++) {
      html += '<option value="' + WUS.escapeHtml(ALL_ZONES[i]) + '"></option>';
    }
    tzList.innerHTML = html;
  }

  /* =================================================================
     CORE TZ MATH
     Given a *wall-clock* date/time and an IANA zone, find the UTC
     instant (epoch ms) whose local representation in that zone equals
     the given wall clock. DST-aware: iterates because the zone's UTC
     offset can itself depend on which instant we're asking about.
     ================================================================= */

  // Turn an epoch instant into {year,month,day,hour,minute,second} as seen in `timeZone`.
  function partsInZone(epochMs, timeZone) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      weekday: 'short'
    });
    var parts = dtf.formatToParts(new Date(epochMs));
    var map = {};
    for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    return map;
  }

  // Epoch ms if the fields in `map` (from partsInZone) were interpreted as UTC.
  function partsAsUtcMs(map) {
    var h = Number(map.hour);
    var dayAdd = 0;
    if (h === 24) { h = 0; dayAdd = 1; } // rare engine quirk guard
    var ms = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), h, Number(map.minute), Number(map.second));
    if (dayAdd) ms += 86400000;
    return ms;
  }

  // Offset (ms) such that: localWallClockAsUtcMs = epochMs + offset
  function offsetMsAt(epochMs, timeZone) {
    return partsAsUtcMs(partsInZone(epochMs, timeZone)) - epochMs;
  }

  // Convert a wall-clock (y, mo0-based, d, h, mi, s) *in* timeZone to a UTC epoch ms.
  function zonedTimeToUtc(y, mo, d, h, mi, s, timeZone) {
    var wallAsUtc = Date.UTC(y, mo, d, h, mi, s);
    var guess = wallAsUtc;
    // A few iterations converge even across DST transitions in practice.
    for (var i = 0; i < 3; i++) {
      var offset = offsetMsAt(guess, timeZone);
      var next = wallAsUtc - offset;
      if (next === guess) break;
      guess = next;
    }
    return guess;
  }

  function offsetLabel(epochMs, timeZone) {
    var mins = Math.round(offsetMsAt(epochMs, timeZone) / 60000);
    var sign = mins < 0 ? '-' : '+';
    mins = Math.abs(mins);
    var hh = Math.floor(mins / 60);
    var mm = mins % 60;
    return 'UTC' + sign + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  var DATE_FMT_CACHE = {};
  function fullFormat(epochMs, timeZone) {
    var key = timeZone;
    var dtf = DATE_FMT_CACHE[key];
    if (!dtf) {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone, hourCycle: 'h23',
        weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      DATE_FMT_CACHE[key] = dtf;
    }
    return dtf.format(new Date(epochMs));
  }

  function timeOnly(epochMs, timeZone) {
    var dtf = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
    return dtf.format(new Date(epochMs));
  }

  function dateOnly(epochMs, timeZone) {
    var dtf = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });
    return dtf.format(new Date(epochMs));
  }

  function zoneAbbr(epochMs, timeZone) {
    try {
      var dtf = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, timeZoneName: 'short', hour: '2-digit' });
      var parts = dtf.formatToParts(new Date(epochMs));
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') return parts[i].value;
    } catch (e) {}
    return '';
  }

  function localHour(epochMs, timeZone) {
    var dtf = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, hourCycle: 'h23', hour: '2-digit' });
    return Number(dtf.format(new Date(epochMs)));
  }

  /* =================================================================
     STATE
     ================================================================= */
  var state = {
    zones: DEFAULT_ZONES.slice(),
    workStart: 9,
    workEnd: 17
  };

  function readSourceInputParts() {
    var v = sourceDate.value; // "YYYY-MM-DDTHH:MM"
    if (!v) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
    if (!m) return null;
    return {
      y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]),
      h: Number(m[4]), mi: Number(m[5])
    };
  }

  function currentSourceZone() {
    var z = sourceZone.value.trim();
    return isValidZone(z) ? z : LOCAL_ZONE;
  }

  function sourceEpochMs() {
    var p = readSourceInputParts();
    if (!p) return null;
    return zonedTimeToUtc(p.y, p.mo, p.d, p.h, p.mi, 0, currentSourceZone());
  }

  /* =================================================================
     WORKING HOURS SELECTS
     ================================================================= */
  function buildHourOptions(select, selected) {
    var html = '';
    for (var h = 0; h < 24; h++) {
      html += '<option value="' + h + '"' + (h === selected ? ' selected' : '') + '">' + String(h).padStart(2, '0') + ':00</option>';
    }
    select.innerHTML = html;
  }

  /* =================================================================
     ZONE CHIPS
     ================================================================= */
  function addZone(z) {
    z = (z || '').trim();
    if (!z) { WUS.toast('Enter a timezone name', 'error'); return; }
    if (!isValidZone(z)) { WUS.toast('Unknown timezone: ' + z, 'error'); return; }
    if (state.zones.indexOf(z) > -1) { WUS.toast(z + ' is already added', 'error'); return; }
    state.zones.push(z);
    zoneInput.value = '';
    persist();
    render();
    WUS.toast('Added ' + z);
  }

  function removeZone(z) {
    var idx = state.zones.indexOf(z);
    if (idx === -1) return;
    state.zones.splice(idx, 1);
    persist();
    render();
  }

  function renderChips() {
    var html = '';
    var srcZ = currentSourceZone();
    state.zones.forEach(function (z) {
      html += '<span class="zone-chip' + (z === srcZ ? ' is-source' : '') + '">' +
        WUS.escapeHtml(z) +
        '<button class="zone-chip-remove" data-zone="' + WUS.escapeHtml(z) + '" title="Remove ' + WUS.escapeHtml(z) + '" aria-label="Remove ' + WUS.escapeHtml(z) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button></span>';
    });
    zoneChips.innerHTML = html;
    var btns = zoneChips.querySelectorAll('.zone-chip-remove');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { removeZone(this.getAttribute('data-zone')); });
    }
  }

  /* =================================================================
     RESULTS GRID
     ================================================================= */
  function renderResults(epochMs) {
    if (epochMs === null || !state.zones.length) {
      resultsGrid.innerHTML = '';
      resultsEmpty.hidden = false;
      return;
    }
    resultsEmpty.hidden = true;
    var srcZ = currentSourceZone();
    var html = '';
    state.zones.forEach(function (z) {
      var isSrc = z === srcZ;
      html += '<div class="result-card' + (isSrc ? ' is-source' : '') + '">' +
        '<div class="result-card-head">' +
          '<div><span class="result-zone">' + WUS.escapeHtml(z) + '</span>' +
          '<span class="result-zone-abbr">' + WUS.escapeHtml(zoneAbbr(epochMs, z) || (isSrc ? 'Source' : '')) + '</span></div>' +
          '<button class="result-card-remove" data-zone="' + WUS.escapeHtml(z) + '" title="Remove" aria-label="Remove ' + WUS.escapeHtml(z) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
        '<div class="result-time mono">' + timeOnly(epochMs, z) + '</div>' +
        '<div class="result-date">' + dateOnly(epochMs, z) + '</div>' +
        '<div class="result-offset"><span class="badge">' + offsetLabel(epochMs, z) + '</span></div>' +
      '</div>';
    });
    resultsGrid.innerHTML = html;
    var btns = resultsGrid.querySelectorAll('.result-card-remove');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { removeZone(this.getAttribute('data-zone')); });
    }
  }

  function buildSummaryText(epochMs) {
    if (epochMs === null || !state.zones.length) return '';
    var lines = [];
    state.zones.forEach(function (z) {
      lines.push(z + ': ' + fullFormat(epochMs, z) + ' (' + offsetLabel(epochMs, z) + ')');
    });
    return lines.join('\n');
  }

  /* =================================================================
     MEETING PLANNER TIMELINE
     24 hourly UTC instants spanning the source zone's local calendar
     day, formatted into each target zone.
     ================================================================= */
  function renderTimeline(epochMs) {
    if (epochMs === null || !state.zones.length) {
      timelineHeader.innerHTML = '';
      timelineRows.innerHTML = '';
      timelineEmpty.hidden = false;
      return;
    }
    timelineEmpty.hidden = true;

    var srcZ = currentSourceZone();
    var p = readSourceInputParts();
    var dayStartMs = zonedTimeToUtc(p.y, p.mo, p.d, 0, 0, 0, srcZ);
    var ticks = [];
    for (var i = 0; i < 24; i++) ticks.push(dayStartMs + i * 3600000);

    // Header row.
    var headHtml = '<div class="tl-label">Timezone</div>';
    ticks.forEach(function (t, i) {
      headHtml += '<div class="tl-hour">' + String(i).padStart(2, '0') + '</div>';
    });
    timelineHeader.innerHTML = headHtml;

    var now = Date.now();
    var nowIdx = -1;
    if (now >= dayStartMs && now < dayStartMs + 86400000) {
      nowIdx = Math.floor((now - dayStartMs) / 3600000);
    }

    var rowsHtml = '';
    state.zones.forEach(function (z) {
      rowsHtml += '<div class="timeline-row">';
      rowsHtml += '<div class="timeline-row-zone">' + WUS.escapeHtml(z) +
        '<span class="tl-zone-offset">' + offsetLabel(epochMs, z) + '</span></div>';
      ticks.forEach(function (t, i) {
        var lh = localHour(t, z);
        var isWork = state.workStart < state.workEnd
          ? (lh >= state.workStart && lh < state.workEnd)
          : (lh >= state.workStart || lh < state.workEnd); // wraps past midnight
        var cls = 'tl-cell' + (isWork ? ' is-working' : '') + (i === nowIdx ? ' is-now' : '');
        rowsHtml += '<div class="' + cls + '" title="' + WUS.escapeHtml(z) + ' — ' + String(lh).padStart(2, '0') + ':00">' + String(lh).padStart(2, '0') + '</div>';
      });
      rowsHtml += '</div>';
    });
    timelineRows.innerHTML = rowsHtml;
  }

  /* =================================================================
     STATUS BADGE + SOURCE SUMMARY
     ================================================================= */
  function updateStatus() {
    statusText.textContent = 'Local: ' + LOCAL_ZONE;
  }

  function updateSourceSummary(epochMs) {
    if (epochMs === null) { sourceSummary.textContent = ''; return; }
    var srcZ = currentSourceZone();
    sourceSummary.textContent = fullFormat(epochMs, srcZ) + ' ' + srcZ + ' (' + offsetLabel(epochMs, srcZ) + ')';
  }

  /* =================================================================
     RENDER
     ================================================================= */
  function render() {
    renderChips();
    var epochMs = sourceEpochMs();
    updateSourceSummary(epochMs);
    renderResults(epochMs);
    renderTimeline(epochMs);
  }

  /* =================================================================
     ACTIONS
     ================================================================= */
  function jumpToNow() {
    // Show "now" as wall-clock time *in the currently selected source zone*,
    // not the browser's local zone — otherwise, whenever the source zone
    // differs from the visitor's own timezone, this jumps to the wrong
    // instant (off by the difference between the two zones' UTC offsets).
    var p = partsInZone(Date.now(), currentSourceZone());
    sourceDate.value = p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
    persist();
    render();
  }

  function useLocalZone() {
    sourceZone.value = LOCAL_ZONE;
    persist();
    render();
    WUS.toast('Source set to ' + LOCAL_ZONE);
  }

  function copySummary() {
    var epochMs = sourceEpochMs();
    var text = buildSummaryText(epochMs);
    if (!text) { WUS.toast('Nothing to copy yet', 'error'); return; }
    var header = 'Source: ' + fullFormat(epochMs, currentSourceZone()) + ' ' + currentSourceZone();
    WUS.copy(header + '\n\n' + text, 'Summary copied to clipboard');
  }

  /* =================================================================
     PERSISTENCE
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, {
      sourceDate: sourceDate.value,
      sourceZone: sourceZone.value,
      zones: state.zones,
      workStart: state.workStart,
      workEnd: state.workEnd
    });
  }
  var persistDebounced = WUS.debounce(persist, 300);

  function restore() {
    var saved = WUS.store.get(STORE_KEY, null);
    if (saved) {
      if (typeof saved.sourceZone === 'string') sourceZone.value = saved.sourceZone;
      if (Array.isArray(saved.zones) && saved.zones.length) state.zones = saved.zones.filter(isValidZone);
      if (typeof saved.workStart === 'number') state.workStart = saved.workStart;
      if (typeof saved.workEnd === 'number') state.workEnd = saved.workEnd;
      if (typeof saved.sourceDate === 'string' && saved.sourceDate) sourceDate.value = saved.sourceDate;
    }
    if (!sourceZone.value) sourceZone.value = LOCAL_ZONE;
    if (!sourceDate.value) jumpToNow();
    if (!state.zones.length) state.zones = DEFAULT_ZONES.slice();
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose    = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
    { keys: ['N'], desc: 'Jump to current date & time' },
    { keys: ['mod', 'K'], desc: 'Focus "Add timezone" field' },
    { keys: ['mod', 'L'], desc: 'Use my local timezone as source' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close dialog' }
  ];

  function buildShortcutTable() {
    var html = '';
    SHORTCUTS.forEach(function (s) {
      var kbds = s.keys.map(function (k) { return '<kbd>' + WUS.escapeHtml(k) + '</kbd>'; }).join('');
      html += '<tr><td>' + WUS.escapeHtml(s.desc) + '</td><td>' + kbds + '</td></tr>';
    });
    shortcutRows.innerHTML = html;
  }

  function openHelp() { helpBackdrop.hidden = false; helpClose.focus(); }
  function closeHelp() { helpBackdrop.hidden = true; }

  helpClose.addEventListener('click', closeHelp);
  helpBackdrop.addEventListener('click', function (e) { if (e.target === helpBackdrop) closeHelp(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp(); });

  var helpBtns = document.querySelectorAll('[data-shortcut-help]');
  for (var i = 0; i < helpBtns.length; i++) helpBtns[i].addEventListener('click', openHelp);

  /* =================================================================
     WIRING
     ================================================================= */
  populateZoneDatalist();
  buildHourOptions(workStart, state.workStart);
  buildHourOptions(workEnd, state.workEnd);

  sourceDate.addEventListener('input', function () { persistDebounced(); render(); });
  sourceZone.addEventListener('input', function () { persistDebounced(); render(); });
  sourceZone.addEventListener('change', function () {
    if (sourceZone.value && !isValidZone(sourceZone.value.trim())) {
      WUS.toast('Unknown timezone — using ' + LOCAL_ZONE + ' instead', 'error');
    }
    persist(); render();
  });

  btnNow.addEventListener('click', jumpToNow);
  btnUseLocal.addEventListener('click', useLocalZone);

  btnAddZone.addEventListener('click', function () { addZone(zoneInput.value); });
  zoneInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addZone(zoneInput.value); }
  });

  btnCopySummary.addEventListener('click', copySummary);

  workStart.addEventListener('change', function () {
    state.workStart = Number(workStart.value);
    persist(); render();
  });
  workEnd.addEventListener('change', function () {
    state.workEnd = Number(workEnd.value);
    persist(); render();
  });

  WUS.registerShortcut('n', function () { jumpToNow(); }, 'Jump to current date & time');
  WUS.registerShortcut('mod+k', function () { zoneInput.focus(); }, 'Focus "Add timezone" field');
  WUS.registerShortcut('mod+l', function () { useLocalZone(); }, 'Use my local timezone as source');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  updateStatus();
  restore();
  render();

  // Keep "now" highlight in the timeline fresh.
  setInterval(function () { renderTimeline(sourceEpochMs()); }, 60000);
})();
