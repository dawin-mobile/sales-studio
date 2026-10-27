'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, PenLine } from 'lucide-react';
import { NIPPO_SECTIONS, sectionsFor, validateNippo, type NippoField, type NippoMode } from '@/lib/nippoForm';

// 前回の交通費を勤務地ごとに覚えておく（この端末だけの便利機能。読めなくても動く）
const FARE_STORAGE_KEY = 'nippo-fare-by-location';

function loadFares(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FARE_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveFare(location: string, fare: string) {
  try {
    localStorage.setItem(FARE_STORAGE_KEY, JSON.stringify({ ...loadFares(), [location]: fare }));
  } catch {}
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 小数の足し引きで 0.15000000000000002 のような誤差が出ないよう小数第2位で丸める（aggregator.ts の safeAdd と同じ考え方）
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
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
        borderRadius: 17,
        border: alert ? 'none' : '1px solid var(--border-color)',
        background: alert ? 'var(--accent-color)' : 'var(--card-bg)',
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
          borderRadius: 9, background: '#fff', color: 'var(--accent-color)', fontSize: 11, fontWeight: 800,
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

export default function NippoForm({ onClose, missingDates }: { onClose: () => void; missingDates: string[] }) {
  const { data: session } = useSession();
  const [date, setDate] = useState(todayJst());
  const [location, setLocation] = useState('');
  const [shiftLocations, setShiftLocations] = useState<string[]>([]);
  const [mode, setMode] = useState<NippoMode>('normal');
  const [values, setValues] = useState<Record<string, string>>({ taxi: '0' });
  // ＋ボタンで足した数の履歴。−ボタンで直前の1回分ずつ取り消す
  const [stepHistory, setStepHistory] = useState<Record<string, number[]>>({});
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
        if (data.locations[0]) setLocation(data.locations[0]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date]);

  // 勤務地が決まったら、前回その勤務地で入れた交通費を入れておく（未入力のときだけ）
  useEffect(() => {
    const fare = loadFares()[location];
    if (fare) setValues((v) => (v.fare ? v : { ...v, fare }));
  }, [location]);

  // 着座数を自分で触っていない間は、実績か自己クロのどれかが0でなければ自動で1にする
  const effectiveValues = useMemo(() => {
    if (values.seated !== undefined) return values;
    const hasResult = [...RESULT_KEYS, 'selfClose'].some((k) => parseFloat(values[k] ?? '') > 0);
    return { ...values, seated: hasResult ? '1' : '' };
  }, [values]);

  const setValue = (key: string, value: string) => {
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

  const submission = { date, location, mode, values: effectiveValues };
  const sections = sectionsFor(mode);
  const toggleMode = (m: NippoMode) => setMode((cur) => (cur === m ? 'normal' : m));

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
      if (values.fare) saveFare(location, values.fare);
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {f.label}{f.required && <span style={{ color: 'var(--accent-color)', marginLeft: 4 }}>*</span>}
        </div>
        {f.hint && <div style={{ fontSize: 11, color: '#999', marginTop: 2, lineHeight: 1.4 }}>{f.hint}</div>}
      </div>
    );

    if (f.kind === 'number') {
      const canUndo = (stepHistory[f.key]?.length ?? 0) > 0;
      const filled = parseFloat(v) > 0;
      return (
        <div key={f.key} style={{ padding: '12px 0', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {label}
            <input
              type="text"
              inputMode="decimal"
              value={v}
              onChange={(e) => setValue(f.key, e.target.value)}
              placeholder="0"
              style={{
                ...inputStyle,
                width: 84,
                textAlign: 'right',
                flexShrink: 0,
                fontWeight: filled ? 700 : 400,
                // 数字が入った欄はアクセントの赤でうっすら色づけして、どこに入力したか分かるようにする
                ...(filled && { background: 'rgba(229, 62, 62, 0.12)', borderColor: 'rgba(229, 62, 62, 0.55)' }),
              }}
            />
          </div>
          {f.copyTotal && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => copyTotal(f.key)} style={stepButton}>実績と同じ</button>
            </div>
          )}
          {f.steps && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => undoStep(f.key)}
                disabled={!canUndo}
                aria-label={`${f.label}を1回分減らす`}
                style={{ ...stepButton, width: 44, opacity: canUndo ? 1 : 0.35 }}
              >
                −
              </button>
              {f.steps.map((st) => (
                <button key={st.value} type="button" onClick={() => addStep(f.key, st.value)} style={stepButton}>
                  +{st.value}
                </button>
              ))}
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
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{shortDate(date)} の日報を送信しました</div>
              <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7, marginBottom: 32 }}>
                アプリの数字には、次の日報合算（21時・0時・10時）のあとに反映されます。
              </div>
              <button onClick={onClose} style={primaryButton}>閉じる</button>
            </div>
          )}

          {step === 'confirm' && (
            <>
              <div style={sectionStyle}>
                {[
                  ['勤務日', shortDate(date)],
                  ['名前', session?.user?.name ?? ''],
                  ['店舗形式', mode === 'training' ? '研修' : mode === 'zero' ? '業務委託（0だった日）' : '業務委託'],
                  ['勤務地', location],
                  ...sections.flatMap((s) => s.fields.filter((f) => effectiveValues[f.key]?.trim()).map((f) => [f.label, effectiveValues[f.key].trim()])),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: 14 }}>
                    <div style={{ width: 140, flexShrink: 0, color: '#aaa' }}>{k}</div>
                    <div style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16, lineHeight: 1.6 }}>
                送信後はアプリから修正できません。間違えたときは社員に連絡してください。
              </div>
              {errorBox}
              <button onClick={send} disabled={sending} style={{ ...primaryButton, opacity: sending ? 0.6 : 1, marginBottom: 12 }}>
                {sending ? '送信中…' : 'この内容で送信'}
              </button>
              <button onClick={() => setStep('edit')} disabled={sending} style={secondaryButton}>戻って直す</button>
            </>
          )}

          {step === 'edit' && (
            <>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{session?.user?.name} さんの日報</div>
              <div style={sectionStyle}>
                {missingDates.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: '#ff6666' }}>
                    未提出:
                    {missingDates.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDate(d)}
                        style={{ border: '1px solid #cc3333', background: d === date ? '#cc3333' : 'transparent', color: d === date ? '#fff' : '#ff6666', borderRadius: 12, padding: '2px 10px', fontSize: 12, cursor: 'pointer' }}
                      >
                        {shortDate(d)}
                      </button>
                    ))}
                  </div>
                )}
                {/* 勤務日と勤務地は同じ横幅・同じ高さで縦に並べる（iPhone の日付欄のはみ出しは globals.css で抑えている） */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <label style={{ fontSize: 12, color: '#aaa', minWidth: 0 }}>
                    勤務日
                    <input type="date" value={date} max={todayJst()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...inputStyle, marginTop: 4, height: 44 }} />
                  </label>
                  <label style={{ fontSize: 12, color: '#aaa', minWidth: 0 }}>
                    勤務地
                    <input type="text" list="nippo-locations" value={location} onChange={(e) => setLocation(e.target.value)} style={{ ...inputStyle, marginTop: 4, height: 44 }} />
                    <datalist id="nippo-locations">
                      {shiftLocations.map((l) => <option key={l} value={l} />)}
                    </datalist>
                  </label>
                </div>
                {shiftLocations.length === 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>この日のシフトが見つからないため、勤務地を入力してください</div>
                )}
                {([['zero', '0だった日（交通費だけ入力）'], ['training', '研修の日（交通費だけ入力）']] as const).map(([m, text]) => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={mode === m} onChange={() => toggleMode(m)} style={{ width: 20, height: 20, accentColor: 'var(--accent-color)' }} />
                    {text}
                  </label>
                ))}
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
