"use client";
import { useState, useEffect } from 'react';
import { useExchange } from '@/lib/exchange/ExchangeContext';
import { EXCHANGE_INFO, type ExchangeId } from '@/lib/exchange/types';

interface RealTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  price: number;
  defaultSide?: 'buy' | 'sell';
}

export default function RealTradeModal({ isOpen, onClose, symbol, name, price, defaultSide = 'buy' }: RealTradeModalProps) {
  const { exchanges, refreshBalance } = useExchange();
  const [selectedExId, setSelectedExId] = useState<ExchangeId | ''>('');
  const [side, setSide] = useState<'buy' | 'sell'>(defaultSide);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [usdAmount, setUsdAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'loading' | 'success' | 'error'>('form');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedEx = exchanges.find(e => e.exchange === selectedExId);

  useEffect(() => {
    if (isOpen) {
      setSide(defaultSide);
      setStep('form');
      setUsdAmount('');
      setLimitPrice(String(price));
      setResult(null);
      setErrorMsg('');
      if (exchanges.length > 0 && !selectedExId) setSelectedExId(exchanges[0].exchange);
    }
  }, [isOpen, defaultSide, price]);

  useEffect(() => {
    if (selectedExId) refreshBalance(selectedExId as ExchangeId).catch(() => {});
  }, [selectedExId]);

  const usdAmt = parseFloat(usdAmount) || 0;
  const lPrice = parseFloat(limitPrice) || price;
  const coinQty = usdAmt > 0 ? (usdAmt / (orderType === 'limit' ? lPrice : price)) : 0;

  async function handleExecute() {
    if (!selectedEx || usdAmt < 1) return;
    setStep('loading');
    try {
      const res = await fetch('/api/v1/exchange/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          connectionId: selectedEx.connectionId,
          symbol: symbol + 'USDT',
          side,
          type: orderType,
          quoteAmount: usdAmt,
        }),
      });
      const data = await res.json();
      if (data.ok || data.mode === 'paper') { setResult(data); setStep('success'); }
      else { setErrorMsg(data.error || 'Islem basarisiz'); setStep('error'); }
    } catch (e: any) {
      setErrorMsg(e.message || 'Baglanti hatasi');
      setStep('error');
    }
  }

  if (!isOpen) return null;

  const exInfo = selectedExId ? EXCHANGE_INFO[selectedExId as ExchangeId] : null;
  const balance = selectedEx?.totalBalance || 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', padding: 24, paddingBottom: 40, maxHeight: '90dvh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#fff' }}>CANLI ISLEM</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{name}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{symbol} - ${price.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 18 }}>x</button>
        </div>

        {exchanges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Borsa Baglantisi Yok</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20 }}>Gercek islem yapabilmek icin borsa API anahtarinizi baglayin.</div>
            <a href="/brokers" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', padding: '12px 24px', borderRadius: 12, textDecoration: 'none', fontWeight: 600 }}>Borsa Bagla</a>
          </div>
        ) : step === 'form' ? (
          <>
            {/* Exchange selector */}
            {exchanges.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {exchanges.map(ex => {
                  const info = EXCHANGE_INFO[ex.exchange];
                  return (
                    <button key={ex.exchange} onClick={() => setSelectedExId(ex.exchange)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${selectedExId === ex.exchange ? info.color : 'rgba(255,255,255,0.1)'}`, background: selectedExId === ex.exchange ? `${info.color}20` : 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {info.logo} {info.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Balance */}
            {selectedEx && (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Kullanilabilir Bakiye</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>${balance.toLocaleString('en', { minimumFractionDigits: 2 })} {selectedEx.currency || 'USDT'}</span>
              </div>
            )}

            {/* Side toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
              {(['buy', 'sell'] as const).map(s => (
                <button key={s} onClick={() => setSide(s)}
                  style={{ padding: '10px 0', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: side === s ? (s === 'buy' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)') : 'transparent', color: side === s ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}>
                  {s === 'buy' ? 'AL' : 'SAT'}
                </button>
              ))}
            </div>

            {/* Order type */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['market', 'limit'] as const).map(t => (
                <button key={t} onClick={() => setOrderType(t)}
                  style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${orderType === t ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.1)'}`, background: orderType === t ? 'rgba(245,158,11,0.15)' : 'transparent', color: orderType === t ? '#f59e0b' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {t === 'market' ? 'Piyasa' : 'Limit'}
                </button>
              ))}
            </div>

            {/* Limit price */}
            {orderType === 'limit' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6, display: 'block' }}>Limit Fiyat ($)</label>
                <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {/* USD Amount */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6, display: 'block' }}>Miktar (USDT)</label>
              <input type="number" value={usdAmount} onChange={e => setUsdAmount(e.target.value)} placeholder="0.00"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct} onClick={() => setUsdAmount(String((balance * pct / 100).toFixed(2)))}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    %{pct}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {usdAmt > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Alacaginiz</span>
                  <span style={{ color: '#fff', fontSize: 12 }}>{coinQty.toFixed(6)} {symbol}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Komisyon</span>
                  <span style={{ color: '#fff', fontSize: 12 }}>{exInfo?.fee}</span>
                </div>
              </div>
            )}

            <button onClick={() => setStep('confirm')} disabled={usdAmt < 1 || !selectedEx}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 16, cursor: usdAmt >= 1 ? 'pointer' : 'not-allowed', background: usdAmt >= 1 ? (side === 'buy' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)') : 'rgba(255,255,255,0.1)', color: '#fff', opacity: usdAmt >= 1 ? 1 : 0.5 }}>
              {side === 'buy' ? `${symbol} Al` : `${symbol} Sat`} - ${usdAmt > 0 ? usdAmt.toFixed(2) : '0.00'}
            </button>
          </>
        ) : step === 'confirm' ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>!</div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Emri Onayla</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Bu islem geri alinamaz</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              {[
                ['Islem', side === 'buy' ? 'ALIS' : 'SATIS'],
                ['Varlik', `${name} (${symbol})`],
                ['Miktar', `$${usdAmt.toFixed(2)} USDT`],
                ['Tahmini', `${coinQty.toFixed(6)} ${symbol}`],
                ['Borsa', exInfo?.name || ''],
                ['Emir Tipi', orderType === 'market' ? 'Piyasa' : 'Limit'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{k}</span>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setStep('form')} style={{ padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Iptal</button>
              <button onClick={handleExecute} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: side === 'buy' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Onayla</button>
            </div>
          </div>
        ) : step === 'loading' ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Islem Gonderiliyor...</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>{exInfo?.name} borsasina baglaniyor</div>
          </div>
        ) : step === 'success' ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✓</div>
            <div style={{ color: '#10b981', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {result?.mode === 'paper' ? 'Paper Trade Modu' : 'Islem Basarili!'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 20 }}>
              {result?.mode === 'paper'
                ? 'Gercek emir gonderilmedi. Production guvenlik guard aktif.'
                : `Emir ID: ${result?.orderId || 'N/A'}`}
            </div>
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
              {[['Borsa', exInfo?.name || ''], ['Varlik', symbol], ['Islem', side === 'buy' ? 'ALIS' : 'SATIS'], ['Durum', result?.status || (result?.mode === 'paper' ? 'DRY-RUN' : 'NEW')]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{k}</span>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Tamam</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✗</div>
            <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Islem Basarisiz</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{errorMsg}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={onClose} style={{ padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Kapat</button>
              <button onClick={() => setStep('form')} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>Tekrar Dene</button>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
