'use client';

import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { ReportScoreData, ReportScoreItem, ReportScoreGrade } from '@/types';

// ────────────────────────────────────────────
//  採点結果の色・ラベル（Report Studio本家の配色ロジックを踏襲、色味はsales studioの黒基調に合わせる）
// ────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: '#4ade80', B: '#34d399', C: '#facc15', D: '#fb923c', E: '#f87171',
  '対象外': '#94a3b8', '待': '#fbbf24',
};
const GRADE_POINT: Record<string, number> = { A: 100, B: 80, C: 60, D: 40, E: 0 };
const GRADE_LABEL: Record<string, string> = { '対象外': '外' };

const sur = (s: string) => (s || '').split(/\s+/)[0] || '';
const ym = (d: string) => d.slice(0, 7);
const ymLabel = (m: string) => { const [y, mo] = m.split('-'); return `${y}年${+mo}月`; };

function avgP(list: ReportScoreItem[], key: 'iku' | 'gen'): number | null {
  const v = list.filter((x) => x[key] in GRADE_POINT);
  if (!v.length) return null;
  return Math.round(v.reduce((s, x) => s + GRADE_POINT[x[key]], 0) / v.length);
}

// 字体ゆれ・あだ名の名寄せ（Report Studio本家のALIAS/KANJIをそのまま踏襲）
const KANJI: Record<string, string> = { '髙': '高', '塲': '場', '﨑': '崎', '桒': '桑' };
const nkan = (s: string) => [...s].map((c) => KANJI[c] ?? c).join('');
// 正規名 → 表記ゆれ一覧（本文中の名前マッチング・ランキングのtoStaffで使用）
const NAME_VARIANTS: Record<string, string[]> = {
  '杉原': ['杉原', 'すぎ'],
  '救仁郷': ['救仁郷', 'くにごう', 'リアム', 'りあむ'],
  '大野賀': ['大野賀', '大野かよ'],
  '岡田和': ['岡田和', '岡田兄', '岡田ともき', 'ともき'],
  '岡田怜': ['岡田怜', '岡田さとし', 'さとし', '岡田弟'],
  '黒川': ['黒川', '真里亜', 'まりあ'],
  '村山': ['村山', 'ゆい'],
  '杉本': ['杉本', 'すぎも'],
  '鈴木幸': ['鈴木幸', 'こうじ'],
  '阿部': ['阿部', '阿部ゆ', 'あべゆず'],
};
const canon = (n: string) => Object.entries(NAME_VARIANTS).find(([, as]) => as.includes(n))?.[0] ?? n;

// ランキングに毎月固定で並べる社員（Report Studio本家のSTAFF定数）
const STAFF = ['木原', '森山', '大塲', '馬塲', '相原', '村山', '中村', '大久保', '杉原', '髙田', '筒井', '小野'];
const STAFF_KEY: Record<string, string> = {};
STAFF.forEach((n) => { STAFF_KEY[nkan(canon(sur(n)))] = n; });
const toStaff = (name: string): string | undefined => STAFF_KEY[nkan(canon(sur(name)))];

// スタッフ別タブで自社育成対象の集計から除外する人（他社応援など。本家の手動除外をそのまま踏襲）
const STAFF_EXCLUDE = ['田中'];

function GradeBadge({ grade, size = 'sm' }: { grade: ReportScoreGrade; size?: 'sm' | 'lg' }) {
  if (!grade) return <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>–</span>;
  const color = GRADE_COLOR[grade] ?? '#94a3b8';
  const label = GRADE_LABEL[grade] ?? grade;
  const point = GRADE_POINT[grade];
  return (
    <span style={{
      display: 'inline-flex', flexDirection: size === 'lg' ? 'column' : 'row', alignItems: 'center', gap: size === 'lg' ? 2 : 4,
      minWidth: size === 'lg' ? 46 : 26, justifyContent: 'center',
      padding: size === 'lg' ? '6px 8px' : '2px 7px',
      borderRadius: 7, fontSize: size === 'lg' ? 14 : 12, fontWeight: 700,
      background: color + '22', color, border: `1px solid ${color}55`,
    }}>
      {label}
      {size === 'lg' && point !== undefined && (
        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{point}</span>
      )}
    </span>
  );
}

