'use client';

import { useSyncExternalStore } from 'react';
import { trackAccess } from './track';

// アプリの色（黒基調／白基調）。<html data-theme="light"> で白基調になり、色は globals.css の変数で切り替わる。
// 選んだ色は端末に保存し、開いた瞬間に色が入れ替わって見えないよう layout.tsx の小さなスクリプトで描画前に反映する
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';
const CHANGE_EVENT = 'themechange';

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 保存できない端末（プライベートモードなど）でも、開いている間は切り替わる
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 今の色と切り替え関数。どの画面の ☀／🌙 から切り替えても全部に反映される */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
    trackAccess('カラー変更');
  };
  return { theme, toggleTheme };
}

/** グラフ（Chart.js）用の色。キャンバスには CSS の変数が効かないので、テーマに合わせて実際の色を渡す */
export function useChartColors() {
  const { theme } = useTheme();
  const light = theme === 'light';
  return {
    grid: light ? '#d9d6cf' : '#333',
    tick: light ? '#6b6862' : '#aaa',
    legend: light ? '#2b2b2b' : '#fff',
    sliceBorder: light ? '#f2f1ed' : '#1f1f1f', // ドーナツの切れ目（カードの色に合わせる）
  };
}
