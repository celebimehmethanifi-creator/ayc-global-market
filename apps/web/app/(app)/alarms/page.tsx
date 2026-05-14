"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, Plus, Trash2, Shield, Lock, Zap, TrendingDown, Activity, X, ChevronDown, Check } from "lucide-react";
import { usePrices } from "@/lib/prices/PriceContext";

const ALARM_TYPES = [
  {value:"price",     label:"Fiyat Alarmı",     icon:TrendingDown, color:"var(--info)",    dim:"rgba(96,165,250,0.08)",  border:"rgba(96,165,250,0.2)"},
  {value:"signal",    label:"Sinyal Alarmı",    icon:Zap,          color:"var(--purple)",  dim:"var(--purple-dim)",       border:"rgba(129,140,248,0.25)"},
  {value:"drawdown",  label:"Drawdown Kilidi",  icon:Lock,         color:"var(--down)",    dim:"var(--down-dim)",         border:"var(--down-border)"},
  {value:"contrarian",label:"Contrarian Uyarı", icon:Activity,     color:"var(--warn)",    dim:"var(--warn-dim)",         border:"rgba(245,158,11,0.25)"},
];

const MOCK_ALARMS = [
  {id:"a1",alarm_type:"price",   is_active:true,  created_at:"2026-05-10",condition:{symbol:"BTCUSDT",direction:"above",threshold:82000}},
  {id:"a2",alarm_type:"signal",  is_active:true,  created_at:"2026-05-09",condition:{symbol:"ETHUSDT",min_confidence:80}},
  {id:"a3",alarm_type:"drawdown",is_active:true,  created_at:"2026-05-08",condition:{max_drawdown_pct:10}},
];

function condSummary(alarm:any) {
  const c = alarm.condition||{};
  const symbol = String(c.symbol || alarm.symbol || "PORTFÖY").toUpperCase();
  if(alarm.alarm_type==="price") return `${symbol} ${c.direction==="above"?">=":"<="} $${c.threshold||""}`;
  if(alarm.alarm_type==="signal") return `${symbol} — min güven ${c.min_confidence||80}%`;
  if(alarm.alarm_type==="drawdown") return `Maksimum %${c.max_drawdown_pct||10} kayıp kilidi`;
  if(alarm.alarm_type==="contrarian") {
    const crowded = String(c.crowd_side || c.direction || "long").toUpperCase();
    return `${symbol} için contrarian uyarı aktif · Koşul: Kalabalık yönü aşırı ${crowded}.`;
  }
  return "Alarm koşulları güncelleniyor.";
}