// 平均点を帯色にする（ランキングタブ用。本家のptColorのしきい値をそのまま踏襲）
function avgColor(p: number | null): string {
  if (p === null) return '#94a3b8';
  if (p >= 90) return GRADE_COLOR.A;
  if (p >= 75) return GRADE_COLOR.B;
  if (p >= 60) return GRADE_COLOR.C;
  if (p >= 40) return GRADE_COLOR.D;
  return GRADE_COLOR.E;
}
function AvgBadge({ p }: { p: number | null }) {
  if (p === null) return <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>–</span>;
  const color = avgColor(p);
  return (
    <span style={{
      display: 'inline-block', minWidth: 30, textAlign: 'center', borderRadius: 7,
      fontSize: 12, fontWeight: 700, padding: '3px 6px',
      background: color + '22', color, border: `1px solid ${color}55`,
    }}>
      {p}
    </span>
  );
}

// 名前ハイライト（本文中の表記ゆれ・字体ゆれを<mark>で強調。dangerouslySetInnerHTMLを使わずセグメント分割で描画）
function nameMatchRegex(name: string): RegExp {
  const KREV: Record<string, string> = { '高': '[高髙]', '場': '[場塲]', '崎': '[崎﨑]', '桑': '[桑桒]' };
  const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const al = [...new Set(NAME_VARIANTS[name] ?? [name])].sort((a, b) => b.length - a.length);
  const pat = al.map((a) => [...a].map((c) => KREV[c] ?? reEsc(c)).join('')).join('|');
  return new RegExp(`(${pat})`, 'g');
}
function Highlighted({ text, name }: { text: string; name: string }) {
  const re = nameMatchRegex(name);
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => (
        re.test(part) && part.length > 0 && i % 2 === 1
          ? <mark key={i} style={{ background: '#facc1555', color: 'inherit', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
          : <span key={i}>{part}</span>
      ))}
    </>
  );
}

// 本文からその人について書かれた部分だけを抜き出す（本家のextractAbout/headOfをそのまま踏襲）
const HON_SUFFIX = '(さん|くん|君|ちゃん|様)';
const HEAD_RE = new RegExp('^([^\\s・　]{1,8}?)' + HON_SUFFIX + '?(?=[\\s　]|$)');
const TAIL_RE = new RegExp('^' + HON_SUFFIX + '?(について|の件|は|も)?[　\\s]*$');
const isHead = (l: string) => { const t = l.trim(); return !!t && !t.startsWith('・') && HEAD_RE.test(t); };
function headOf(l: string, al: string[]): boolean {
  const t = nkan(l.trim());
  if (!t || t.startsWith('・')) return false;
  if (al.some((a) => t.startsWith(a) && (TAIL_RE.test(t.slice(a.length)) || /^[\s　]/.test(t.slice(a.length))))) return true;
  return t.split(/[\s　]/)[0].split(/[、,／/]/).map((z) => z.replace(new RegExp(HON_SUFFIX + '$'), '').trim()).some((z) => z && al.includes(z));
}
function extractAbout(body: string, name: string): string {
  const al = (NAME_VARIANTS[name] ?? [name]).map(nkan);
  const lines = body.split('\n').map((s) => s.replace(/\s+$/, ''));
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!headOf(lines[i], al)) continue;
    const buf = [lines[i].trim()];
    for (let j = i + 1; j < lines.length; j++) {
      const u = lines[j].trim();
      if (!u || isHead(u)) break;
      buf.push(u);
    }
    if (buf.length > 1 || lines[i].trim().replace(HEAD_RE, '').trim()) blocks.push(buf.join('\n'));
  }
  if (blocks.length) return blocks.join('\n\n');
  const parts = lines.flatMap((l) => l.split(/(?<=[。!?！？])/)).flatMap((l) => l.split(/(?=・)/)).map((s) => s.trim()).filter(Boolean);
  const hit = parts.filter((s) => al.some((a) => nkan(s).includes(a)));
  if (parts.length < 2 && hit.length) return '';
  return hit.join('\n');
}

