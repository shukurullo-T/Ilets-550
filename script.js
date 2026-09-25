window.addEventListener('error', function(e){
  var b = document.getElementById('errBox');
  if (b){ b.textContent = 'Something went wrong: ' + e.message; b.style.display = 'block'; }
});

(function(){
try{
  var TOTAL_BUDGET = 550;
  var CATEGORIES = [
    { id: 'reading',   name: 'Reading',         sub: 'Passages & comprehension', target: 110 },
    { id: 'listening', name: 'Listening',       sub: 'Audio & note-taking',      target: 100 },
    { id: 'writing',   name: 'Writing',         sub: 'Task 1 & Task 2',          target: 140 },
    { id: 'speaking',  name: 'Speaking',        sub: 'Fluency & response',       target: 130 },
    { id: 'media',     name: 'YouTube / Movies',sub: 'Free immersion',          target: 70  }
  ];

  var LEGACY_STORE_KEY = 'ielts-ledger-entries-v1';
  var LEGACY_PLAN_KEY = 'ielts-ledger-planstart-v1';
  var ACCOUNTS_KEY = 'ielts-ledger-accounts-v1';
  var LAST_NAME_KEY = 'ielts-ledger-lastname-v1';
  var STORE_KEY, PLAN_KEY;
  var started = false;

  // ---------- Name + code gate ----------
  // The user signs up with just a name (no surname) and a personal code, and
  // enters with the same pair next time. Only a hash of name + code is stored,
  // and each account gets its own ledger in localStorage.
  function sha256(text){
    if (window.crypto && crypto.subtle && window.TextEncoder){
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function(buf){
        return Array.prototype.map.call(new Uint8Array(buf), function(b){
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    // Fallback for browsers without SubtleCrypto
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return Promise.resolve('f' + h.toString(16));
  }
  function accountId(nameKey, code){
    return sha256('ielts-550:' + JSON.stringify([nameKey, code]));
  }
  function cleanName(name){ return name.trim().replace(/\s+/g, ' '); }
  function loadAccounts(){
    try {
      var parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){ return []; }
  }
  function saveAccounts(list){
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); return true; }
    catch(e){ return false; }
  }
  function findAccount(list, key){
    for (var i = 0; i < list.length; i++){
      if (list[i] && list[i].key === key) return list[i];
    }
    return null;
  }
  // Data logged before accounts existed goes to the first account created.
  function adoptLegacyData(id){
    try {
      [[LEGACY_STORE_KEY, 'ielts-ledger-entries-v1:'], [LEGACY_PLAN_KEY, 'ielts-ledger-planstart-v1:']]
        .forEach(function(pair){
          var raw = localStorage.getItem(pair[0]);
          if (raw !== null){
            localStorage.setItem(pair[1] + id, raw);
            localStorage.removeItem(pair[0]);
          }
        });
    } catch(e){}
  }

  var gate = document.getElementById('gate');
  var gateMsg = document.getElementById('gateMsg');
  var tabLogin = document.getElementById('tabLogin');
  var tabCreate = document.getElementById('tabCreate');
  var loginForm = document.getElementById('loginForm');
  var createForm = document.getElementById('createForm');
  var loginName = document.getElementById('loginName');
  var loginCode = document.getElementById('loginCode');
  var newName = document.getElementById('newName');
  var newCode = document.getElementById('newCode');
  var newCode2 = document.getElementById('newCode2');

  // Eye button in the corner of a code field: shows or hides what was typed,
  // so the user can check the code before entering.
  var EYE_ICONS =
    '<svg class="eye-show" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
    '<svg class="eye-hide" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';
  function addRevealToggle(input){
    var wrap = document.createElement('div');
    wrap.className = 'code-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-eye';
    btn.innerHTML = EYE_ICONS;
    function sync(){
      var shown = input.type === 'text';
      btn.setAttribute('aria-pressed', shown ? 'true' : 'false');
      btn.setAttribute('aria-label', shown ? 'Hide code' : 'Show code');
      btn.title = shown ? 'Hide code' : 'Show code';
    }
    // Keep the cursor in the field when the eye is clicked
    btn.addEventListener('mousedown', function(ev){ ev.preventDefault(); });
    btn.addEventListener('click', function(){
      var start = input.selectionStart, end = input.selectionEnd;
      input.type = input.type === 'password' ? 'text' : 'password';
      // Chrome sends the cursor to the start when it lays the field out again
      // after a type switch, so force that layout now and then put it back
      if (document.activeElement === input){
        void input.offsetWidth;
        try { input.setSelectionRange(start, end); } catch(e){}
      }
      sync();
    });
    sync();
    wrap.appendChild(btn);
  }
  [loginCode, newCode, newCode2].forEach(addRevealToggle);

  function fail(msg, field){
    gateMsg.textContent = msg;
    if (field) field.focus();
  }

  function showTab(create){
    tabLogin.classList.toggle('active', !create);
    tabCreate.classList.toggle('active', create);
    loginForm.hidden = create;
    createForm.hidden = !create;
    gateMsg.textContent = '';
    if (create) newName.focus();
    else (loginName.value ? loginCode : loginName).focus();
  }
  tabLogin.addEventListener('click', function(){ showTab(false); });
  tabCreate.addEventListener('click', function(){ showTab(true); });

  loginForm.addEventListener('submit', function(ev){
    ev.preventDefault();
    var name = cleanName(loginName.value);
    var code = loginCode.value;
    if (!name) return fail('Please enter your name.', loginName);
    if (!code) return fail('Please enter your code.', loginCode);
    var acc = findAccount(loadAccounts(), name.toLowerCase());
    if (!acc) return fail('No ledger with this name yet. Check the spelling, or create a new one.', loginName);
    accountId(acc.key, code).then(function(id){
      if (id !== acc.id) return fail('Wrong code. Tap the eye to see what you typed.', loginCode);
      startApp(acc);
    });
  });

  createForm.addEventListener('submit', function(ev){
    ev.preventDefault();
    var name = cleanName(newName.value);
    var code = newCode.value;
    if (!name) return fail('Please enter your name.', newName);
    if (code.length < 4) return fail('The code must be at least 4 characters.', newCode);
    if (code !== newCode2.value) return fail('The two codes do not match. Tap the eye to check them.', newCode2);
    var key = name.toLowerCase();
    accountId(key, code).then(function(id){
      var accounts = loadAccounts();
      if (findAccount(accounts, key)) return fail('This name is already taken. Log in with it, or choose another name.', newName);
      var acc = { key: key, name: name, id: id };
      if (accounts.length === 0) adoptLegacyData(id);
      accounts.push(acc);
      if (!saveAccounts(accounts)) return fail('Could not save your account in this browser.');
      startApp(acc);
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', function(){
    location.reload();
  });

  try { loginName.value = localStorage.getItem(LAST_NAME_KEY) || ''; } catch(e){}
  showTab(loadAccounts().length === 0);

  function startApp(acc){
    // Guard against a double-clicked Enter attaching every handler twice
    if (started) return;
    started = true;
    try { localStorage.setItem(LAST_NAME_KEY, acc.name); } catch(e){}
    STORE_KEY = 'ielts-ledger-entries-v1:' + acc.id;
    PLAN_KEY = 'ielts-ledger-planstart-v1:' + acc.id;
    document.getElementById('whoLabel').textContent = 'Personal study ledger · ' + acc.name;
    gate.hidden = true;
    document.getElementById('app').hidden = false;

    function loadEntries(){
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch(e){ return []; }
    }
    function saveEntries(list){
      try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
      catch(e){ console.error('Could not save:', e); }
    }
    function loadPlanStart(){
      try {
        var raw = localStorage.getItem(PLAN_KEY);
        if (raw) return raw;
        var today = new Date().toISOString().slice(0,10);
        localStorage.setItem(PLAN_KEY, today);
        return today;
      } catch(e){
        return new Date().toISOString().slice(0,10);
      }
    }

    var entries = loadEntries();
    var planStart = loadPlanStart();

    var catSelect = document.getElementById('catSelect');
    CATEGORIES.forEach(function(c){
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });

    var dateInput = document.getElementById('dateInput');
    dateInput.value = new Date().toISOString().slice(0,10);
    dateInput.max = new Date().toISOString().slice(0,10);

    function fmt(n){
      var r = Math.round(n * 4) / 4;
      return (r % 1 === 0) ? r.toFixed(0) : r.toFixed(2).replace(/0$/,'');
    }

    function totalsByCategory(){
      var totals = {};
      CATEGORIES.forEach(function(c){ totals[c.id] = 0; });
      entries.forEach(function(e){
        if (totals.hasOwnProperty(e.cat)) totals[e.cat] += Number(e.hours) || 0;
      });
      return totals;
    }

    function render(){
      var totals = totalsByCategory();
      var totalLogged = Object.keys(totals).reduce(function(s,k){ return s + totals[k]; }, 0);
      var remaining = TOTAL_BUDGET - totalLogged;

      // Hero
      document.getElementById('remainingNum').innerHTML =
        fmt(Math.max(remaining,0)) + '<sup>hrs</sup>';
      var pct = Math.min(100, Math.round((totalLogged / TOTAL_BUDGET) * 100));
      document.getElementById('remainingLabel').textContent =
        remaining <= 0
          ? 'the full 550-hour budget is used up'
          : pct + '% used · ' + fmt(remaining) + ' hours left';

      // Pace
      var start = new Date(planStart);
      var now = new Date();
      var dayMs = 24*60*60*1000;
      var daysElapsed = Math.floor((now - start) / dayMs);
      var planDays = 90;
      var daysLeft = Math.max(planDays - daysElapsed, 1);
      var paceNum = document.getElementById('paceNum');
      var paceLabel = document.getElementById('paceLabel');
      if (remaining <= 0){
        paceLabel.textContent = 'Result';
        paceNum.textContent = 'Budget complete';
        paceNum.className = 'pace-ok';
      } else {
        var perDay = remaining / daysLeft;
        paceLabel.textContent = 'Pace for the next ' + daysLeft + ' days';
        paceNum.textContent = fmt(perDay) + ' hrs/day';
        paceNum.className = perDay > 6 ? 'pace-warn' : 'pace-ok';
      }

      // Category ledger
      var ledger = document.getElementById('categoryLedger');
      ledger.innerHTML = '';
      CATEGORIES.forEach(function(c){
        var logged = totals[c.id];
        var pctCat = Math.min(100, Math.round((logged / c.target) * 100));
        var over = logged > c.target;
        var row = document.createElement('div');
        row.className = 'row';
        row.innerHTML =
          '<div class="row-name">' + c.name + '<small>' + c.sub + '</small></div>' +
          '<div class="track"><div class="fill' + (over ? ' over' : '') + '" style="width:' + pctCat + '%"></div></div>' +
          '<div class="row-nums"><b>' + fmt(logged) + '</b> hrs</div>';
        ledger.appendChild(row);
      });

      // History
      var historyList = document.getElementById('historyList');
      historyList.innerHTML = '';
      if (entries.length === 0){
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No sessions logged yet — add your first one above.';
        historyList.appendChild(empty);
      } else {
        var sorted = entries.slice().sort(function(a,b){
          return (b.date + b.id) > (a.date + a.id) ? 1 : -1;
        });
        sorted.forEach(function(e){
          var cat = CATEGORIES.find(function(c){ return c.id === e.cat; });
          var row = document.createElement('div');
          row.className = 'entry';
          var dateDisp = e.date.slice(5).split('-').reverse().join('.');
          row.innerHTML =
            '<div class="e-date">' + dateDisp + '</div>' +
            '<div class="e-cat">' + (cat ? cat.name : e.cat) +
              (e.note ? '<small>' + escapeHtml(e.note) + '</small>' : '') + '</div>' +
            '<div class="e-hours">' + fmt(e.hours) + ' hrs</div>' +
            '<button class="e-del" title="Delete" data-id="' + e.id + '">\u2715</button>';
          historyList.appendChild(row);
        });
      }

      // Plan footer
      var planSpan = document.getElementById('planSpan');
      var startDisp = planStart.slice(5).split('-').reverse().join('.') + '.' + planStart.slice(0,4);
      planSpan.textContent = 'Plan started ' + startDisp + ' · 90-day (3-month) plan';
    }

    function escapeHtml(s){
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    document.getElementById('addBtn').addEventListener('click', function(){
      var cat = catSelect.value;
      var hoursRaw = document.getElementById('hoursInput').value.trim().replace(',', '.');
      var hours = parseFloat(hoursRaw);
      var date = dateInput.value;
      var note = document.getElementById('noteInput').value.trim();
      if (!cat || !hours || isNaN(hours) || hours <= 0){
        alert('Please enter a valid number of hours (e.g. 2.5).');
        return;
      }
      if (!date){
        alert('Please pick a date.');
        return;
      }

      entries.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        cat: cat, hours: hours, date: date, note: note
      });
      saveEntries(entries);
      document.getElementById('hoursInput').value = '';
      document.getElementById('noteInput').value = '';
      render();
    });

    document.getElementById('historyList').addEventListener('click', function(ev){
      var btn = ev.target.closest('.e-del');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      entries = entries.filter(function(e){ return e.id !== id; });
      saveEntries(entries);
      render();
    });

    document.getElementById('resetBtn').addEventListener('click', function(){
      if (!confirm('Clear every logged session? This cannot be undone.')) return;
      entries = [];
      saveEntries(entries);
      try { localStorage.removeItem(PLAN_KEY); } catch(e){}
      planStart = loadPlanStart();
      render();
    });

    render();
  }
} catch(err){
  var eb = document.getElementById('errBox');
  if (eb){ eb.textContent = 'Init error: ' + err.message; eb.style.display = 'block'; }
}
})();
