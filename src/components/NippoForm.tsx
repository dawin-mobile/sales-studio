'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, PenLine } from 'lucide-react';
import { AREAS, GOAL_CHOICES, NIPPO_SECTIONS, validateNippo, type NippoField } from '@/lib/nippoForm';

type ShiftLocation = { location: string; area: string };

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

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  color: 'var(--text-main)',
  fontSize: 16, // 16px未満だとiOSで入力時に画面が拡大される
  padding: '8px 10px',
  width: '100%',
  boxSizing: 'border-box',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

type Step = 'edit' | 'confirm' | 'done';

export default function NippoForm({ onClose, missingDates }: { onClose: () => void; missingDates: string[] }) {
  const { data: session } = useSession();
  const [date, setDate] = useState(todayJst());
  const [area, setArea] = useState('関東');
  const [location, setLocation] = useState('');
  const [shiftLocations, setShiftLocations] = useState<ShiftLocation[]>([]);
  const [training, setTraining] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({ taxi: '0' });
  const [step, setStep] = useState<Step>('edit');
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // 日付を変えたら、その日のシフトから勤務地・エリアを入れ直す
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/nippo-form?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.locations)) return;
        setShiftLocations(data.locations);
        const first: ShiftLocation | undefined = data.locations[0];
        if (!first) return;
        setLocation(first.location);
        setArea(first.area);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date]);

  // 勤務地が決まったら、前回その勤務地で入れた交通費を入れておく（未入力のときだけ）
  useEffect(() => {
    const fare = loadFares()[location];
    if (fare) setValues((v) => (v.fare ? v : { ...v, fare }));
  }, [location]);

  const setValue = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const submission = { date, area, location, training, values };
  const sections = NIPPO_SECTIONS.filter((s) => !training || s.training);

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
    const v = values[f.key] ?? '';
    const label = (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {f.label}{f.required && <span style={{ color: 'var(--accent-color)', marginLeft: 4 }}>*</span>}
        </div>
        {f.hint && <div style={{ fontSize: 11, color: '#999', marginTop: 2, lineHeight: 1.4 }}>{f.hint}</div>}
      </div>
    );

    if (f.kind === 'number') {
      return (
        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          {label}
          <input
            type="text"
            inputMode="decimal"
            value={v}
            onChange={(e) => setValue(f.key, e.target.value)}
            placeholder="0"
            style={{ ...inputStyle, width: 84, textAlign: 'right', flexShrink: 0 }}
          />
        </div>
      );
    }
    if (f.kind === 'goal') {
      return (
        <div key={f.key} style={{ padding: '8px 0' }}>
          {label}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {GOAL_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue(f.key, c)}
                style={{
                  ...inputStyle,
                  width: 'auto',
                  fontSize: 14,
                  cursor: 'pointer',
                  background: v === c ? 'var(--accent-color)' : 'var(--bg-secondary)',
                  borderColor: v === c ? 'var(--accent-color)' : 'var(--border-color)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div key={f.key} style={{ padding: '8px 0' }}>
        {label}
        {f.kind === 'textarea' ? (
          <textarea value={v} onChange={(e) => setValue(f.key, e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }} />
        ) : (
          <input type="text" value={v} onChange={(e) => setValue(f.key, e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
        )}
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
                  ['店舗形式', training ? '研修' : '業務委託'],
                  ['勤務エリア', area],
                  ['勤務地', location],
                  ...sections.flatMap((s) => s.fields.filter((f) => values[f.key]?.trim()).map((f) => [f.label, values[f.key].trim()])),
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ fontSize: 12, color: '#aaa' }}>
                    勤務日
                    <input type="date" value={date} max={todayJst()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 12, color: '#aaa' }}>
                    名前
                    <div style={{ ...inputStyle, marginTop: 4, color: '#aaa' }}>{session?.user?.name}</div>
                  </label>
                  <label style={{ fontSize: 12, color: '#aaa' }}>
                    勤務エリア
                    <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                      {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, color: '#aaa' }}>
                    勤務地
                    <input type="text" list="nippo-locations" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例）イオンモール川口前川" style={{ ...inputStyle, marginTop: 4 }} />
                    <datalist id="nippo-locations">
                      {shiftLocations.map((l) => <option key={l.location} value={l.location} />)}
                    </datalist>
                  </label>
                </div>
                {shiftLocations.length === 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>この日のシフトが見つからないため、勤務地を入力してください</div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} style={{ width: 18, height: 18 }} />
                  研修の日（交通費だけ入力）
                </label>
              </div>

              {sections.map((s) => (
                <div key={s.title} style={sectionStyle}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</div>
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
