"use client";
import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { databaseConfigured, getSupabase } from './supabase';
import { databaseError } from './database';
import { loadHistory } from './storage';
import { importCloudInvoices } from './database';
import './database.css';

export default function DatabaseAccess({children}: {children: (userId: string) => ReactNode}) {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [localCount, setLocalCount] = useState(0);
  const [migrationMessage, setMigrationMessage] = useState('');
  useEffect(() => {
    if (!databaseConfigured) {setChecking(false); return;}
    let alive = true, revision = 0;
    const client = getSupabase();
    const check = async (id?: string, userEmail?: string) => {
      const current = ++revision;
      setUserId(''); setChecking(true); setError('');
      try {
        if (id) {
          const {data, error} = await client.from('invoice_admins').select('user_id').eq('user_id', id).maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('ADMIN_REQUIRED');
          if (alive && current === revision) { setUserId(id); setEmail(userEmail || ''); setLocalCount(loadHistory().length); }
        }
      } catch(e) { if (alive && current === revision) setError(databaseError(e)); }
      finally { if (alive && current === revision) setChecking(false); }
    };
    void client.auth.getSession().then(({data, error}) => {
      if (error) {if(alive) {setError(databaseError(error));setChecking(false);}return;}
      void check(data.session?.user.id, data.session?.user.email);
    });
    const {data: listener} = client.auth.onAuthStateChange((event, session) => {
      // Avoid running Supabase queries synchronously inside the auth event callback.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      setTimeout(() => {if(alive) void check(session?.user.id, session?.user.email);}, 0);
    });
    return () => {alive = false; revision++; listener.subscription.unsubscribe();};
  }, []);

  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const {error} = await getSupabase().auth.signInWithPassword({email: email.trim(), password});
      if (error) throw error;
      setPassword('');
    } catch(e) {setError(databaseError(e));}
    finally {setBusy(false);}
  };
  const migrate = async () => {
    if (!confirm('Pindahkan riwayat browser ini ke database easyUmroh? Invoice yang sudah ada di database tidak akan ditimpa.')) return;
    setBusy(true); setMigrationMessage('');
    try {
      const invoices = loadHistory().map(h => h.data);
      if (!invoices.length) throw new Error('Tidak ada riwayat browser untuk dipindahkan.');
      const saved = await importCloudInvoices(invoices);
      setMigrationMessage(`${saved.length} invoice berhasil dipindahkan. Cadangan browser tetap tersedia.`);
      setLocalCount(0);
    } catch(e) {setMigrationMessage(databaseError(e));}
    finally {setBusy(false);}
  };

  if (!databaseConfigured) return <main className="database-login"><section>
    <h1>Hubungkan Database Invoice</h1>
    <p>Isi konfigurasi Supabase dan jalankan schema.sql sesuai PANDUAN_DATABASE.md sebelum menggunakan aplikasi.</p>
    <p>Riwayat lama di browser tetap tersedia untuk dipindahkan setelah login.</p>
  </section></main>;
  if (checking) return <main className="database-login"><p role="status">Memeriksa akses database…</p></main>;
  if (!userId) return <main className="database-login"><form onSubmit={signIn}>
    <h1>Login Admin easyUmroh</h1><p>Masuk untuk mengakses invoice dan riwayat bersama.</p>
    <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy} type="submit">{busy ? 'Memproses…' : 'Masuk'}</button>
    {error && <button type="button" onClick={async()=>{await getSupabase().auth.signOut();setError('');}}>Keluar dari sesi</button>}
  </form></main>;
  return <div className="database-workspace">
    <div className="database-bar no-print">
      <span>Database aktif · {email}</span>
      {localCount > 0 && <button disabled={busy} onClick={migrate}>Pindahkan {localCount} INV dari browser</button>}
      <button onClick={async()=>{const {error}=await getSupabase().auth.signOut();if(error)setError(databaseError(error));}}>Keluar</button>
      {migrationMessage && <p role="status">{migrationMessage}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
    {children(userId)}
  </div>;
}
