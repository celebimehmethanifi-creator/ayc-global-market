/**
 * CMS Integration Layer - WordPress REST API (Headless)
 * WordPress: http://aycmarket.com/wp-json/wp/v2/
 * Falls back to hardcoded defaults when CMS is unavailable
 *
 * WordPress'te icerikleri duzenlemek icin:
 * - http://aycmarket.com/wp-admin adresine gir
 * - Sayfalar bolumunden site ayarlarini duzenle
 * - Yazilar bolumunden duyurulari yonet
 */

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'http://aycmarket.com';
const WP_API = `${WP_URL}/wp-json/wp/v2`;

interface CmsCache { [key: string]: { data: any; ts: number }; }
const cache: CmsCache = {};
const CACHE_TTL = 3 * 60 * 1000;

async function wpFetch<T>(endpoint: string, fallback: T): Promise<T> {
  if (!WP_URL) return fallback;
  const cacheKey = endpoint;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T;
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${WP_API}/${endpoint}`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 180 },
    });
    if (!r.ok) return fallback;
    const data = await r.json();
    cache[cacheKey] = { data, ts: Date.now() };
    return data as T;
  } catch { return fallback; }
}

export interface SiteSettings {
  site_name: string; tagline: string; logo_url: string;
  primary_color: string; announcement: string | null; maintenance_mode: boolean;
}
export interface NavigationItem {
  id: string; label: string; href: string; icon: string; order: number; visible: boolean;
}
export interface DashboardText { key: string; value: string; }
export interface Announcement {
  id: string; title: string; body: string; type: 'info'|'warning'|'success'; active: boolean;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const pages = await wpFetch<any[]>('pages?slug=site-ayarlari&_fields=content', []);
    if (pages.length > 0 && pages[0].content?.rendered) {
      const text = pages[0].content.rendered.replace(/<[^>]*>/g, '').trim();
      const parsed = JSON.parse(text);
      return { ...DEFAULTS.siteSettings, ...parsed };
    }
  } catch { /* fallback */ }
  return DEFAULTS.siteSettings;
}

export async function getNavigation(): Promise<NavigationItem[]> {
  try {
    const pages = await wpFetch<any[]>('pages?slug=navigasyon&_fields=content', []);
    if (pages.length > 0 && pages[0].content?.rendered) {
      const text = pages[0].content.rendered.replace(/<[^>]*>/g, '').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* fallback */ }
  return DEFAULTS.navigation;
}

export async function getDashboardTexts(): Promise<Record<string, string>> {
  try {
    const pages = await wpFetch<any[]>('pages?slug=dashboard-metinleri&_fields=content', []);
    if (pages.length > 0 && pages[0].content?.rendered) {
      const text = pages[0].content.rendered.replace(/<[^>]*>/g, '').trim();
      const parsed = JSON.parse(text);
      return { ...DEFAULTS.dashboardTexts, ...parsed };
    }
  } catch { /* fallback */ }
  return DEFAULTS.dashboardTexts;
}

export async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const posts = await wpFetch<any[]>(
      'posts?per_page=5&_fields=id,title,content,status&orderby=date&order=desc',
      []
    );
    if (posts.length > 0) {
      return posts.map((p: any) => ({
        id: String(p.id),
        title: p.title?.rendered || '',
        body: p.content?.rendered?.replace(/<[^>]*>/g, '').trim() || '',
        type: 'info' as const,
        active: p.status === 'publish',
      }));
    }
  } catch { /* fallback */ }
  return [];
}

export async function getCustomContent(key: string): Promise<string | null> {
  try {
    const pages = await wpFetch<any[]>(`pages?slug=${key}&_fields=content`, []);
    if (pages.length > 0 && pages[0].content?.rendered) {
      return pages[0].content.rendered;
    }
  } catch { /* fallback */ }
  return null;
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
    { id:'4', label:'Portföy', href:'/portfolio', icon:'Wallet', order:4, visible:true },
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
