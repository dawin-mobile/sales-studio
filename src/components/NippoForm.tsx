'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, PenLine } from 'lucide-react';
import { NIPPO_SECTIONS, sectionsFor, validateNippo, type NippoField, type NippoMode } from '@/lib/nippoForm';

type PastFare = { location: string; fare: string; date: string; order: number };

// 勤務地の表記ゆれ（全角半角・空白）をそろえる
function normalizeLocation(s: string): string {
  return s.normalize('NFKC').replace(/\s/g, '').toLowerCase();
}

// 過去の日報から、この勤務地の交通費を決める。直近5回（提出した順、0円の日は除く）のうち一番安い金額を使う。
// 高い金額を入れておくと見直されずにそのまま申請されやすい。安い金額なら、実際はもっと高かった人は自分で直すので
// 間違いが自然に正される（経理の要望）。
// 日報の勤務地は自由記述でシフト表と表記が揃わない（シフト「長坂」↔ 日報「au長坂」など）ため、
// どちらかがもう一方を含めば同じ現場とみなす
function findPastFare(pastFares: PastFare[], location: string): number | undefined {
  const target = normalizeLocation(location);
  if (!target) return undefined;
  const recent = pastFares
    .filter((p) => {
      const loc = normalizeLocation(p.location);
      return loc.includes(target) || target.includes(loc);
    })
    .sort((a, b) => b.order - a.order)
    .slice(0, 5)
    .map((p) => Number(p.fare))
    .filter((n) => n > 0);
  return recent.length > 0 ? Math.min(...recent) : undefined;
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 小数の足し引きで 0.15000000000000002 のような誤差が出ないよう小数第2位で丸める（aggregator.ts の safeAdd と同じ考え方）
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function yesterdayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

// 「10/29(木)」の形にする
function dateWithWeekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${shortDate(date)}(${'日月火水木金土'[new Date(y, m - 1, d).getDay()]})`;
}

/** 日報を書けるユーザーかと、未提出日を返す */
export function useNippoForm() {
  const { data: session } = useSession();
  const [available, setAvailable] = useState(false);
  const [missingDates, setMissingDates] = useState<string[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/nippo-form')
      .then((r) => r.json())
      .then((data) => {
        if (!data.available) return;
        setAvailable(true);
        return fetch('/api/nippo-check')
          .then((r) => r.json())
          .then((d) => { if (Array.isArray(d.missingDates)) setMissingDates(d.missingDates); });
      })
      .catch(() => {});
  }, [session]);

  return { available, missingDates };
}

export function NippoButton({ missingCount, onClick }: { missingCount: number; onClick: () => void }) {
  const alert = missingCount > 0;
  return (
    <button
      onClick={onClick}
      title={alert ? `日報未提出 ${missingCount}日` : '日報を書く'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 34,
        padding: '0 14px',
        borderRadius: 8, // 稼働カードの「実績報告生成」ボタンと同じ角の丸い四角
        border: '1px solid rgba(196, 181, 253, 0.35)',
        background: '#7c3aed',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        position: 'relative',
      }}
    >
      <PenLine size={15} strokeWidth={2} />
      日報
      {alert && (
        <span style={{
          position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 5px',
          borderRadius: 9, background: 'var(--accent-color)', color: '#fff', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {missingCount}
        </span>
      )}
    </button>
  );
}

// 黒基調のまま重なりが見えるよう、背景(#0f0f0f) → カード(#1c1c1c) → 入力欄・ボタン の順に少しずつ明るくする
const inputStyle: React.CSSProperties = {
  background: '#2a2a2a',
  border: '1px solid #3a3a3a',
  borderRadius: 8,
  color: 'var(--text-main)',
  fontSize: 16, // 16px未満だとiOSで入力時に画面が拡大される
  padding: '8px 10px',
  width: '100%',
  boxSizing: 'border-box',
};

// 数字が入った欄は緑（赤はエラーに見えるため）
const GREEN_STYLE: React.CSSProperties = { background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.6)' };

// 実績の換算値の欄（自己クロ・着座数を除く）。着座数の自動入力と「実績と同じ」の合計に使う
const RESULT_KEYS = NIPPO_SECTIONS[0].fields.map((f) => f.key).filter((k) => k !== 'selfClose' && k !== 'seated');

const stepButton: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 18,
  border: '1px solid rgba(255, 255, 255, 0.16)',
  background: 'rgba(255, 255, 255, 0.09)',
  color: 'var(--text-main)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid #2a2a2a',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

type Step = 'edit' | 'confirm' | 'done';

// 書きかけの日報。送信するまで端末（localStorage）に保存しておき、閉じても続きから書けるようにする
type Draft = {
  date: string;
  location: string;
  mode: NippoMode;
  values: Record<string, string>;
  stepHistory: Record<string, number[]>;
  fareAuto: boolean;
};

const INITIAL_VALUES: Record<string, string> = {};

function draftKey(name: string | null | undefined): string | null {
  return name ? `nippo-draft:${name}` : null;
}

// 開いただけ（勤務日・勤務地・交通費が自動で入っただけ）の状態は書きかけとみなさない。
// そうしないと前の日に開いた日付が次の日も残ってしまう
function hasContent(d: Draft): boolean {
  return d.mode !== 'normal'
    || !d.fareAuto
    || Object.entries(d.values).some(([k, v]) => k !== 'fare' && v.trim() !== '' && !(k === 'taxi' && v === '0'));
}

function loadDraft(name: string | null | undefined): Draft | null {
  const key = draftKey(name);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return hasContent(d) ? d : null;
  } catch {
    return null;
  }
}

const MODE_OPTIONS: { mode: NippoMode; label: string }[] = [
  { mode: 'normal', label: '獲得した' },
  { mode: 'zero', label: '0だった' },
  { mode: 'training', label: '研修' },
];

// 勤務日ボタン・勤務の種類の切り替えで、選んでいるものを白く塗る
const chipStyle = (selected: boolean): React.CSSProperties => ({
  height: 36,
  padding: '0 12px',
  borderRadius: 18,
  border: selected ? '1px solid #fff' : '1px solid rgba(255, 255, 255, 0.16)',
  background: selected ? '#fff' : 'rgba(255, 255, 255, 0.09)',
  color: selected ? '#111' : 'var(--text-main)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

export default function NippoForm({ onClose, missingDates }: { onClose: () => void; missingDates: string[] }) {
  const { data: session } = useSession();
  const userName = session?.user?.name;
  // パネルはボタンを押してから出るので、この時点でログイン情報は読み込み済み
  const [draft] = useState(() => loadDraft(userName));
  const [restored, setRestored] = useState(draft !== null);
  const [date, setDate] = useState(draft?.date ?? todayJst());
  const [location, setLocation] = useState(draft?.location ?? '');
  const [shiftLocations, setShiftLocations] = useState<string[]>([]);
  const [mode, setMode] = useState<NippoMode>(draft?.mode ?? 'normal');
  const [values, setValues] = useState<Record<string, string>>(draft?.values ?? INITIAL_VALUES);
  // ＋ボタンで足した数の履歴。−ボタンで直前の1回分ずつ取り消す
  const [stepHistory, setStepHistory] = useState<Record<string, number[]>>(draft?.stepHistory ?? {});
  const [pastFares, setPastFares] = useState<PastFare[]>([]);
  // 交通費を自分で触るまでは、勤務地に合わせて過去の金額を入れ直す
  const [fareAuto, setFareAuto] = useState(draft?.fareAuto ?? true);
  // 書きかけを戻したときは、最初のシフト読み込みで勤務地を上書きしない
  const keepLocationRef = useRef(draft !== null);
  // 「消して最初から」で、日付が同じままでもシフトを読み直すためのカウンター
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    fetch('/api/nippo-form/fares')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.fares)) setPastFares(data.fares); })
      .catch(() => {});
  }, []);
  const [step, setStep] = useState<Step>('edit');
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // 日付を変えたら、その日のシフトから勤務地を入れ直す
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/nippo-form?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.locations)) return;
        setShiftLocations(data.locations);
        if (data.locations[0] && !keepLocationRef.current) setLocation(data.locations[0]);
        keepLocationRef.current = false;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date, reloadCount]);

  // 送信するまでは、変わるたびに書きかけを保存する
  useEffect(() => {
    const key = draftKey(userName);
    if (!key || step === 'done') return;
    try {
      localStorage.setItem(key, JSON.stringify({ date, location, mode, values, stepHistory, fareAuto } satisfies Draft));
    } catch {
      // 保存できない端末（プライベートモードなど）では保存しないだけ
    }
  }, [userName, step, date, location, mode, values, stepHistory, fareAuto]);

  const clearDraft = () => {
    const key = draftKey(userName);
    if (key) {
      try { localStorage.removeItem(key); } catch { /* 消せなくても次の保存で上書きされる */ }
    }
  };

  const startOver = () => {
    clearDraft();
    setRestored(false);
    setDate(todayJst());
    setLocation('');
    setMode('normal');
    setValues(INITIAL_VALUES);
    setStepHistory({});
    setFareAuto(true);
    setErrors([]);
    setReloadCount((n) => n + 1);
  };

  const pastFare = useMemo(() => findPastFare(pastFares, location), [pastFares, location]);

  // 勤務地が決まったら、過去の日報でその勤務地に行ったときの交通費を入れておく
  useEffect(() => {
    if (!fareAuto) return;
    setValues((v) => ({ ...v, fare: pastFare !== undefined ? String(pastFare) : '' }));
  }, [pastFare, fareAuto]);

  // 着座数を自分で触っていない間は、実績か自己クロのどれかが0でなければ自動で1にする
  // （0だった日は実績の欄が隠れていて送られないので、そこに残った数字では自動入力しない）
  const effectiveValues = useMemo(() => {
    if (values.seated !== undefined) return values;
    const hasResult = mode === 'normal' && [...RESULT_KEYS, 'selfClose'].some((k) => parseFloat(values[k] ?? '') > 0);
    return { ...values, seated: hasResult ? '1' : '' };
  }, [values, mode]);

  const setValue = (key: string, value: string) => {
    if (key === 'fare') setFareAuto(false);
    setValues((v) => ({ ...v, [key]: value }));
    setStepHistory((h) => ({ ...h, [key]: [] }));
  };
  const addStep = (key: string, step: number) => {
    const cur = parseFloat(effectiveValues[key] ?? '') || 0;
    setValues((v) => ({ ...v, [key]: String(round2(cur + step)) }));
    setStepHistory((h) => ({ ...h, [key]: [...(h[key] ?? []), step] }));
  };
  // 自己クロの「実績と同じ」: 実績の合計を入れる
  const copyTotal = (key: string) => {
    const total = RESULT_KEYS.reduce((sum, k) => round2(sum + (parseFloat(effectiveValues[k] ?? '') || 0)), 0);
    setValue(key, total === 0 ? '' : String(total));
  };
  const undoStep = (key: string) => {
    const history = stepHistory[key] ?? [];
    const last = history[history.length - 1];
    if (last === undefined) return;
    const next = Math.max(0, round2((parseFloat(effectiveValues[key] ?? '') || 0) - last));
    setValues((v) => ({ ...v, [key]: next === 0 ? '' : String(next) }));
    setStepHistory((h) => ({ ...h, [key]: history.slice(0, -1) }));
  };

  // いつもの金額（直近5回の最安）より高くしたら、差額を見せて本人に自覚してもらう（送信は止めない）
  const fareOver = pastFare !== undefined ? (parseFloat(effectiveValues.fare ?? '') || 0) - pastFare : 0;
  const fareOverNote = fareOver > 0 ? `いつもより +${fareOver.toLocaleString()}円 高い金額です` : '';

  const submission = { date, location, mode, values: effectiveValues };
  const sections = sectionsFor(mode);

  // 勤務日ボタン: 今日・昨日・未提出の日（新しい順）
  const today = todayJst();
  const yesterday = yesterdayJst();
  const dateChips = [...new Set([today, yesterday, ...[...missingDates].sort().reverse()])];
  const isOtherDate = !dateChips.includes(date);

  // 確認画面は見落としやすい要点だけにする（項目ごとの数字は入力画面で見えている）
  const sumOf = (keys: string[]) => keys.reduce((sum, k) => round2(sum + (parseFloat(effectiveValues[k] ?? '') || 0)), 0);
  const confirmRows: [string, string][] = [
    ['名前', userName ?? ''],
    ['勤務日', dateWithWeekday(date)],
    ['勤務地', location],
    ...(mode === 'normal' ? [['獲得合計', String(sumOf(RESULT_KEYS))], ['自己クロ合計', String(sumOf(['selfClose']))]] as [string, string][] : []),
    ['往復交通費（公共交通機関）', (effectiveValues.fare ?? '').trim()],
    ['タクシー代、有料特急', (effectiveValues.taxi ?? '').trim()],
  ];

  const goConfirm = () => {
    const errs = validateNippo(submission);
    setErrors(errs);
    if (errs.length === 0) setStep('confirm');
  };

  const send = async () => {
    setSending(true);
    setErrors([]);
    try {
      const res = await fetch('/api/nippo-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors([data.error ?? '送信に失敗しました']);
        return;
      }
      clearDraft();
      setStep('done');
    } catch {
      setErrors(['通信に失敗しました。電波のよいところで再度送信してください']);
    } finally {
      setSending(false);
    }
  };

  const renderField = (f: NippoField) => {
    const v = effectiveValues[f.key] ?? '';
    const label = (
      <div style={{ flex: '1 1 120px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {f.label}{f.required && <span style={{ color: 'var(--accent-color)', marginLeft: 4 }}>*</span>}
        </div>
        {f.hint && <div style={{ fontSize: 11, color: '#999', marginTop: 2, lineHeight: 1.4 }}>{f.hint}</div>}
      </div>
    );

    if (f.kind === 'number') {
      const canUndo = (stepHistory[f.key]?.length ?? 0) > 0;
      // 「0」ボタンのある欄は0も入力済みとして緑にする
      const filled = parseFloat(v) > 0 || (f.zeroButton === true && v.trim() !== '');
      const stepperButton: React.CSSProperties = { ...stepButton, height: 40, minWidth: 44, justifyContent: 'center', padding: '0 10px' };
      const input = (
        <input
          type="text"
          inputMode="decimal"
          value={v}
          onChange={(e) => setValue(f.key, e.target.value)}
          // 必須の欄（交通費など）は空欄が「0円」に見えないよう見本を出さない
          placeholder={f.required ? undefined : '0'}
          style={{
            ...inputStyle,
            width: f.steps ? 64 : 84,
            height: 40,
            textAlign: f.steps ? 'center' : 'right',
            flexShrink: 0,
            fontWeight: filled ? 700 : 400,
            ...(filled && GREEN_STYLE),
          }}
        />
      );
      return (
        <div key={f.key} id={`nippo-field-${f.key}`} style={{ padding: '12px 0', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 8 }}>
            {label}
            {f.steps ? (
              // 数字をはさんで − と ＋ を置く。換算の違うものが混ざる欄は ＋ を2つ並べる
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => undoStep(f.key)}
                  disabled={!canUndo}
                  aria-label={`${f.label}を1回分減らす`}
                  style={{ ...stepperButton, opacity: canUndo ? 1 : 0.35 }}
                >
                  −
                </button>
                {input}
                {f.steps.map((st) => (
                  <button key={st.value} type="button" onClick={() => addStep(f.key, st.value)} style={stepperButton}>
                    +{st.value}
                  </button>
                ))}
              </div>
            ) : f.zeroButton ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <button type="button" onClick={() => setValue(f.key, '0')} style={stepperButton}>0</button>
                {input}
              </div>
            ) : input}
          </div>
          {f.key === 'fare' && fareOverNote && (
            <div style={{ textAlign: 'right', fontSize: 12, color: '#f59e0b', marginTop: 6 }}>{fareOverNote}</div>
          )}
          {f.copyTotal && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => copyTotal(f.key)} style={stepButton}>実績と同じ</button>
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={f.key} style={{ padding: '8px 0' }}>
        {label}
        <textarea value={v} onChange={(e) => setValue(f.key, e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }} />
      </div>
    );
  };

  const errorBox = errors.length > 0 && (
    <div style={{ background: '#2a0a0a', border: '1px solid #cc3333', borderRadius: 8, padding: '10px 14px', color: '#ff6666', fontSize: 13, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
      {errors.join('\n')}
    </div>
  );

  const primaryButton: React.CSSProperties = {
    width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
    background: 'var(--accent-color)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  };
  const secondaryButton: React.CSSProperties = {
    ...primaryButton, background: 'var(--card-bg)', border: '1px solid var(--border-color)',
  };

  return (
    <div className="nippo-panel">
      <div className="nippo-panel-header">
        <button
          onClick={step === 'confirm' ? () => setStep('edit') : onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px' }}
          aria-label="戻る"
        >
          <ChevronLeft size={24} strokeWidth={1.75} />
        </button>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{step === 'confirm' ? '内容の確認' : '日報'}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px 16px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' } as React.CSSProperties}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 32 }}>{shortDate(date)} の日報を送信しました</div>
              <button onClick={onClose} style={primaryButton}>閉じる</button>
            </div>
          )}

          {step === 'confirm' && (
            <>
              <div style={sectionStyle}>
                {confirmRows.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: 14 }}>
                    <div style={{ width: 140, flexShrink: 0, color: '#aaa' }}>{k}</div>
                    <div style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
                  </div>
                ))}
              </div>
              {fareOverNote && (
                <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 16, lineHeight: 1.6 }}>
                  往復交通費が{fareOverNote}。実際に支払った金額か確認してください。
                </div>
              )}
              {errorBox}
              <button onClick={send} disabled={sending} style={{ ...primaryButton, opacity: sending ? 0.6 : 1, marginBottom: 12 }}>
                {sending ? '送信中…' : 'この内容で送信'}
              </button>
              <button onClick={() => setStep('edit')} disabled={sending} style={secondaryButton}>戻って直す</button>
            </>
          )}

          {step === 'edit' && (
            <>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{userName} さんの日報</div>
              {restored && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(196, 181, 253, 0.35)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  書きかけの日報を戻しました
                  <button type="button" onClick={startOver} style={{ background: 'none', border: 'none', color: '#c4b5fd', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>
                    消して最初から
                  </button>
                </div>
              )}
              <div style={sectionStyle}>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>勤務日</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {dateChips.map((d) => {
                    const missing = missingDates.includes(d);
                    const selected = d === date;
                    const text = d === today ? `今日 ${dateWithWeekday(d)}` : d === yesterday ? `昨日 ${dateWithWeekday(d)}` : dateWithWeekday(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDate(d)}
                        style={{ ...chipStyle(selected), ...(missing && !selected && { borderColor: '#cc3333', color: '#ff6666' }) }}
                      >
                        {text}{missing && <span style={{ fontSize: 11, marginLeft: 4 }}>未提出</span>}
                      </button>
                    );
                  })}
                  {/* 透明な日付欄をボタンに重ね、押したらその場で日付を選ぶ画面を開く（行を増やさない） */}
                  <label style={{ ...chipStyle(isOtherDate), position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    {isOtherDate ? dateWithWeekday(date) : '他の日'}
                    <input
                      type="date"
                      value={date}
                      max={today}
                      onChange={(e) => e.target.value && setDate(e.target.value)}
                      // PC のブラウザは欄を押しただけでは選ぶ画面が開かないため、明示的に開く
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      aria-label="他の日を選ぶ"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginTop: 16 }}>
                  勤務地
                  <input type="text" list="nippo-locations" value={location} onChange={(e) => setLocation(e.target.value)} style={{ ...inputStyle, marginTop: 6, height: 44 }} />
                  <datalist id="nippo-locations">
                    {shiftLocations.map((l) => <option key={l} value={l} />)}
                  </datalist>
                </label>
                {shiftLocations.length === 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>この日のシフトが見つからないため、勤務地を入力してください</div>
                )}
                {/* 勤務の種類。0だった日は所感と交通費、研修は交通費だけ入力する */}
                {/* 稼働カードの「関東／九州」と同じデザイン: 選択中だけ明るいグレー、それ以外は背景なしで文字を薄く */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginTop: 16, padding: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
                  {MODE_OPTIONS.map((o) => (
                    <button
                      key={o.mode}
                      type="button"
                      onClick={() => setMode(o.mode)}
                      aria-pressed={mode === o.mode}
                      style={{
                        height: 40,
                        borderRadius: 6,
                        border: 'none',
                        padding: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: mode === o.mode ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: mode === o.mode ? 'var(--text-main)' : 'var(--text-muted)',
                        transition: 'background 0.15s',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {mode !== 'normal' && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{mode === 'zero' ? '着座数・所感・交通費を入力します' : '交通費だけ入力します'}</div>
                )}
              </div>

              {sections.map((s) => (
                <div key={s.title} style={sectionStyle}>
                  <div style={{ fontSize: 19, fontWeight: 800 }}>{s.title}</div>
                  {s.hint && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.hint}</div>}
                  <div style={{ marginTop: 4 }}>{s.fields.map(renderField)}</div>
                </div>
              ))}

              {errorBox}
              <button onClick={goConfirm} style={primaryButton}>確認へ進む</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
