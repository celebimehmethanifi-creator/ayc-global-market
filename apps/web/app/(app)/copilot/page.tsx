"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useExchange } from "@/lib/exchange/ExchangeContext";
import { getUser, isGuestDemo } from "@/lib/auth";
import { Send, User, Loader2, RefreshCw, Sparkles, Clock, AlertTriangle, Shield, Flame, Activity, Brain, TrendingDown, Trash2, Lock, Crown, Zap } from "lucide-react";

const CHAT_STORAGE_KEY = "ayc_copilot_history";
const MAX_STORED_MSGS  = 50;

interface Msg { role:"user"|"assistant"; content:string; ts:string; model?:string; emotion?:any; }

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "Merhaba! Ben AYC AI Copilot — Psikolojik Kalkan modunda.\n\nPiyasa analizi, portföy değerlendirmesi ve sinyal yorumu için sorularınızı yanıtlıyorum.\n\nÖnemli: FOMO, panik veya intikam işlemi niyeti tespit edersem sizi önceden uyarırım.",
  ts: "—",
};

const QUICK_GROUPS = [
  { label:"Piyasa", color:"var(--info)", qs:[
    {label:"BTC analiz",     q:"Bitcoin icin teknik analiz yap, sinyal durumu nedir?"},
    {label:"Piyasa ozeti",   q:"Bugun global piyasalarda dikkat etmem gereken en onemli gelismeler neler?"},
    {label:"Makro gorunum",  q:"Fed, enflasyon ve merkez bankasi kararlarinin bugunun piyasasina etkisi nedir?"},
  ]},
  { label:"Portföy", color:"var(--gold)", qs:[
    {label:"Risk tarama",    q:"Portföyumde en yuksek riskli pozisyonlar hangileri?"},
    {label:"Rebalance",      q:"Portföy dagilimimu optimize etmem icin ne tavsiye edersin?"},
  ]},
  { label:"Sinyal", color:"var(--up)", qs:[
    {label:"SETUP nedir",    q:"Setup alarm aşaması nedir, ne zaman işleme giriş yapabilirim?"},
    {label:"KALKAN nedir",   q:"Kalkan modu ne zaman devreye girer, beni nasil korur?"},
  ]},
];

const EMOTION_META: Record<string,{label:string;color:string;dim:string;icon:any;warn:string}> = {
  fomo:    {label:"FOMO Alarmi",     color:"var(--warn)",  dim:"var(--warn-dim)",  icon:Flame,       warn:"Kovalama riski yuksek. Fiyat hareket etmis."},
  panic:   {label:"Panik Algilandi", color:"var(--down)",  dim:"var(--down-dim)",  icon:AlertTriangle,warn:"Duygusal karar riski. Sakin kal."},
  revenge: {label:"Intikam Islemi",  color:"var(--down)",  dim:"var(--down-dim)",  icon:TrendingDown, warn:"KALKAN: Intikam islemi en tehlikeli psikoloji."},
  overrisk:{label:"Asiri Risk",      color:"var(--purple)",dim:"var(--purple-dim)",icon:Shield,       warn:"Kaldıraç veya asiri pozisyon riski."},
  neutral: {label:"Normal",          color:"var(--up)",    dim:"var(--up-dim)",    icon:Activity,     warn:""},
};

function EmotionBadge({emotion}:{emotion:any}) {
  if (!emotion || emotion.dominant === "neutral") return null;
  const m = EMOTION_META[emotion.dominant] || EMOTION_META.neutral;
  const Icon = m.icon;
  return (
    <div style={{
      display:"flex",gap:6,alignItems:"flex-start",
      padding:"8px 12px",margin:"4px 0",
      background:m.dim,border:`1px solid ${m.color}40`,borderRadius:"var(--r-md)",
      fontSize:11,color:m.color,lineHeight:1.4,
    }}>
      <Icon size={12} style={{flexShrink:0,marginTop:1}}/>
      <div>
        <strong style={{display:"block",marginBottom:2}}>{m.label}</strong>
        {emotion.kalkan_warning || m.warn}
      </div>
    </div>
  );
}

