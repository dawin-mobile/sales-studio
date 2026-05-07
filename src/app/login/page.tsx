'use client';
import Image from 'next/image';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      userId,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('ユーザーIDまたはパスワードが正しくありません');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f0f0f',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#1f1f1f',
        border: '1px solid #3e3e3e',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '380px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <div style={{ 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  gap: '10px',             /* 画像と文字の隙間 */
  fontSize: '24px', 
  fontWeight: 'bold', 
  color: '#fff' 
}}>
  {/* ここに画像を表示！ */}
  <Image 
    src="/L-icon4w-512.png" 
    alt="ロゴ" 
    width={32} 
    height={32} 
  />
  Sales Studio
</div>
          <div style={{ fontSize: '13px', color: '#aaa', marginTop: '8px' }}>
            ログインしてください
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255, 78, 69, 0.1)',
            border: '1px solid #ff4e45',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#ff4e45',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="login-userid" style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>
            ユーザーID
          </label>
          <input
            id="login-userid"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            autoComplete="username"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#111',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="login-password" style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>
            パスワード
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#111',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#555' : '#3ea6ff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
