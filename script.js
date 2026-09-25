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

  var STORE_KEY = 'ielts-ledger-entries-v1';
  var PLAN_KEY = 'ielts-ledger-planstart-v1';

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
} catch(err){
  var eb = document.getElementById('errBox');
  if (eb){ eb.textContent = 'Init error: ' + err.message; eb.style.display = 'block'; }
}
})();