function StreamBars({active}:{active:boolean}) {
  if(!active) return null;
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:2,height:14}}>
      {[5,9,12,7,10,6,11].map((h,i)=>(
        <div key={i} style={{
          width:2.5,borderRadius:2,background:"var(--gold)",height:h,
          animation:`stream-bar 0.8s ease-in-out ${i*0.1}s infinite alternate`,opacity:0.8
        }}/>
      ))}
    </div>
  );
}

export default function CopilotPage() {
  const { primaryExchange } = useExchange();
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [WELCOME_MSG];
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Msg[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [WELCOME_MSG];
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [marketOpen, setMarketOpen] = useState(false);

  // Determine market open status client-side to avoid hydration mismatch
  useEffect(() => {
    const h = new Date().getHours();
    setMarketOpen(h >= 10 && h < 18);
  }, []);

  // Determine actual tier
  const [userTier, setUserTier] = useState<"guest"|"free"|"pro"|"premium">("guest");
  useEffect(() => {
    const user = getUser();
    const guest = isGuestDemo();
    if (user?.tier === "elite") setUserTier("premium");
    else if (user?.tier === "pro") setUserTier("pro");
    else if (user) setUserTier("free");
    else if (guest) setUserTier("free"); // demo users get free tier
    else setUserTier("guest");
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toStore = msgs.slice(-MAX_STORED_MSGS);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
  }, [msgs]);

  const clearHistory = () => {
    setMsgs([WELCOME_MSG]);
    if (typeof window !== "undefined") localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const {data:briefing, refetch:refetchBrief, isFetching:bFetch} = useQuery({
    queryKey:["briefing"],
    queryFn:()=>api.get("/copilot/briefing/latest").then(r=>r.data).catch(()=>({summary:"Piyasalar analiz ediliyor...",generated_at:new Date().toISOString(),model_used:"mock"})),
    staleTime:300000,
  });

  const mut = useMutation({
    mutationFn:(m:string)=>api.post("/copilot/chat",{
      message:m,
      chat_history:msgs.slice(-8).map(x=>({role:x.role,content:x.content})),
      tier: userTier,
      exchange_connection_id: primaryExchange?.connectionId,
    }).then(r=>r.data),
    onSuccess:(d)=>{
      setMsgs(p=>[...p,{
        role:"assistant",
        content:d.reply||"Analiz tamamlandi.",
        ts:new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}),
        model:d.model_used,
        emotion:d.emotion,
      }]);
    },
  });

  const send = (text?:string) => {
    const msg=(text||input).trim();
    if(!msg||mut.isPending) return;
    setInput("");
    setMsgs(p=>[...p,{role:"user",content:msg,ts:new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}]);
    mut.mutate(msg);
  };

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,mut.isPending]);

  return (
    <div className="copilot-layout" style={{display:"flex",gap:16,height:"calc(100dvh - 120px)",maxWidth:1100,margin:"0 auto"}}>

      {/* LEFT SIDEBAR */}
      <div className="copilot-sidebar" style={{width:240,flexShrink:0,display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>
        {/* Briefing */}
        <div style={{background:"var(--bg-card)",border:"1px solid var(--gold-border)",borderRadius:"var(--r-lg)",padding:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Sparkles size={12} color="var(--gold)"/>
              <span style={{fontSize:10,fontWeight:700,color:"var(--gold)",letterSpacing:"0.06em"}}>SABAH BRIFING</span>
            </div>
            <button onClick={()=>refetchBrief()} className="btn-ghost" style={{padding:"3px 6px",minWidth:0,borderColor:"transparent"}}>
              <RefreshCw size={11} color="var(--t3)" style={{animation:bFetch?"spin 1s linear infinite":"none"}}/>
            </button>
          </div>
          <p style={{fontSize:12,color:"var(--t2)",lineHeight:1.55,margin:0}}>{briefing?.summary||"Yukleniyor..."}</p>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}>
            {briefing?.model_used && (
              <span style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--font-mono)",background:"var(--gold-dim)",padding:"1px 5px",borderRadius:3,border:"1px solid var(--gold-border)"}}>{briefing.model_used}</span>
            )}
            {briefing?.generated_at && (
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <Clock size={9} color="var(--t4)"/>
                <span style={{fontSize:10,color:"var(--t4)",fontFamily:"var(--font-mono)"}}>
                  {new Date(briefing.generated_at).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Psikolojik kalkan info */}
        <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <Shield size={11} color="var(--up)"/>
            <span style={{fontSize:10,fontWeight:700,color:"var(--up)",letterSpacing:"0.06em"}}>PSİKOLOJİK KALKAN</span>
          </div>
          {[
            {icon:Flame,      label:"FOMO",    color:"var(--warn)"},
            {icon:AlertTriangle,label:"Panik",  color:"var(--down)"},
            {icon:TrendingDown,label:"İntikam",color:"var(--down)"},
            {icon:Shield,     label:"Kaldıraç",color:"var(--purple)"},
          ].map(({icon:Icon,label,color})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
              <Icon size={10} color={color}/>
              <span style={{fontSize:11,color:"var(--t3)"}}>{label} tespiti</span>
            </div>
          ))}
          <div style={{marginTop:8,fontSize:10,color:"var(--t4)",lineHeight:1.5,borderTop:"1px solid var(--b1)",paddingTop:8}}>
            Sadece piyasayı değil, seni de analiz eder.
          </div>
        </div>

        {/* Tier Upsell */}
        {(userTier === "guest" || userTier === "free") && (
          <div style={{
            background:"linear-gradient(135deg,rgba(251,191,36,0.08),rgba(167,139,250,0.08))",
            border:"1px solid rgba(251,191,36,0.25)",
            borderRadius:"var(--r-lg)",padding:12,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <Crown size={11} color="var(--gold)"/>
              <span style={{fontSize:10,fontWeight:700,color:"var(--gold)",letterSpacing:"0.06em"}}>
                {userTier === "guest" ? "ÜYE OL - ÜCRETSIZ" : "PRO'YA GEÇ"}
              </span>
            </div>
            <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.55,marginBottom:10}}>
              {userTier === "guest"
                ? "Kayıt olarak 20 mesaj/gün, sinyal analizi ve portföy takibine ücretsiz eriş."
                : "Pro ile sınırsız analiz, destek/direnç seviyeleri, senaryo simülasyonu ve otomatik işlem."}
            </div>
            {[
              userTier === "guest"
                ? {icon:Zap, label:"20 mesaj/gün ücretsiz", locked:false}
                : {icon:Zap, label:"Sınırsız mesaj", locked:false},
              {icon:Brain, label:"GPT-4o derin analiz", locked:true},
              {icon:Shield, label:"Otomatik işlem yürütme", locked:true},
              {icon:Crown, label:"GPT+Claude konsensus", locked:true},
            ].map(({icon:Icon,label,locked})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,opacity:locked?0.45:1}}>
                {locked ? <Lock size={9} color="var(--t4)"/> : <Icon size={9} color="var(--gold)"/>}
                <span style={{fontSize:10,color:locked?"var(--t4)":"var(--t2)"}}>{label}</span>
              </div>
            ))}
            <a href={userTier==="guest"?"/signup":"/upgrade"} style={{
              display:"block",marginTop:10,padding:"7px 0",textAlign:"center",
              background:"linear-gradient(135deg,var(--gold),#b88a30)",borderRadius:"var(--r-sm)",
              fontSize:11,fontWeight:700,color:"var(--bg)",textDecoration:"none",
              border:"none",cursor:"pointer",
            }}>
              {userTier==="guest" ? "Hemen Üye Ol →" : "Pro'ya Yükselt →"}
            </a>
          </div>
        )}

        {/* Tier badge for pro/premium */}
        {(userTier === "pro" || userTier === "premium") && (
          <div style={{
            display:"flex",alignItems:"center",gap:6,
            padding:"8px 12px",borderRadius:"var(--r-md)",
            background: userTier==="premium"?"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(167,139,250,0.12))":"var(--bg-card)",
            border:`1px solid ${userTier==="premium"?"rgba(251,191,36,0.3)":"var(--b1)"}`,
          }}>
            <Crown size={11} color={userTier==="premium"?"var(--gold)":"var(--purple)"}/>
            <span style={{fontSize:10,fontWeight:700,color:userTier==="premium"?"var(--gold)":"var(--purple)"}}>
              {userTier==="premium" ? "PREMIUM AKTİF" : "PRO AKTİF"}
            </span>
            <span style={{fontSize:9,color:"var(--t4)",marginLeft:"auto"}}>
              {userTier==="premium" ? "GPT+Claude" : "GPT-4o"}
            </span>
          </div>
        )}

        {/* Quick groups */}
        {QUICK_GROUPS.map(g=>(
          <div key={g.label} style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-lg)",padding:12}}>
            <div style={{fontSize:10,fontWeight:700,color:g.color,letterSpacing:"0.06em",marginBottom:8}}>{g.label.toUpperCase()}</div>
            {g.qs.map(q=>(
              <button key={q.label} onClick={()=>send(q.q)} style={{
                textAlign:"left",padding:"7px 10px",width:"100%",
                background:"var(--bg-hover)",border:"1px solid var(--b1)",
                borderRadius:"var(--r-sm)",cursor:"pointer",fontFamily:"inherit",
                color:"var(--t2)",fontSize:11,fontWeight:500,marginBottom:4,
                transition:"all 0.12s",lineHeight:1.3,display:"block",
              }}
              onMouseEnter={e=>{(e.currentTarget.style.borderColor=g.color+"50");(e.currentTarget.style.color="var(--t1)");}}
              onMouseLeave={e=>{(e.currentTarget.style.borderColor="var(--b1)");(e.currentTarget.style.color="var(--t2)");}}
              >{q.label}</button>
            ))}
          </div>
        ))}
      </div>

      {/* CHAT AREA */}
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <div style={{padding:"10px 18px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,var(--gold-dim),var(--purple-dim))",border:"1px solid var(--gold-border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Brain size={15} color="var(--gold)"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",fontFamily:"var(--font-head)"}}>AYC AI Copilot</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:1}}>
              <div className="pulse-dot green"/>
              <span style={{fontSize:10,color:"var(--up)"}}>GPT-4o + Psikolojik Kalkan aktif</span>
              {userTier !== "guest" && (
                <span style={{
                  fontSize:9,padding:"1px 6px",borderRadius:3,fontFamily:"var(--font-mono)",fontWeight:700,
                  background: userTier==="premium"?"var(--gold-dim)": userTier==="pro"?"rgba(129,140,248,0.15)":"var(--bg-hover)",
                  color: userTier==="premium"?"var(--gold)": userTier==="pro"?"var(--purple)":"var(--t4)",
                  border: `1px solid ${userTier==="premium"?"var(--gold-border)": userTier==="pro"?"rgba(129,140,248,0.3)":"var(--b1)"}`,
                  textTransform:"uppercase" as const,
                }}>
                  {userTier}
                </span>
              )}
            </div>
          </div>
          <div style={{
            padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:"0.05em",
            background:marketOpen?"var(--up-dim)":"var(--bg-hover)",
            border:`1px solid ${marketOpen?"var(--up-border)":"var(--b1)"}`,
            color:marketOpen?"var(--up)":"var(--t3)"
          }}>{marketOpen?"ACIK":"KAPALI"}</div>
          <button onClick={clearHistory} title="Sohbeti temizle" style={{
            padding:"4px 6px",borderRadius:4,border:"1px solid var(--b1)",
            background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",
          }}>
            <Trash2 size={11} color="var(--t4)"/>
          </button>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 20px 12px",display:"flex",flexDirection:"column",gap:16}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:10,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-end"}}>
              <div style={{
                width:28,height:28,borderRadius:8,flexShrink:0,
                background:m.role==="user"?"var(--purple-dim)":"var(--gold-dim)",
                border:`1px solid ${m.role==="user"?"rgba(129,140,248,0.3)":"var(--gold-border)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                {m.role==="user"?<User size={12} color="var(--purple)"/>:<Brain size={12} color="var(--gold)"/>}
              </div>
              <div style={{maxWidth:"75%",display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",gap:3}}>
                {/* Emotion badge on assistant message */}
                {m.role==="assistant" && m.emotion && <EmotionBadge emotion={m.emotion}/>}
                <div style={{
                  padding:"11px 15px",
                  borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:m.role==="user"?"var(--purple-dim)":"var(--bg-hover)",
                  border:`1px solid ${m.role==="user"?"rgba(129,140,248,0.25)":"var(--b1)"}`,
                  fontSize:13,color:"var(--t1)",lineHeight:1.65,whiteSpace:"pre-wrap",
                }}>
                  {m.content}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"var(--t4)",fontFamily:"var(--font-mono)"}}>{m.ts}</span>
                  {m.model && <span style={{fontSize:9,color:"var(--gold)",background:"var(--gold-dim)",padding:"1px 5px",borderRadius:3,border:"1px solid var(--gold-border)",fontFamily:"var(--font-mono)"}}>{m.model}</span>}
                </div>
              </div>
            </div>
          ))}
          {mut.isPending && (
            <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
              <div style={{width:28,height:28,borderRadius:8,background:"var(--gold-dim)",border:"1px solid var(--gold-border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Brain size={12} color="var(--gold)"/>
              </div>
              <div style={{padding:"12px 16px",borderRadius:"14px 14px 14px 4px",background:"var(--bg-hover)",border:"1px solid var(--b1)"}}>
                <StreamBars active={true}/>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Mobile quick chips */}
        <div className="copilot-mobile-chips" style={{display:"none",padding:"8px 12px 0",overflowX:"auto",gap:6,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
          {QUICK_GROUPS.flatMap(g=>g.qs).slice(0,5).map(q=>(
            <button key={q.label} onClick={()=>send(q.q)} style={{
              flexShrink:0,padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:600,
              background:"var(--bg-hover)",border:"1px solid var(--b1)",color:"var(--t2)",
              cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
            }}>{q.label}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{padding:"12px 16px",borderTop:"1px solid var(--b1)",flexShrink:0}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
            <div style={{flex:1,position:"relative"}}>
              <textarea rows={1} value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder="Piyasa, portföy, sinyal veya FOMO hissediyorsanız yazın... (Enter = gönder)"
                style={{
                  width:"100%",background:"var(--bg)",border:"1px solid var(--b1)",
                  borderRadius:"var(--r-md)",padding:"10px 14px",
                  fontSize:13,color:"var(--t1)",outline:"none",
                  fontFamily:"var(--font-body)",resize:"none",lineHeight:1.5,
                  boxSizing:"border-box",transition:"border-color 0.15s",maxHeight:100,
                }}
                onFocus={e=>(e.target.style.borderColor="var(--gold-border)")}
                onBlur={e=>(e.target.style.borderColor="var(--b1)")}
              />
            </div>
            <button onClick={()=>send()} disabled={mut.isPending||!input.trim()} style={{
              width:40,height:40,borderRadius:"var(--r-md)",border:"none",cursor:"pointer",flexShrink:0,
              background:(!mut.isPending&&input.trim())?"linear-gradient(135deg,var(--gold),#b88a30)":"var(--bg-hover)",
              display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",
            }}>
              {mut.isPending?<Loader2 size={14} color="var(--t3)" style={{animation:"spin 1s linear infinite"}}/>
                           :<Send size={14} color={(!mut.isPending&&input.trim())?"var(--bg)":"var(--t4)"}/>}
            </button>
          </div>
          <div style={{fontSize:10,color:"var(--t4)",marginTop:7,textAlign:"center"}}>
            Bu içerik yatırım tavsiyesi değildir — Kendi araştırmanızı yapınız
          </div>
          {(userTier === "guest" || userTier === "free") && (
            <div style={{
              fontSize:10,color:"var(--gold)",marginTop:4,textAlign:"center",
              display:"flex",alignItems:"center",justifyContent:"center",gap:4,
            }}>
              <Crown size={9} color="var(--gold)"/>
              {userTier==="guest"
                ? "Misafir: 5 mesaj hakkınız var. Üye olun →"
                : "Ücretsiz: 20 mesaj/gün. Pro'ya geçerek sınırsız analiz yapın →"}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes stream-bar{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:768px){
          /* Mobile: copilot card must NOT slide under the bottom nav.
             Subtract ticker + topbar + bottom-nav + safe areas + 16px gap. */
          .copilot-layout{
            height: calc(100dvh
              - var(--app-ticker-height, 32px)
              - var(--app-header-height, 52px)
              - var(--app-bottom-nav-height, 58px)
              - var(--app-safe-top, 0px)
              - var(--app-safe-bottom, 0px)
              - 16px)!important;
            gap:0!important
          }
          .copilot-sidebar{display:none!important}
          .copilot-mobile-chips{display:flex!important}
          .copilot-mobile-chips::-webkit-scrollbar{display:none}
        }
      `}</style>
    </div>
  );
}
