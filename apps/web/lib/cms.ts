/**
 * CMS Integration Layer - Directus API
 * Falls back to hardcoded defaults when CMS is unavailable
 */

const DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || '';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

interface CmsCache { [key: string]: { data: any; ts: number }; }
const cache: CmsCache = {};
const CACHE_TTL = 5 * 60 * 1000;

async function directusFetch<T>(collection: string, params?: string): Promise<T | null> {
  if (!DIRECTUS_URL) return null;
  const cacheKey = `${collection}:${params || ''}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T;
  try {
    const url = `${DIRECTUS_URL}/items/${collection}${params ? '?' + params : ''}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (DIRECTUS_TOKEN) headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
    const r = await fetch(url, { headers, next: { revalidate: 300 } });
    if (!r.ok) return null;
    const json = await r.json();
    cache[cacheKey] = { data: json.data, ts: Date.now() };
    return json.data as T;
  } catch { return null; }
}

export interface SiteSettings {
  site_name: string; tagline: string; logo_url: string;
  primary_color: string; announcement: string | null; maintenance_mode: boolean;
}
export interface NavigationItem {
  id: string; label: string; href: string; icon: string; order: number; visible: boolean;
}
export interface DashboardText { key: string; value: string; }
export interface Announcement { id: string; title: string; body: string; type: 'info'|'warning'|'success'; active: boolean; }

export async function getSiteSettings(): Promise<SiteSettings> {
  const data = await directusFetch<SiteSettings>('site_settings', 'limit=1');
  return data || DEFAULTS.siteSettings;
}
export async function getNavigation(): Promise<NavigationItem[]> {
  const data = await directusFetch<NavigationItem[]>('navigation_items', 'sort=order&filter[visible][_eq]=true');
  return data || DEFAULTS.navigation;
}
export async function getDashboardTexts(): Promise<Record<string, string>> {
  const data = await directusFetch<DashboardText[]>('dashboard_texts');
  if (!data) return DEFAULTS.dashboardTexts;
  const map: Record<string, string> = {};
  for (const item of data) map[item.key] = item.value;
  return { ...DEFAULTS.dashboardTexts, ...map };
}
export async function getAnnouncements(): Promise<Announcement[]> {
  const data = await directusFetch<Announcement[]>('announcements', 'filter[active][_eq]=true');
  return data || [];
}

const DEFAULTS = {
  siteSettings: {
    site_name: 'AYC Global Market', tagline: 'AI Market Copilot', logo_url: '/logo.svg',
    primary_color: '#D4AF37', announcement: null, maintenance_mode: false,
  } as SiteSettings,
  navigation: [
    { id:'1', label:'Komuta Merkezi', href:'/dashboard', icon:'Activity', order:1, visible:true },
    { id:'2', label:'Piyasalar', href:'/market', icon:'BarChart3', order:2, visible:true },
    { id:'3', label:'Sinyaller', href:'/signals', icon:'Crosshair', order:3, visible:true },
    { id:'4', label:'Portfoy', href:'/portfolio', icon:'Wallet', order:4, visible:true },
    { id:'5', label:'Copilot', href:'/copilot', icon:'Brain', order:5, visible:true },
    { id:'6', label:'Alarmlar', href:'/alarms', icon:'Bell', order:6, visible:true },
    { id:'7', label:'Islemler', href:'/trades', icon:'ArrowUpDown', order:7, visible:true },
  ] as NavigationItem[],
  dashboardTexts: {
    hero_title:'Komuta Merkezi', signal_section:'Aktif Sinyaller',
    movers_title:'En Cok Hareket', alarms_title:'Son Alarmlar',
    kalkan_title:'KALKAN Guard', market_pulse:'Market Nabzi',
    news_crypto:'Kripto', news_global:'Global', news_bist:'Haberler',
    causal_title:'Neden Bu Hareket?',
    demo_banner:'$10.000 Sanal Bakiye - Tamamen Ucretsiz',
  } as Record<string, string>,
};
export { DEFAULTS as CMS_DEFAULTS };