// ────────────────────────────────────────────
//  点数の見方（凡例）
// ────────────────────────────────────────────
function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, marginBottom: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}
      >
        {open ? '▴' : '▾'} 点数の見方
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', fontSize: 12.5, color: 'var(--text-sub)', lineHeight: 1.8 }}>
          育成・現場指揮それぞれのAI査定です。
          <div style={{ margin: '8px 0 6px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(['A', 'B', 'C', 'D', 'E', '対象外'] as ReportScoreGrade[]).map((g) => (
              <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <GradeBadge grade={g} />
                <span>{g === '対象外' ? '対象外' : GRADE_POINT[g]}</span>
              </span>
            ))}
          </div>
          <div><b style={{ color: 'var(--text-main)' }}>対象外</b>＝転送（本人が現場不在）や一人稼働など、評価の母数から外れる報告。</div>
          <div><b style={{ color: 'var(--text-main)' }}>出し忘れ</b>＝終担なのに報告が無かった日（①現場・担当／②転送）。</div>
          <div><b style={{ color: 'var(--text-main)' }}>担当</b>＝その報告を<b style={{ color: 'var(--text-main)' }}>実際に書いた人</b>。評価は書いた人に付きます。出し忘れだけは終担（枠の責任者）に付きます。</div>

          <div style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
            <b style={{ color: 'var(--text-main)' }}>平日と土日で評価が変わります</b>
            <div style={{ marginTop: 4 }}>
              ・<b style={{ color: 'var(--text-main)' }}>現場指揮</b>：平日は対象外（母数は土日祝）。土日祝のみA〜Eで採点。
            </div>
            <div>
              ・<b style={{ color: 'var(--text-main)' }}>育成</b>：土日は通常のA〜E。平日は簡易3段＝記載なしC／何か記載B／詳細（土日Aと同基準）A（平日はD・Eを付けません）。一人稼働・自社スタッフ不在は平日・土日とも対象外。
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <b style={{ color: 'var(--text-main)' }}>タイミング点</b>（報告の速さで加算・減算。育成・現場指揮の両方に効く）
            <table style={{ marginTop: 6, borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '3px 8px 3px 0', color: 'var(--text-sub)', fontWeight: 600, whiteSpace: 'nowrap' }}></th>
                  <th style={{ padding: '3px 6px', color: '#4ade80', fontWeight: 700 }}>当日</th>
                  <th style={{ padding: '3px 6px', color: '#4ade80', fontWeight: 700 }}>翌日</th>
                  <th style={{ padding: '3px 6px', color: 'var(--text-sub)', fontWeight: 600 }}>翌々日</th>
                  <th style={{ padding: '3px 6px', color: '#f87171', fontWeight: 700 }}>未提出</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 8px 3px 0', whiteSpace: 'nowrap' }}>現場・終担</td>
                  <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>+2</td>
                  <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>+1</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-sub)' }}>0</td>
                  <td style={{ textAlign: 'center', color: '#f87171', fontWeight: 700 }}>−1</td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 8px 3px 0', whiteSpace: 'nowrap' }}>転送</td>
                  <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>+0.2</td>
                  <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>+0.1</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-sub)' }}>0</td>
                  <td style={{ textAlign: 'center', color: '#f87171', fontWeight: 700 }}>−0.2</td>
                </tr>
              </tbody>
            </table>
            <span style={{ fontSize: 10.5, color: 'var(--text-sub)' }}>※土日に現場入り・終担で報告なしの場合は、タイミング減点ではなく現場指揮スコアに0点(E)として算入</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  報告詳細（中央モーダル）
