// ===== 今日行程（大）=====
// Scriptable 新增腳本，命名為「今日行程」

const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbyKZfyP9__lWhLjsEtSvwrfZha-7mxeYzrfFCX0fDV7je4UPPOTAEJ1b1Gl0Q2rejpf/exec';

async function fetchDB() {
  try {
    let req = new Request(CLOUD_URL + '?format=json&t=' + Date.now());
    req.timeoutInterval = 15;
    let data = await req.loadJSON();
    if (Array.isArray(data)) return data;
    if (data && data.db && Array.isArray(data.db)) return data.db;
    return [];
  } catch(e) { return []; }
}

function todayISO() {
  let d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function daysDiff(dateISO, todayISO) {
  let d1 = new Date(dateISO + 'T00:00:00');
  let d2 = new Date(todayISO + 'T00:00:00');
  return Math.round((d1 - d2) / 86400000);
}

// 同內容（date+time+memo+doneAt）只保留 updatedAt 最新的一筆
// 避免兩台裝置產生不同 id 造成「軟刪版+活版」並存，導致已完成的行程
// 在 widget 上仍顯示成「過期」
function dedupeSchedules(arr) {
  if (!Array.isArray(arr)) return [];
  let map = {};
  arr.forEach(function(s) {
    if (!s || !s.date) return;
    let k = (s.date||'') + '|' + (s.time||'') + '|' + (s.memo||'') + '|' + (s.doneAt||'');
    let cur = map[k];
    if (!cur) { map[k] = s; return; }
    // 優先保留未刪版（活版）；同為活或同為軟刪時才比 updatedAt
    let curDel = !!cur._deleted;
    let newDel = !!s._deleted;
    if (curDel !== newDel) { if (!newDel) map[k] = s; return; }
    let cu = s.updatedAt || '';
    let lu = cur.updatedAt || '';
    if (!lu || (cu && cu > lu)) map[k] = s;
  });
  return Object.keys(map).map(function(k){ return map[k]; });
}

function getToday(db) {
  let today = todayISO();
  let list = [];
  db.forEach(function(c) {
    if (c._deleted || c._system || c.archived || !c.schedules) return;
    let name = c.llName || c.ttName || c.bName || c.sName || c.cName || c.dName || c.name || '未命名';
    dedupeSchedules(c.schedules).forEach(function(s) {
      if (!s.date || s._deleted) return;
      if (s.hideBeforeDate && today < s.hideBeforeDate) return;
      if (s.date <= today) list.push({ name: name, time: s.time || '', memo: s.memo || '', date: s.date, expired: s.date < today });
    });
  });
  let ps = db.find(function(c) { return c.id === '_personalSchedules'; });
  if (ps && ps.schedules) {
    dedupeSchedules(ps.schedules).forEach(function(s) {
      if (!s.date || s._deleted) return;
      if (s.hideBeforeDate && today < s.hideBeforeDate) return;
      if (s.date <= today) list.push({ name: '📌 個人', time: s.time || '', memo: s.memo || '', date: s.date, expired: s.date < today });
    });
  }
  // 過期排前（愈早愈前），今日排後（按時間）
  list.sort(function(a, b) {
    if (a.expired !== b.expired) return a.expired ? -1 : 1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '').localeCompare(b.time || '');
  });
  list.forEach(function(s) {
    if (s.expired) s.daysAgo = -daysDiff(s.date, today);
  });
  return list;
}

async function createWidget() {
  let db = await fetchDB();
  let items = getToday(db);

  let w = new ListWidget();
  w.backgroundColor = new Color('#1C1917');
  w.setPadding(12, 14, 10, 14);

  let header = w.addStack();
  header.centerAlignContent();
  let d = new Date();
  let wk = ['日','一','二','三','四','五','六'][d.getDay()];
  let title = header.addText('📋 今日行程  ' + (d.getMonth()+1) + '/' + d.getDate() + '(' + wk + ')');
  title.font = Font.boldSystemFont(18);
  title.textColor = new Color('#FAFAF9');
  header.addSpacer();
  let cnt = header.addText(items.length + ' 筆');
  cnt.font = Font.mediumSystemFont(14);
  cnt.textColor = new Color('#A8A29E');

  w.addSpacer(6);

  if (!items.length) {
    w.addSpacer();
    let empty = w.addText('今天沒有行程 🎉');
    empty.font = Font.systemFont(18);
    empty.textColor = new Color('#78716C');
    empty.centerAlignText();
    w.addSpacer();
    return w;
  }

  // 根據行程數量動態調整大小
  let n = items.length;
  let compact = n > 6;
  let cardPadV = compact ? 4 : 6;
  let cardPadH = compact ? 10 : 12;
  let gap = compact ? 2 : 4;
  let timeFont = compact ? 14 : 16;
  let nameFont = compact ? 15 : 17;
  let memoFont = compact ? 12 : 14;
  let max = Math.min(n, 10);

  for (let i = 0; i < max; i++) {
    let s = items[i];

    let card = w.addStack();
    card.layoutVertically();
    card.setPadding(cardPadV, cardPadH, cardPadV, cardPadH);
    card.cornerRadius = 8;
    card.backgroundColor = new Color('#292524');

    let row1 = card.addStack();
    row1.centerAlignContent();
    if (s.expired) {
      let parts = s.date.split('-');
      let tag = row1.addText(parts[1] + '/' + parts[2] + (s.time ? ' ' + s.time : ''));
      tag.font = Font.boldSystemFont(timeFont);
      tag.textColor = new Color('#DC2626');
      row1.addSpacer(6);
    } else if (s.time) {
      let t = row1.addText(s.time);
      t.font = Font.boldSystemFont(timeFont);
      t.textColor = new Color('#F59E0B');
      row1.addSpacer(6);
    }
    let nm = row1.addText(s.name);
    nm.font = Font.semiboldSystemFont(nameFont);
    nm.textColor = new Color('#FAFAF9');
    nm.lineLimit = 1;
    row1.addSpacer();
    if (s.expired) {
      let exp = row1.addText('過期' + s.daysAgo + '天');
      exp.font = Font.systemFont(memoFont);
      exp.textColor = new Color('#DC2626');
    }

    if (s.memo) {
      card.addSpacer(2);
      let m = card.addText(s.memo);
      m.font = Font.systemFont(memoFont);
      m.textColor = new Color('#A8A29E');
      m.lineLimit = 1;
    }

    if (i < max - 1) w.addSpacer(gap);
  }

  if (items.length > max) {
    w.addSpacer(3);
    let more = w.addText('還有 ' + (items.length - max) + ' 筆…');
    more.font = Font.systemFont(13);
    more.textColor = new Color('#78716C');
    more.centerAlignText();
  }

  w.addSpacer();

  let footer = w.addStack();
  footer.addSpacer();
  let upd = footer.addText('更新 ' + new Date().toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit'}));
  upd.font = Font.systemFont(11);
  upd.textColor = new Color('#57534E');

  return w;
}

let widget = await createWidget();
if (config.runsInWidget) { Script.setWidget(widget); }
else { await widget.presentLarge(); }
Script.complete();
