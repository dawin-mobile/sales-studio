'use client';

import { useEffect, useState } from 'react';
import { FileText, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
// 型だけ読む（中身はアプリの JS に入れず、/api/shiryo から受け取る）
import type { Shiryo } from '@/lib/shiryo';

const fileUrl = (name: string) => `/api/shiryo/file/${encodeURIComponent(name)}`;

function useShiryo() {
  const [items, setItems] = useState<Shiryo[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/shiryo')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.items))
      .catch(() => setError(true));
  }, []);
  return { items, error };
}

const fmtDate = (ymd: string) => {
  const [, m, d] = ymd.split('-');
  return `${Number(m)}/${Number(d)}`;
};

// ホームの上に置く入口カード。見られないロールでは API が 403 を返すので何も出さない
export function ShiryoEntryCard({ onOpen }: { onOpen: () => void }) {
  const { items } = useShiryo();
  if (!items || items.length === 0) return null;
  const latest = items[0];
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '12px 14px', marginBottom: 12,
        color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <FileText size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-sub)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>資料・トーク</div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {latest.title}（{fmtDate(latest.updated)} 更新）
        </div>
      </div>
      <ChevronRight size={18} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-sub)' }} />
    </button>
  );
}

// 画像の拡大表示（タップで「画面幅」と「拡大」を切り替え、拡大中はスクロールで見る）
function ImageViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(env(safe-area-inset-top) + 10px) 12px 10px', color: '#fff' }}>
        <div style={{ flex: 1, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <button onClick={() => setZoomed(!zoomed)} aria-label={zoomed ? '画面幅に戻す' : '拡大'} style={iconBtn}>
          {zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
        </button>
        <button onClick={onClose} aria-label="閉じる" style={iconBtn}>
          <X size={22} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          onClick={() => setZoomed(!zoomed)}
          style={{ display: 'block', width: zoomed ? '250%' : '100%', maxWidth: zoomed ? 'none' : 1200, margin: '0 auto' }}
        />
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
  color: '#fff', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

function ShiryoCard({ item }: { item: Shiryo }) {
  const [viewing, setViewing] = useState(false);
  const hasTalk = !!item.talk && item.talk.length > 0;
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 'bold', color: 'var(--text-main)' }}>{item.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', flexShrink: 0 }}>{fmtDate(item.updated)} 更新</div>
      </div>
      {item.note && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 10 }}>{item.note}</div>}

      {item.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(item.image)}
            alt={item.title}
            onClick={() => setViewing(true)}
            style={{ display: 'block', width: '100%', borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'zoom-in', background: '#fff' }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: 'var(--text-sub)' }}>
            <span>タップで拡大</span>
            {item.pdf && (
              <a href={fileUrl(item.pdf)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-sub)', textDecoration: 'underline' }}>
                PDF を開く
              </a>
            )}
          </div>
          {viewing && <ImageViewer src={fileUrl(item.image)} title={item.title} onClose={() => setViewing(false)} />}
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-sub)', padding: '10px 0' }}>資料は準備中です</div>
      )}

      <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-main)', marginBottom: 8 }}>トーク</div>
        {hasTalk ? (
          item.talk!.map((sec, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-sub)', marginBottom: 4 }}>{sec.heading}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{sec.body}</div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>トークは準備中です（現場で固めてから追加します）</div>
        )}
      </div>
    </div>
  );
}

// 日報の画面と同じ「‹ 画面名」の見出し。‹ でホームに戻る
function BackHeader({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
      <button
        onClick={onBack}
        aria-label="戻る"
        style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0' }}
      >
        <ChevronLeft size={24} strokeWidth={1.75} />
      </button>
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>資料・トーク</span>
    </div>
  );
}

export default function ShiryoView({ onBack }: { onBack: () => void }) {
  const { items, error } = useShiryo();

  const message = (text: string, color = 'var(--text-soft)') => (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <BackHeader onBack={onBack} />
      <div style={{ textAlign: 'center', padding: 40, color }}>{text}</div>
    </div>
  );
  if (error) return message('資料を読み込めませんでした', 'var(--accent-red)');
  if (!items) return message('読み込んでいます...');
  if (items.length === 0) return message('資料はまだありません');

  // カテゴリごとにまとめる（一覧は新しい順なので、最近更新したカテゴリが上に来る）
  const groups = new Map<string, Shiryo[]>();
  for (const it of items) {
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category)!.push(it);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 24 }}>
      <BackHeader onBack={onBack} />
      {[...groups].map(([cat, list]) => (
        <section key={cat} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text-sub)', margin: '4px 0 8px' }}>{cat}</h3>
          {list.map((it) => <ShiryoCard key={it.id} item={it} />)}
        </section>
      ))}
    </div>
  );
}