export default function AlarmsPage() {
  const qc = useQueryClient();
  const livePrices = usePrices();
  const getLivePrice = (sym:string) => {
    const p = livePrices[sym] ?? livePrices[sym+"USDT"] ?? livePrices[sym.replace("/","")];
    return p?.price;
  };
  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState<1|2>(1);
  const [selType, setSelType] = useState("price");
  const [sym, setSym] = useState("BTCUSDT");
  const [thresh, setThresh] = useState("82000");
  const [dir, setDir] = useState("above");
  const [conf, setConf] = useState("80");
  const [ddPct, setDdPct] = useState("10");
  const [tab, setTab] = useState<"list"|"kalkan">("list");

  const {data:alarmsApi=[], isLoading} = useQuery({
    queryKey:["alarms"],
    queryFn:()=>api.get("/alarms").then(r=>r.data.alarms).catch(()=>[]),
    refetchInterval:20000,
  });
  const {data:kalkan} = useQuery({
    queryKey:["kalkan-status-full"],
    queryFn:()=>api.get("/alarms/kalkan-status").then(r=>r.data).catch(()=>({active_kalkan_blocks:[]})),
    refetchInterval:30000,
  });

  const delMut = useMutation({
    mutationFn:(id:string)=>api.delete(`/alarms/${id}`),
    onSuccess:()=>qc.invalidateQueries({queryKey:["alarms"]}),
  });
  const ddMut = useMutation({
    mutationFn:(pct:number)=>api.post("/alarms/drawdown-lock",{max_drawdown_pct:pct}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["alarms"]}),
  });
  const addMut = useMutation({
    mutationFn:(b:any)=>api.post("/alarms",b),
    onSuccess:()=>{qc.invalidateQueries({queryKey:["alarms"]});setShowAdd(false);setStep(1);},
  });

  const alarms = [...MOCK_ALARMS,...alarmsApi];
  const active = alarms.filter(a=>a.is_active).length;
  const kblocks = kalkan?.active_kalkan_blocks||[];

  function submitAlarm() {
    let cond: any = {};
    if(selType==="price") cond = {symbol:sym,direction:dir,threshold:+thresh};
    else if(selType==="signal") cond = {symbol:sym,min_confidence:+conf};
    else if(selType==="drawdown") cond = {max_drawdown_pct:+ddPct};
    else cond = {symbol:sym};
    addMut.mutate({alarm_type:selType,condition:cond});
  }

  const typeMeta = (t:string) => ALARM_TYPES.find(x=>x.value===t)||ALARM_TYPES[0];

  return (
    <div style={{maxWidth:960,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Bell size={18} color="var(--gold)"/>
            <h1 style={{fontFamily:"var(--font-head)",fontSize:20,fontWeight:800,color:"var(--t1)",margin:0}}>Alarm Merkezi</h1>
          </div>
          <p style={{fontSize:12,color:"var(--t3)",margin:"4px 0 0",paddingLeft:28}}>Fiyat uyarıları, sinyal alarmları ve KALKAN koruma sistemi</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="btn-gold" style={{display:"flex",alignItems:"center",gap:6}}>
          <Plus size={14}/> Alarm Ekle
        </button>
      </div>

      {/* STAT CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
        {[
          {label:"Toplam Alarm",  value:alarms.length, color:"var(--t1)",  icon:Bell,    dim:"var(--bg-hover)"},
          {label:"Aktif",         value:active,         color:"var(--up)", icon:Activity, dim:"var(--up-dim)"},
          {label:"Pasif",         value:alarms.length-active, color:"var(--t3)",icon:Bell,dim:"var(--bg-hover)"},
          {label:"Kalkan Bloke",  value:kblocks.length, color:"var(--down)",icon:Shield,  dim:"var(--down-dim)"},
        ].map(s=>(
          <div key={s.label} className="stat-card" style={{background:`linear-gradient(135deg,${s.dim},var(--bg-card))`,border:`1px solid var(--b1)`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span className="stat-label">{s.label}</span>
              <s.icon size={13} color={s.color} style={{opacity:0.4}}/>
            </div>
            <div className="stat-value" style={{color:s.color,fontSize:28}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:3,background:"var(--bg-card)",borderRadius:"var(--r-md)",padding:3,width:"fit-content",border:"1px solid var(--b1)"}}>
        {(["list","kalkan"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"6px 20px",borderRadius:7,border:"none",cursor:"pointer",
            background:tab===t?"var(--bg-hover)":"transparent",
            color:tab===t?"var(--t1)":"var(--t3)",
            fontSize:12,fontWeight:600,fontFamily:"inherit",transition:"all 0.15s"
          }}>
            {t==="list"?"Alarmlarim":"Kalkan Sistemi"}
          </button>
        ))}
      </div>

      {/* ALARM LIST */}
      {tab==="list" && (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {isLoading && [...Array(3)].map((_,i)=>(
            <div key={i} className="skeleton" style={{height:68,borderRadius:"var(--r-lg)"}}/>
          ))}
          {alarms.map(alarm=>{
            const m = typeMeta(alarm.alarm_type);
            return (
              <div key={alarm.id} style={{
                background:"var(--bg-card)",
                border:`1px solid ${alarm.is_active?m.border:"var(--b1)"}`,
                borderRadius:"var(--r-lg)",
                padding:"14px 18px",
                display:"flex",alignItems:"center",gap:14,
                transition:"border-color 0.15s",
              }}>
                {/* icon */}
                <div style={{
                  width:40,height:40,borderRadius:"var(--r-md)",
                  background:m.dim,border:`1px solid ${m.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                }}>
                  <m.icon size={17} color={m.color}/>
                </div>

                {/* info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                    <span className="badge" style={{background:m.dim,border:`1px solid ${m.border}`,color:m.color}}>
                      {alarm.alarm_type.toUpperCase()}
                    </span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--t1)",fontFamily:"var(--font-mono)"}}>
                      {alarm.condition?.symbol||"PORTFOY"}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:"var(--t3)",fontFamily:"var(--font-mono)"}}>
                    {condSummary(alarm)}
                  </div>
                </div>

                {/* status + delete */}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:alarm.is_active?"var(--up)":"var(--t3)"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:alarm.is_active?"var(--up)":"var(--t3)",
                      boxShadow:alarm.is_active?"0 0 6px var(--up)":"none"}}/>
                    {alarm.is_active?"Aktif":"Pasif"}
                  </div>
                  <button onClick={()=>delMut.mutate(alarm.id)} className="btn-ghost"
                    style={{padding:"5px 8px",minWidth:0,borderColor:"var(--down-border)",color:"var(--down)"}}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            );
          })}

          {!isLoading && alarms.length===0 && (
            <div style={{padding:48,textAlign:"center",background:"var(--bg-card)",border:"1px dashed var(--b1)",borderRadius:"var(--r-xl)"}}>
              <Bell size={28} color="var(--t4)" style={{marginBottom:12}}/>
              <div style={{fontSize:14,fontWeight:600,color:"var(--t3)"}}>Henüz alarm yok</div>
              <div style={{fontSize:12,color:"var(--t4)",marginTop:4}}>Yukarıdaki butona tıklayarak ilk alarmınızı oluşturun</div>
            </div>
          )}
        </div>
      )}

      {/* KALKAN TAB */}
      {tab==="kalkan" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,alignItems:"start"}}>

          {/* Drawdown config */}
          <div style={{
            background:"var(--bg-card)",
            border:"1px solid var(--down-border)",
            borderRadius:"var(--r-xl)",padding:24,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
              <div style={{width:44,height:44,borderRadius:"var(--r-md)",background:"var(--down-dim)",border:"1px solid var(--down-border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Lock size={20} color="var(--down)"/>
              </div>
              <div>
                <div style={{fontFamily:"var(--font-head)",fontSize:15,fontWeight:700,color:"var(--t1)"}}>Drawdown Kilidi</div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Portföy kaybı eşiğinde tüm sinyaller kilitlenir</div>
              </div>
            </div>

            {/* Visual gauge */}
            <div style={{position:"relative",height:8,background:"var(--b1)",borderRadius:4,marginBottom:16,overflow:"hidden"}}>
              <div style={{
                position:"absolute",left:0,top:0,bottom:0,
                width:`${Math.min(+ddPct*3,100)}%`,
                background:`linear-gradient(to right,var(--up),var(--warn),var(--down))`,
                borderRadius:4,transition:"width 0.3s"
              }}/>
              <div style={{
                position:"absolute",top:-4,width:16,height:16,borderRadius:"50%",
                background:"var(--down)",border:"2px solid var(--bg-card)",
                left:`calc(${Math.min(+ddPct*3,100)}% - 8px)`,transition:"left 0.3s"
              }}/>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
              <input type="range" min="2" max="30" value={ddPct}
                onChange={e=>setDdPct(e.target.value)}
                style={{flex:1,accentColor:"var(--down)",height:4}}/>
              <div style={{
                minWidth:52,padding:"6px 10px",fontFamily:"var(--font-mono)",
                fontSize:16,fontWeight:800,color:"var(--down)",textAlign:"center",
                background:"var(--down-dim)",border:"1px solid var(--down-border)",borderRadius:"var(--r-sm)"
              }}>%{ddPct}</div>
            </div>

            <button onClick={()=>ddMut.mutate(+ddPct)} disabled={ddMut.isPending}
              style={{
                width:"100%",padding:"10px",
                background:"linear-gradient(135deg,var(--down),#c0364e)",
                border:"none",borderRadius:"var(--r-md)",cursor:"pointer",
                color:"#fff",fontSize:13,fontWeight:700,fontFamily:"inherit",
                opacity:ddMut.isPending?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8
              }}>
              <Lock size={13}/> {ddMut.isPending?"Kaydediliyor...":"Kilidi Etkinlestir"}
            </button>
          </div>

          {/* Kalkan status */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",padding:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <Shield size={18} color={kblocks.length>0?"var(--down)":"var(--up)"}/>
              <span style={{fontFamily:"var(--font-head)",fontSize:15,fontWeight:700,color:"var(--t1)"}}>Kalkan Durumu</span>
            </div>

            {kblocks.length===0 ? (
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{
                  width:60,height:60,borderRadius:"50%",
                  background:"var(--up-dim)",border:"2px solid var(--up-border)",
                  display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"
                }}>
                  <Shield size={26} color="var(--up)"/>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--up)"}}>Sistem Normal</div>
                <div style={{fontSize:12,color:"var(--t3)",marginTop:4}}>Aktif kalkan blogu yok</div>
              </div>
            ) : kblocks.map((b:any)=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                background:"var(--down-dim)",border:"1px solid var(--down-border)",borderRadius:"var(--r-md)",marginBottom:8}}>
                <Lock size={13} color="var(--down)"/>
                <span style={{fontSize:12,color:"var(--t2)",flex:1}}>{b.alarm_type}</span>
                <span style={{fontSize:10,color:"var(--t3)"}}>{b.created_at?.slice(0,10)||""}</span>
              </div>
            ))}

            <div style={{marginTop:16,padding:"12px 14px",background:"var(--bg-hover)",borderRadius:"var(--r-md)"}}>
              <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.6}}>
                KALKAN sistemi anlık portföy hareketini izler. Belirlenen eşiğe ulaşıldığında tüm sinyal bildirimleri ve giriş onayları otomatik kilitlenir, duygusal kararlar engellenir.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"var(--bg-modal)",backdropFilter:"blur(8px)",zIndex:100,
          display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
             onClick={e=>e.target===e.currentTarget&&(setShowAdd(false),setStep(1))}>
          <div style={{background:"var(--bg-panel)",border:"1px solid var(--b2)",borderRadius:"var(--r-xl)",padding:28,width:"100%",maxWidth:440}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
              <div>
                <span style={{fontFamily:"var(--font-head)",fontSize:15,fontWeight:700,color:"var(--t1)"}}>
                  {step===1?"Alarm Tipi Sec":"Kosul Tanimla"}
                </span>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>Adim {step} / 2</div>
              </div>
              <button onClick={()=>{setShowAdd(false);setStep(1);}} className="btn-ghost" style={{padding:"4px 8px",minWidth:0}}>
                <X size={13}/>
              </button>
            </div>

            {/* Step 1 - Type */}
            {step===1 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                {ALARM_TYPES.map(t=>(
                  <button key={t.value} onClick={()=>setSelType(t.value)} style={{
                    display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"16px 12px",
                    background:selType===t.value?t.dim:"var(--bg-hover)",
                    border:`1px solid ${selType===t.value?t.border:"var(--b1)"}`,
                    borderRadius:"var(--r-lg)",cursor:"pointer",transition:"all 0.15s",fontFamily:"inherit"
                  }}>
                    <t.icon size={20} color={selType===t.value?t.color:"var(--t3)"}/>
                    <span style={{fontSize:11,fontWeight:600,color:selType===t.value?"var(--t1)":"var(--t3)",textAlign:"center"}}>{t.label}</span>
                    {selType===t.value && <Check size={12} color={t.color}/>}
                  </button>
                ))}
              </div>
            )}

            {/* Step 2 - Condition */}
            {step===2 && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {selType==="price" && <>
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Sembol</label>
                    <input value={sym} onChange={e=>setSym(e.target.value)} className="inp" style={{width:"100%",boxSizing:"border-box",padding:"8px 12px"}} placeholder="BTCUSDT"/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Yon</label>
                    <div style={{display:"flex",gap:6}}>
                      {["above","below"].map(d=>(
                        <button key={d} onClick={()=>setDir(d)} style={{
                          flex:1,padding:"8px",borderRadius:"var(--r-sm)",border:`1px solid ${dir===d?"var(--gold-border)":"var(--b1)"}`,
                          background:dir===d?"var(--gold-dim)":"transparent",
                          color:dir===d?"var(--gold)":"var(--t3)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"
                        }}>{d==="above"?">= (Yukari)":"<= (Asagi)"}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Fiyat Esigi ($)</label>
                    <input value={thresh} onChange={e=>setThresh(e.target.value)} type="number" className="inp" style={{width:"100%",boxSizing:"border-box",padding:"8px 12px"}} placeholder="82000"/>
                  </div>
                </>}
                {selType==="signal" && <>
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Sembol</label>
                    <input value={sym} onChange={e=>setSym(e.target.value)} className="inp" style={{width:"100%",boxSizing:"border-box",padding:"8px 12px"}} placeholder="ETHUSDT"/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Minimum Güven Skoru (%{conf})</label>
                    <input type="range" min="60" max="95" value={conf} onChange={e=>setConf(e.target.value)} style={{width:"100%",accentColor:"var(--purple)"}}/>
                    <div style={{textAlign:"center",fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color:"var(--purple)",marginTop:6}}>%{conf}</div>
                  </div>
                </>}
                {selType==="drawdown" && (
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Maksimum Kayip Esigi (%{ddPct})</label>
                    <input type="range" min="2" max="30" value={ddPct} onChange={e=>setDdPct(e.target.value)} style={{width:"100%",accentColor:"var(--down)"}}/>
                    <div style={{textAlign:"center",fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color:"var(--down)",marginTop:6}}>%{ddPct}</div>
                  </div>
                )}
                {selType==="contrarian" && (
                  <div>
                    <label style={{fontSize:11,color:"var(--t3)",display:"block",marginBottom:5,fontWeight:600}}>Sembol</label>
                    <input value={sym} onChange={e=>setSym(e.target.value)} className="inp" style={{width:"100%",boxSizing:"border-box",padding:"8px 12px"}} placeholder="BTCUSDT"/>
                  </div>
                )}
              </div>
            )}

            <div style={{display:"flex",gap:10,marginTop:22}}>
              {step===2 && <button className="btn-ghost" style={{flex:1,justifyContent:"center"}} onClick={()=>setStep(1)}>Geri</button>}
              <button className="btn-gold" style={{flex:1,justifyContent:"center",display:"flex",alignItems:"center",gap:6}}
                onClick={()=>step===1?setStep(2):submitAlarm()}
                disabled={addMut.isPending}>
                {step===1?"Devam Et":addMut.isPending?"Kaydediliyor...":"Alarm Olustur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