// ────────────────────────────────────────────
function ReportDetailSheet({ item, onClose }: { item: ReportScoreItem; onClose: () => void }) {
  const shuDiffers = item.shu && sur(item.shu) !== sur(item.reporter);
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          position: 'relative',
          background: 'var(--card-bg, #1a1a2e)', borderRadius: 16,
          width: 560, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid var(--border-color)',
        }}>
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', padding: 6 }}
          >
            <X size={20} />
          </button>
          <div style={{ padding: '20px 20px 28px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-sub)' }}>{item.date} {item.youbi}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', margin: '2px 0' }}>{item.venue}</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              {sur(item.reporter)}
              {shuDiffers && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.75 }}>終担: {sur(item.shu)}</span>}
            </div>
            {item.target && item.target !== '—' && (
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>対象: {item.target}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 3 }}>育成</div>
                <GradeBadge grade={item.iku} size="lg" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 3 }}>現場指揮</div>
                <GradeBadge grade={item.gen} size="lg" />
              </div>
            </div>

            {item.pending && (
              <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 12, lineHeight: 1.6 }}>
                評価待ち：GeminiとClaudeの評価が割れています（育成 G:{item.aiIkuG || '?'} / C:{item.aiIkuC || '?'}、現場指揮 G:{item.aiGenG || '?'} / C:{item.aiGenC || '?'}）。「採点結果」シートで確定してください。
              </p>
            )}

            {(item.ikuC || item.genC) && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.ikuC && (
                  <div style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#1c7a4e33', color: '#4ade80', height: 'fit-content' }}>育成</span>
                    <span style={{ color: 'var(--text-main)' }}>{item.ikuC}</span>
                  </div>
                )}
                {item.genC && (
                  <div style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#2340b833', color: '#60a5fa', height: 'fit-content' }}>現指</span>
                    <span style={{ color: 'var(--text-main)' }}>{item.genC}</span>
                  </div>
                )}
              </div>
            )}

            {item.body && (
              <div style={{
                whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-main)', marginTop: 14,
                background: 'var(--bg-color)', borderRadius: 10, padding: 12, lineHeight: 1.7,
                border: '1px solid var(--border-color)',
              }}>
                {item.body}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MissingBlock({ title, items, accent }: { title: string; items: { date: string; venue: string; sur: string }[]; accent: string }) {
  return (
    <div style={{ background: accent + '11', border: `1px solid ${accent}33`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent, display: 'flex', gap: 8, alignItems: 'baseline' }}>
        {title}<span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-sub)' }}>{items.length}件</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 6 }}>この範囲では該当なし 👍</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
          {items.map((x, i) => (
            <span key={i} style={{ fontSize: 12, background: 'var(--card-bg)', border: `1px solid ${accent}44`, color: accent, borderRadius: 8, padding: '5px 9px', display: 'inline-flex', gap: 6 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{sur(x.sur)} {x.date.slice(5)}</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{x.venue}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 報告カード（詳細タブ・現場別タブ共通のヘッダー部分）
function ReportCardHeader({ item, showTarget = true }: { item: ReportScoreItem; showTarget?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-sub)' }}>{item.date} {item.youbi}</div>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-main)', margin: '1px 0' }}>{item.venue}</div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{sur(item.reporter)}</div>
        {showTarget && item.target && item.target !== '—' && (
          <div style={{ fontSize: 11.5, color: 'var(--text-sub)', marginTop: 1 }}>対象: {item.target}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <GradeBadge grade={item.iku} />
        <GradeBadge grade={item.gen} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
//  報告一覧タブ
// ────────────────────────────────────────────
type SortCol = 'date' | 'venue' | 'rep' | 'iku' | 'gen';
const gradeRank = (g: ReportScoreGrade): number => ({ A: 5, B: 4, C: 3, D: 2, E: 1, '対象外': 0 } as Record<string, number>)[g] ?? -1;

function ListTab({ reports, missing1, missing2, onSelect }: {
  reports: ReportScoreItem[]; missing1: { date: string; venue: string; sur: string }[]; missing2: { date: string; venue: string; sur: string }[];
  onSelect: (item: ReportScoreItem) => void;
}) {
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    const dir = sortDir;
    return [...reports].sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sortCol === 'date') { va = a.date; vb = b.date; }
      else if (sortCol === 'venue') { va = a.venue; vb = b.venue; }
      else if (sortCol === 'rep') { va = sur(a.reporter); vb = sur(b.reporter); }
      else if (sortCol === 'iku') { va = gradeRank(a.iku); vb = gradeRank(b.iku); }
      else { va = gradeRank(a.gen); vb = gradeRank(b.gen); }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.date < b.date ? 1 : -1;
    });
  }, [reports, sortCol, sortDir]);

  const sortBy = (c: SortCol) => {
    if (sortCol === c) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else { setSortCol(c); setSortDir(c === 'venue' || c === 'rep' ? 1 : -1); }
  };

  const cols: [SortCol, string][] = [['date', '日付'], ['venue', '現場'], ['rep', '担当'], ['iku', '育成'], ['gen', '現場指揮']];
  const arrow = (c: SortCol) => (sortCol === c ? (sortDir < 0 ? ' ▼' : ' ▲') : '');

  return (
    <div>
      <SectionHeading title="報告一覧" note="現場・担当・育成・現場指揮" />
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {cols.map(([c, label]) => (
                <th
                  key={c}
                  onClick={() => sortBy(c)}
                  style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-sub)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                  {label}{arrow(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((x) => (
              <tr key={x.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{x.date.slice(5)}</td>
                <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                  <span onClick={() => onSelect(x)} style={{ color: '#3ea6ff', cursor: 'pointer', textDecoration: 'underline' }}>
                    {x.venue}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-sub)', fontSize: 12, whiteSpace: 'nowrap' }}>{sur(x.reporter)}</td>
                <td style={{ padding: '8px 10px' }}><GradeBadge grade={x.iku} /></td>
                <td style={{ padding: '8px 10px' }}><GradeBadge grade={x.gen} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>出し忘れ</div>
      <MissingBlock title="① 現場・担当出し忘れ" items={missing1} accent="#f87171" />
      <MissingBlock title="② 転送出し忘れ" items={missing2} accent="#fb923c" />
    </div>
  );
}

// ────────────────────────────────────────────
//  詳細タブ（カードで読む）
// ────────────────────────────────────────────
function DetailCard({ item }: { item: ReportScoreItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '13px 15px', marginBottom: 10 }}>
      <ReportCardHeader item={item} />
      {(item.ikuC || item.genC) && (
        <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {item.ikuC && (
            <div style={{ fontSize: 12.5, display: 'flex', gap: 7 }}>
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#1c7a4e33', color: '#4ade80', height: 'fit-content' }}>育成</span>
              <span style={{ color: 'var(--text-main)' }}>{item.ikuC}</span>
            </div>
          )}
          {item.genC && (
            <div style={{ fontSize: 12.5, display: 'flex', gap: 7 }}>
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#2340b833', color: '#60a5fa', height: 'fit-content' }}>現指</span>
              <span style={{ color: 'var(--text-main)' }}>{item.genC}</span>
            </div>
          )}
        </div>
      )}
      {item.body && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setOpen((o) => !o)} style={{ background: 'none', border: 'none', color: '#3ea6ff', fontFamily: 'monospace', fontSize: 11.5, cursor: 'pointer', padding: 0 }}>
            {open ? '閉じる ▴' : '報告を読む ▾'}
          </button>
          {open && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-main)', marginTop: 8, background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12, lineHeight: 1.7 }}>
              {item.body}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailTab({ reports }: { reports: ReportScoreItem[] }) {
  const sorted = useMemo(() => [...reports].sort((a, b) => (a.date < b.date ? 1 : -1)), [reports]);
  const genAvg = useMemo(() => avgP(reports, 'gen'), [reports]);
  const ikuAvg = useMemo(() => avgP(reports, 'iku'), [reports]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatTile label="報告件数" value={reports.length} />
        <StatTile label="現場指揮 平均" value={genAvg ?? '–'} />
        <StatTile label="育成 平均" value={ikuAvg ?? '–'} />
      </div>
      {sorted.length === 0 ? (
        <div style={{ color: 'var(--text-sub)', fontSize: 13, padding: '8px 2px' }}>該当する報告はありません。</div>
      ) : (
        sorted.map((x) => <DetailCard key={x.id} item={x} />)
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: '1 1 100px', minWidth: 92, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '11px 12px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-sub)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// タブ内見出し（本家のsec-h：タイトル＋任意でpill＋注記）
function SectionHeading({ title, pill, note }: { title: string; pill?: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '2px 0 12px', flexWrap: 'wrap' }}>
      <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>{title}</h2>
      {pill && (
        <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-sub)', borderRadius: 999, padding: '3px 10px' }}>{pill}</span>
      )}
      {note && <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-sub)' }}>{note}</span>}
    </div>
  );
}

// ────────────────────────────────────────────
//  現場別タブ
// ────────────────────────────────────────────
function VenueCard({ item }: { item: ReportScoreItem }) {
  const [open, setOpen] = useState(false);
  const isLong = item.body.split('\n').length > 3 || item.body.length > 110;
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '13px 15px', marginBottom: 10 }}>
      <ReportCardHeader item={item} />
      {item.body && (
        <div style={{ marginTop: 9 }}>
          <div style={{
            whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--text-main)', lineHeight: 1.75,
            ...(isLong && !open ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
          }}>
            {item.body}
          </div>
          {isLong && (
            <button onClick={() => setOpen((o) => !o)} style={{ background: 'none', border: 'none', color: '#3ea6ff', fontFamily: 'monospace', fontSize: 11.5, cursor: 'pointer', padding: '4px 0 0' }}>
              {open ? '閉じる ▴' : '続きを読む ▾'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function VenueTab({ allReports }: { allReports: ReportScoreItem[] }) {
  const venueMap = useMemo(() => {
    const m: Record<string, ReportScoreItem[]> = {};
    allReports.forEach((x) => { (m[x.venue] ??= []).push(x); });
    return m;
  }, [allReports]);
  const venueNames = useMemo(
    () => Object.keys(venueMap).sort((a, b) => venueMap[b].length - venueMap[a].length || a.localeCompare(b, 'ja')),
    [venueMap]
  );
  const [venueOverride, setVenueOverride] = useState<string | null>(null);
  const venue = (venueOverride && venueMap[venueOverride]) ? venueOverride : venueNames[0];
  const list = useMemo(() => (venueMap[venue] ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)), [venueMap, venue]);
  const genAvg = useMemo(() => avgP(list, 'gen'), [list]);
  const ikuAvg = useMemo(() => avgP(list, 'iku'), [list]);

  if (venueNames.length === 0) return <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>データがありません。</div>;

  return (
    <div>
      <SectionHeading title="現場別" pill="集計：全期間" note="その現場の報告をまとめ読み" />
      <select className="control-select" value={venue} onChange={(e) => setVenueOverride(e.target.value)} style={{ marginBottom: 14, width: '100%', maxWidth: 320 }}>
        {venueNames.map((v) => <option key={v} value={v}>{v}（{venueMap[v].length}件）</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatTile label="報告件数" value={list.length} />
        <StatTile label="現場指揮 平均" value={genAvg ?? '–'} />
        <StatTile label="育成 平均" value={ikuAvg ?? '–'} />
      </div>
      {list.length === 0 ? (
        <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>この現場の報告はまだありません。</div>
      ) : (
        list.map((x) => <VenueCard key={x.id} item={x} />)
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  スタッフ別タブ（育成対象になった人ごとに、本文から該当部分を抽出）
// ────────────────────────────────────────────
function StaffTimelineEntry({ item, name }: { item: ReportScoreItem; name: string }) {
  const [showFull, setShowFull] = useState(false);
  const ex = useMemo(() => extractAbout(item.body, name), [item.body, name]);
  const hasExcerpt = !!ex;
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
      <div style={{ flex: '0 0 78px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-sub)', paddingTop: 2 }}>{item.date.slice(5)} {item.youbi}</div>
      <div style={{ flex: 1, borderLeft: '2px solid var(--border-color)', paddingLeft: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          <b style={{ color: 'var(--text-main)' }}>{sur(item.reporter)}</b>
          <span style={{ color: 'var(--text-sub)' }}>さんから </span>
          <span style={{ color: 'var(--text-sub)' }}>{item.venue}</span>
        </div>
        {!hasExcerpt && (
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-sub)', letterSpacing: '0.05em', margin: '2px 0 4px', textTransform: 'uppercase' }}>
            区切りが無い報告のため全文を表示しています
          </div>
        )}
        <div style={{
          fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-wrap',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 11px',
        }}>
          <Highlighted text={hasExcerpt ? ex : item.body} name={name} />
        </div>
        {hasExcerpt && (
          <>
            <button onClick={() => setShowFull((o) => !o)} style={{ background: 'none', border: 'none', color: '#3ea6ff', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', padding: '4px 0 0' }}>
              {showFull ? '閉じる ▴' : '報告全文 ▾'}
            </button>
            {showFull && (
              <div style={{
                fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-wrap', marginTop: 6,
                background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 11px',
              }}>
                <Highlighted text={item.body} name={name} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StaffTab({ allReports }: { allReports: ReportScoreItem[] }) {
  const targetMap = useMemo(() => {
    const m: Record<string, ReportScoreItem[]> = {};
    allReports.forEach((x) => {
      if (!(x.iku in GRADE_POINT) || !x.target || x.target === '—') return;
      x.target.split('・').forEach((raw) => {
        const name = canon(raw);
        if (STAFF_EXCLUDE.includes(name)) return;
        (m[name] ??= []).push(x);
      });
    });
    return m;
  }, [allReports]);
  const names = useMemo(() => Object.keys(targetMap).sort((a, b) => targetMap[b].length - targetMap[a].length), [targetMap]);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name = (nameOverride && targetMap[nameOverride]) ? nameOverride : names[0];
  const list = useMemo(() => (targetMap[name] ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)), [targetMap, name]);

  if (names.length === 0) return <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>データがありません。</div>;

  return (
    <div>
      <SectionHeading title="スタッフ別" pill="集計：全期間" note="新しい順" />
      <select className="control-select" value={name} onChange={(e) => setNameOverride(e.target.value)} style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}>
        {names.map((n) => <option key={n} value={n}>{n}（{targetMap[n].length}件）</option>)}
      </select>
      {list.length === 0 ? (
        <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>この人への育成コメントはまだありません。</div>
      ) : (
        list.map((x) => <StaffTimelineEntry key={x.id} item={x} name={name} />)
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  ランキングタブ
// ────────────────────────────────────────────
function RankTab({ allReports, allMissing1, allMissing2, month }: {
  allReports: ReportScoreItem[]; allMissing1: { date: string; sur: string; reporter: string }[]; allMissing2: { date: string; sur: string; reporter: string }[]; month: string;
}) {
  const [rankKey, setRankKey] = useState<'gen' | 'iku'>('gen');

  const rows = useMemo(() => {
    const inMonth = (d: string) => ym(d) === month;
    const acc: Record<string, { n: number; iS: number; iN: number; gS: number; gN: number; a: number; miss: number }> = {};
    STAFF.forEach((n) => { acc[n] = { n: 0, iS: 0, iN: 0, gS: 0, gN: 0, a: 0, miss: 0 }; });
    allReports.filter((x) => inMonth(x.date) && !x.pending).forEach((x) => {
      const cn = toStaff(x.reporter);
      if (!cn) return;
      const s = acc[cn];
      s.n++;
      if (x.iku in GRADE_POINT) { s.iS += GRADE_POINT[x.iku]; s.iN++; }
      if (x.gen in GRADE_POINT) { s.gS += GRADE_POINT[x.gen]; s.gN++; }
      if (x.iku === 'A' || x.gen === 'A') s.a++;
    });
    [...allMissing1, ...allMissing2].filter((x) => inMonth(x.date)).forEach((x) => {
      const cn = toStaff(x.reporter || x.sur);
      if (cn) acc[cn].miss++;
    });
    return STAFF.map((k) => {
      const s = acc[k];
      return { name: k, n: s.n, iku: s.iN ? Math.round(s.iS / s.iN) : null, gen: s.gN ? Math.round(s.gS / s.gN) : null, a: s.a, miss: s.miss };
    }).sort((a, b) => ((b[rankKey] ?? -1) - (a[rankKey] ?? -1)) || (b.n - a.n));
  }, [allReports, allMissing1, allMissing2, month, rankKey]);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1));

  return (
    <div>
      <SectionHeading title="ランキング" note={`${ymLabel(month)}・${rankKey === 'gen' ? '現場指揮' : '育成'}順`} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['gen', 'iku'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setRankKey(k)}
            style={{
              border: `1px solid ${rankKey === k ? '#3ea6ff' : 'var(--border-color)'}`,
              background: rankKey === k ? '#3ea6ff22' : 'var(--card-bg)',
              color: rankKey === k ? '#3ea6ff' : 'var(--text-sub)',
              borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {k === 'gen' ? '現場指揮' : '育成'}
          </button>
        ))}
      </div>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['順位', '名前', '報告', '現指', '育成', '出忘'].map((h) => (
                <th key={h} style={{ padding: '9px 8px', textAlign: h === '名前' ? 'left' : 'center', fontSize: 11, color: 'var(--text-sub)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} style={{ borderBottom: '1px solid var(--border-color)', opacity: r.n === 0 ? 0.45 : 1 }}>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 900, fontSize: r.n === 0 ? 12 : 15, color: 'var(--text-main)' }}>{r.n === 0 ? i + 1 : medal(i)}</td>
                <td style={{ padding: '9px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{sur(r.name)}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-sub)' }}>{r.n}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center' }}><AvgBadge p={r.gen} /></td>
                <td style={{ padding: '9px 8px', textAlign: 'center' }}><AvgBadge p={r.iku} /></td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: r.miss ? '#f87171' : 'var(--text-sub)' }}>{r.miss || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
//  メインコンポーネント
// ────────────────────────────────────────────
type ViewKey = 'list' | 'detail' | 'venue' | 'staff' | 'rank';
const TABS: { id: ViewKey; label: string }[] = [
  { id: 'list', label: '報告一覧' },
  { id: 'detail', label: '詳細' },
  { id: 'venue', label: '現場別' },
  { id: 'staff', label: 'スタッフ別' },
  { id: 'rank', label: 'ランキング' },
];

export default function ReportScoreView() {
  const [data, setData] = useState<ReportScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKey>('list');
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const [personOverride, setPersonOverride] = useState('ALL');
  const [selected, setSelected] = useState<ReportScoreItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch('/api/report-score', { signal: controller.signal })
      .then((r) => r.json())
      .then((d: ReportScoreData) => setData(d))
      .catch(() => setData({ reports: [], missing1: [], missing2: [] }))
      .finally(() => { clearTimeout(timer); setLoading(false); });
    return () => controller.abort();
  }, []);

  const months = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.reports.map((r) => ym(r.date)))].sort().reverse();
  }, [data]);

  const defaultMonth = useMemo(() => {
    if (months.length === 0) return '';
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return months.includes(cur) ? cur : months[0];
  }, [months]);
  const month = (monthOverride && months.includes(monthOverride)) ? monthOverride : defaultMonth;

  const reportsInMonth = useMemo(
    () => (data?.reports ?? []).filter((r) => ym(r.date) === month),
    [data, month]
  );

  const personOptions = useMemo(() => {
    const cnt: Record<string, number> = {};
    reportsInMonth.forEach((r) => { cnt[r.reporter] = (cnt[r.reporter] ?? 0) + 1; });
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map((n) => ({ name: n, count: cnt[n] }));
  }, [reportsInMonth]);

  const person = (personOverride !== 'ALL' && !personOptions.some((p) => p.name === personOverride)) ? 'ALL' : personOverride;

  const filteredReports = useMemo(
    () => person === 'ALL' ? reportsInMonth : reportsInMonth.filter((x) => x.reporter === person),
    [reportsInMonth, person]
  );

  const missing1 = useMemo(() => {
    let m = (data?.missing1 ?? []).filter((x) => ym(x.date) === month);
    if (person !== 'ALL') m = m.filter((x) => x.sur === sur(person));
    return m.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [data, month, person]);
  const missing2 = useMemo(() => {
    let m = (data?.missing2 ?? []).filter((x) => ym(x.date) === month);
    if (person !== 'ALL') m = m.filter((x) => x.sur === sur(person));
    return m.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [data, month, person]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>読み込み中...</div>;
  }
  if (!data || data.reports.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>データがありません。</div>;
  }

  const showControls = view === 'list' || view === 'detail';
  const monthDisabled = view === 'venue' || view === 'staff';
  const monthIdx = Math.max(0, months.indexOf(month));
  const canGoPrev = monthIdx < months.length - 1;
  const canGoNext = monthIdx > 0;
  const goMonth = (delta: number) => {
    const newIdx = monthIdx - delta;
    if (newIdx < 0 || newIdx >= months.length) return;
    setMonthOverride(months[newIdx]);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 14, opacity: monthDisabled ? 0.4 : 1, pointerEvents: monthDisabled ? 'none' : 'auto' }}>
        <button
          onClick={() => goMonth(-1)}
          disabled={!canGoPrev}
          style={{ background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default', color: 'var(--text-main)', fontSize: 20, padding: '0 6px', lineHeight: 1, opacity: canGoPrev ? 0.7 : 0.2 }}
          onMouseEnter={(e) => { if (canGoPrev) e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (canGoPrev) e.currentTarget.style.opacity = '0.7'; }}
          aria-label="前の月"
        >‹</button>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonthOverride(e.target.value)}
          aria-label="表示月を選択"
        />
        <button
          onClick={() => goMonth(1)}
          disabled={!canGoNext}
          style={{ background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default', color: 'var(--text-main)', fontSize: 20, padding: '0 6px', lineHeight: 1, opacity: canGoNext ? 0.7 : 0.2 }}
          onMouseEnter={(e) => { if (canGoNext) e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (canGoNext) e.currentTarget.style.opacity = '0.7'; }}
          aria-label="次の月"
        >›</button>
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 14, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap',
              border: `1px solid ${view === t.id ? 'var(--text-main)' : 'var(--border-color)'}`,
              background: view === t.id ? 'var(--text-main)' : 'var(--card-bg)',
              color: view === t.id ? 'var(--bg-color)' : 'var(--text-sub)',
              borderRadius: 10, padding: '10px 6px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Legend />

      {showControls && (
        <select className="control-select" value={person} onChange={(e) => setPersonOverride(e.target.value)} style={{ marginBottom: 14, width: '100%' }}>
          <option value="ALL">全員（{reportsInMonth.length}件）</option>
          {personOptions.map((p) => <option key={p.name} value={p.name}>{sur(p.name)}（{p.count}件）</option>)}
        </select>
      )}

      {view === 'list' && <ListTab reports={filteredReports} missing1={missing1} missing2={missing2} onSelect={setSelected} />}
      {view === 'detail' && <DetailTab reports={filteredReports} />}
      {view === 'venue' && <VenueTab allReports={data.reports} />}
      {view === 'staff' && <StaffTab allReports={data.reports} />}
      {view === 'rank' && <RankTab allReports={data.reports} allMissing1={data.missing1} allMissing2={data.missing2} month={month} />}

      {selected && <ReportDetailSheet item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
