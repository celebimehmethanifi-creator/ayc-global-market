"use client";
import { useState } from 'react';
import { useExchange } from '@/lib/exchange/ExchangeContext';
import { EXCHANGE_INFO, type ExchangeId, type ConnectedExchange } from '@/lib/exchange/types';

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const EXCHANGES: { id: ExchangeId; name: string; logo: string; color: string; desc: string; hasPassphrase: boolean }[] = [
  { id: 'binance', name: 'Binance', logo: '🟡', color: '#F0B90B', desc: "Dünyanın en büyük kripto borsasi. BTC, ETH ve 300+ coinle işlem yapın.", hasPassphrase: false },
  { id: 'bybit', name: 'Bybit', logo: '🟠', color: '#FF6B35', desc: "Hızlı ve güvenilir spot & futures borsa. Düşük komisyon, yüksek likidite.", hasPassphrase: false },
  { id: 'okx', name: 'OKX', logo: '⚫', color: '#a0a0a0', desc: "Global kripto borsası. Spot, Futures, Options ve DeFi destekli.", hasPassphrase: true },
];

export default function BrokersPage() {
  const { exchanges, addExchange, removeExchange, refreshBalance, isLoading } = useExchange();
  const [connectingId, setConnectingId] = useState<ExchangeId | null>(null);
  const [form, setForm] = useState({ apiKey: '', apiSecret: '', passphrase: '' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; balance?: number; totalBalance?: number; currency?: string; error?: string } | null>(null);
  const [expandedId, setExpandedId] = useState<ExchangeId | null>(null);

  async function handleConnect(exId: ExchangeId) {
    if (IS_PRODUCTION) {
      alert("Gerçek borsa baglantisi güvenlik sertleştirmesi tamamlanana kadar kapalıdır.");
      return;
    }
    if (!form.apiKey || !form.apiSecret) { alert('API Key ve Secret zorunlu'); return; }
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/v1/exchange/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ exchange: exId, apiKey: form.apiKey.trim(), apiSecret: form.apiSecret.trim(), passphrase: form.passphrase.trim() }),
      });
      const d = await res.json();
      setTestResult(d);
      if (d.ok) {
        const ex: ConnectedExchange = {
          exchange: exId,
          connectionId: d.connectionId,
          name: EXCHANGE_INFO[exId].name,
          connectedAt: d.connectedAt || new Date().toISOString(),
          totalBalance: d.totalBalance,
          currency: d.currency,
        };
        addExchange(ex);
        setConnectingId(null); setForm({ apiKey: '', apiSecret: '', passphrase: '' });
      }
    } catch (e: any) { setTestResult({ ok: false, error: e.message }); }
    finally { setTesting(false); }
  }

  const connected = (id: ExchangeId) => exchanges.find(e => e.exchange === id);
  const totalBalance = exchanges.reduce((s, e) => s + (e.totalBalance || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#fff', padding: '20px 16px 80px', maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, margin: 0 }}>Borsa Bağlantıları</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>API anahtarınızı bağlayın, AYC borsanız üzerinden işlem yapsın</p>
      </div>

      {IS_PRODUCTION && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: 12, lineHeight: 1.5 }}>
          Gerçek borsa baglantisi güvenlik sertleştirmesi tamamlanana kadar kapalıdır. Paper trading/demo kullanilabilir.
        </div>
      )}

      {/* Total balance */}
      {exchanges.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 2 }}>Toplam Portföy</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>${totalBalance.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 2 }}>{exchanges.length} Borsa Bağlı</div>
            <div style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>Aktif</div>
          </div>
        </div>
      )}

      {/* Exchange cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {EXCHANGES.map(ex => {
          const conn = connected(ex.id);
          const isConnecting = connectingId === ex.id;
          const isExpanded = expandedId === ex.id;
          return (
            <div key={ex.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${conn ? ex.color + '40' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: ex.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{ex.logo}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{ex.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{ex.desc.substring(0, 40)}...</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {conn ? (
                      <>
                        <div style={{ color: '#10b981', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>BAĞLI</div>
                        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>${(conn.totalBalance || 0).toLocaleString('en', { minimumFractionDigits: 0 })}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{conn.currency || 'USDT'}</div>
                      </>
                    ) : (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Bağlı değil</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {conn ? (
                    <>
                      <button onClick={() => refreshBalance(ex.id)} disabled={isLoading}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12 }}>
                        {isLoading ? '...' : 'Bakiye Güncelle'}
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1px solid ${ex.color}40`, background: ex.color + '15', color: ex.color, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {isExpanded ? 'Kapat' : 'Detaylar'}
                      </button>
                      <button onClick={() => { if (confirm(ex.name + ' bağlantısını kes?')) removeExchange(ex.id); }}
                        style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Kes</button>
                    </>
                  ) : (
                    <button onClick={() => { if (!IS_PRODUCTION) { setConnectingId(isConnecting ? null : ex.id); setTestResult(null); setForm({ apiKey: '', apiSecret: '', passphrase: '' }); } }}
                      disabled={IS_PRODUCTION}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: IS_PRODUCTION ? 'rgba(255,255,255,0.15)' : `linear-gradient(135deg, ${ex.color}, ${ex.color}bb)`, color: IS_PRODUCTION ? 'rgba(255,255,255,0.55)' : '#000', cursor: IS_PRODUCTION ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
                      {IS_PRODUCTION ? 'Production’da Kapalı' : (isConnecting ? 'İptal' : ex.name + " Bağla")}
                    </button>
                  )}
                </div>
              </div>

              {/* Connect form */}
              {isConnecting && !conn && !IS_PRODUCTION && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px', background: 'rgba(0,0,0,0.3)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6, display: 'block' }}>API Key</label>
                    <input type="text" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="API Key giriniz..."
                      style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: ex.hasPassphrase ? 12 : 16 }}>
                    <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6, display: 'block' }}>API Secret</label>
                    <input type="password" value={form.apiSecret} onChange={e => setForm(f => ({ ...f, apiSecret: e.target.value }))} placeholder="API Secret giriniz..."
                      style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  {ex.hasPassphrase && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6, display: 'block' }}>Passphrase</label>
                      <input type="password" value={form.passphrase} onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))} placeholder="Passphrase giriniz..."
                        style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  {testResult && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: testResult.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, color: testResult.ok ? '#10b981' : '#ef4444', fontSize: 13 }}>
                      {testResult.ok ? `Bağlanti basarili! Bakiye: $${(testResult.totalBalance ?? testResult.balance ?? 0).toFixed(2)} ${testResult.currency}` : `Hata: ${testResult.error || 'Hata'}`}
                    </div>
                  )}
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    API izinleri: Sadece "İşlem" izni verin. Para çekme izni VERMEYİN.
                    Credential verisi backend tarafında şifrelenmiş olarak saklanir.
                  </div>
                  <button onClick={() => handleConnect(ex.id)} disabled={testing}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: testing ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${ex.color}, ${ex.color}aa)`, color: testing ? 'rgba(255,255,255,0.5)' : '#000', cursor: testing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
                    {testing ? 'Test ediliyor...' : 'Bağlan ve Dogrula'}
                  </button>
                </div>
              )}

              {/* Expanded balance details */}
              {isExpanded && conn && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: 16, background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>Son güncelleme: {new Date(conn.connectedAt).toLocaleString('tr-TR')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Toplam Bakiye', value: `$${(conn.totalBalance || 0).toFixed(2)}` },
                      { label: 'Para Birimi', value: conn.currency || 'USDT' },
                      { label: 'Borsa', value: conn.name },
                      { label: 'Durum', value: 'Aktif' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 9, padding: '10px 12px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 3 }}>{item.label}</div>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info section */}
      <div style={{ marginTop: 32, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Nasıl Çalışır?</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['1', 'Borsanızda API anahtarı oluşturun', 'Sadece işlem izni verin, para çekme izni VERMEYİN'],
            ['2', 'API Key ve Secret girin', 'Bilgiler backend tarafında şifreli saklanır'],
            ['3', 'AYC borsanız üzerinden islem yapar', 'Market veya limit emirler, anlık fiyatla'],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, minWidth: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>{num}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{title}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
