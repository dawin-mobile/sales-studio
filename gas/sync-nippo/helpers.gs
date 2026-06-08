// ============================================================
//  helpers.gs
//  【役割】他のファイルから呼び出される共通の内部処理をまとめたファイル
//
//  基本的に触らなくてOKです。
//  シフト照合・名前正規化・メール送信・地域/星座変換など、
//  複数の機能で使い回している処理が入っています。
//
//  また、スプレッドシートを手動で編集したときに
//  該当シートを即時DBへ同期する onEditTrigger もここにあります。
// ============================================================

// Gmailを使ってTalknoteアドレス宛にメールを送る
function sendEmailToTalknote_(toEmail, subject, body) {
  if (!toEmail || !toEmail.includes('@')) return;
  try {
    GmailApp.sendEmail(toEmail, subject, body, { name: 'Dawin Bot' });
  } catch (e) {
    Logger.log('[メール送信] エラー: ' + e.message);
  }
}

// スタッフ情報シートから「シフト名 → メールアドレス」のマップを作成
function getStaffMap_(config) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(config.idSheetName);
  if (!sheet) return {};
  const m = {};
  let isFirst = true;
  for (let row of sheet.getDataRange().getValues()) {
    if (isFirst) { isFirst = false; continue; }
    let shiftName = null, email = null, c = 0;
    for (let val of row) {
      if (c === 5)  shiftName = normalizeName_(val);  // F列：シフト名
      if (c === 15) email     = String(val).trim();   // P列：Talknoteアドレス
      c++;
    }
    if (shiftName && email && email.includes('@')) m[shiftName] = email;
  }
  return m;
}

// 指定日に日報を提出済みのスタッフ名一覧を取得
function getSubmittedNames_(targetDate, config) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(config.reportSheetName);
  if (!sheet) return [];
  const names = [];
  let isFirst = true;
  for (let row of sheet.getDataRange().getValues()) {
    if (isFirst) { isFirst = false; continue; }
    let dateVal = null, nameVal = null, c = 0;
    for (let val of row) {
      if (c === 1) dateVal = val;
      if (c === 2) nameVal = val;
      c++;
    }
    if (dateVal && isSameDate_(new Date(dateVal), targetDate)) {
      const nm = normalizeName_(nameVal);
      if (nm.length > 0) names.push(nm);
    }
  }
  return names;
}

// シフト表から「指定日に出勤予定かつ日報未提出」のスタッフ名一覧を取得
function getUnsubmittedNames_(targetDate, submittedNames, config) {
  let ss; try { ss = SpreadsheetApp.openById(config.shiftSheetId); } catch(e) { return []; }
  const remindList = [];

  const targetSheetNames = [];
  config.shiftSheetNames.forEach(base => {
    targetSheetNames.push(Utilities.formatDate(targetDate, 'Asia/Tokyo', 'yy') + '年' + Utilities.formatDate(targetDate, 'Asia/Tokyo', 'M') + '月' + base);
    const prev = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    targetSheetNames.push(Utilities.formatDate(prev, 'Asia/Tokyo', 'yy') + '年' + Utilities.formatDate(prev, 'Asia/Tokyo', 'M') + '月' + base);
  });

  targetSheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    let activeCols = [], timeColIdx = 4;

    let rCount = 0;
    for (let row of data) {
      if (rCount >= 10) break;
      let tempCols = [], tempTimeIdx = 4, c = 0;
      for (let val of row) {
        const cleanVal = String(val).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '');
        if (config.targetHeaderNames.includes(cleanVal)) tempCols.push(c);
        if (cleanVal === '時間') tempTimeIdx = c;
        c++;
      }
      if (tempCols.length >= 1) { activeCols = tempCols; timeColIdx = tempTimeIdx; break; }
      rCount++;
    }
    if (activeCols.length === 0) return;

    let currentShiftDate = null;
    for (let row of data) {
      let cellA = null, timeCell = '', c = 0;
      for (let v of row) {
        if (c === 0)          cellA    = v;
        if (c === timeColIdx) timeCell = String(v);
        c++;
      }
      if (Object.prototype.toString.call(cellA) === '[object Date]') currentShiftDate = cellA;
      else if (cellA !== '') currentShiftDate = null;

      if (!currentShiftDate || !isSameDate_(currentShiftDate, targetDate)) continue;
      if (config.ignoreRowWords.some(w => timeCell.includes(w)) || !/[0-9]/.test(timeCell)) continue;

      activeCols.forEach(colIdx => {
        let nameRaw = null, c = 0;
        for (let v of row) { if (c === colIdx) { nameRaw = v; break; } c++; }
        const name = normalizeName_(nameRaw);
        const isIgnore = /^[0-9０-９\.]+$/.test(name)
          || config.ignoreWords.some(w => name.includes(w))
          || config.distinctPrefixes.some(p => name.startsWith(p))
          || config.ignoreSuffixes.some(s => name.endsWith(s));
        if (!isIgnore && name && name.length > 1) {
          if (!submittedNames.some(sub => isNameMatch_(name, sub)) && !remindList.includes(name)) {
            remindList.push(name);
          }
        }
      });
    }
  });
  return remindList;
}

// 2つの名前が同一人物か判定（部分一致・前方一致で照合）
function isNameMatch_(nameA, nameB) {
  if (!nameA || !nameB || nameA.length === 0 || nameB.length === 0) return false;
  for (const p of DAWIN.distinctPrefixes) {
    if (nameA.startsWith(p) !== nameB.startsWith(p)) return false;
  }
  // 同姓別人の個別対応
  if (nameA === '大野' && nameB.startsWith('大野賀')) return false;
  if (nameB === '大野' && nameA.startsWith('大野賀')) return false;
  if (nameA === '高橋' && nameB.startsWith('高橋史')) return false;
  if (nameB === '高橋' && nameA.startsWith('高橋史')) return false;
  if (nameA === '森'   && nameB.startsWith('森山'))   return false;
  if (nameB === '森'   && nameA.startsWith('森山'))   return false;
  return nameA.includes(nameB) || nameB.includes(nameA);
}

// 名前を正規化（スペース除去・旧字体統一）
function normalizeName_(n) {
  if (!n) return '';
  return n.toString().replace(/\s+/g, '').trim().replace(/髙/g, '高');
}

// 2つのDateが同じ日付かどうか判定
function isSameDate_(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()      === b.getMonth()
    && a.getDate()       === b.getDate();
}

// 都道府県名から地域名を返す
function getRegionFromPrefecture_(prefName) {
  if (!prefName) return '';
  const regions = {
    '北海道': ['北海道','北海'],
    '東北':   ['青森','岩手','秋田','宮城','山形','福島'],
    '北関東': ['茨城','栃木','群馬'],
    '甲信越': ['新潟','長野','山梨'],
    '南関東': ['埼玉','千葉','東京','神奈川'],
    '東海':   ['静岡','岐阜','愛知','三重'],
    '北陸':   ['富山','石川','福井'],
    '近畿':   ['滋賀','京都','奈良','和歌山','大阪','兵庫'],
    '中国':   ['鳥取','島根','岡山','広島','山口'],
    '四国':   ['徳島','香川','愛媛','高知'],
    '九州':   ['福岡','佐賀','長崎','大分','熊本','宮崎','鹿児島'],
    '沖縄':   ['沖縄'],
  };
  for (const [region, prefs] of Object.entries(regions)) {
    if (prefs.some(p => prefName.startsWith(p))) return region;
  }
  return '';
}

// 生年月日から星座を返す
function getZodiacSign_(dateValue) {
  if (!dateValue) return '';
  let month, day;
  if (Object.prototype.toString.call(dateValue) === '[object Date]') {
    month = dateValue.getMonth() + 1;
    day   = dateValue.getDate();
  } else {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    month = d.getMonth() + 1;
    day   = d.getDate();
  }
  if ((month === 3  && day >= 21) || (month === 4  && day <= 19)) return '牡羊座';
  if ((month === 4  && day >= 20) || (month === 5  && day <= 20)) return '牡牛座';
  if ((month === 5  && day >= 21) || (month === 6  && day <= 21)) return '双子座';
  if ((month === 6  && day >= 22) || (month === 7  && day <= 22)) return '蟹座';
  if ((month === 7  && day >= 23) || (month === 8  && day <= 22)) return '獅子座';
  if ((month === 8  && day >= 23) || (month === 9  && day <= 22)) return '乙女座';
  if ((month === 9  && day >= 23) || (month === 10 && day <= 23)) return '天秤座';
  if ((month === 10 && day >= 24) || (month === 11 && day <= 22)) return '蠍座';
  if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return '射手座';
  if ((month === 12 && day >= 22) || (month === 1  && day <= 19)) return '山羊座';
  if ((month === 1  && day >= 20) || (month === 2  && day <= 18)) return '水瓶座';
  if ((month === 2  && day >= 19) || (month === 3  && day <= 20)) return '魚座';
  return '';
}


// ============================================================
//  シート編集時トリガー
//    人間がシートを手動編集したとき、該当シートをDBへ即時同期する。
// ============================================================

function onEditTrigger(e) {
  const sheetName = e.source.getActiveSheet().getName();
  const month     = getCurrentMonth_();
  if      (sheetName === SHEET_NIPPO)    syncNippoSheet(month);
  else if (sheetName === SHEET_AGE)      syncAgeSheet(month);
  else if (sheetName === SHEET_TYPE)     syncTypeSheet(month);
  else if (sheetName === SHEET_TALKNOTE) syncTalknote(month);
}
