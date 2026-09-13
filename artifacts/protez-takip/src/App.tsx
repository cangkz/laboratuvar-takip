// Gelişmiş Global Fetch Sarmalayıcısı - Otomatik LabID Enjeksiyonu
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  // Eğer istek API'ye yapılıyorsa ve içinde labId yoksa sarmala
  if (url.includes('/api/') && !url.includes('labId=')) {
    try {
      const authRaw = localStorage.getItem('pt_auth');
      if (authRaw) {
        const auth = JSON.parse(authRaw);
        if (auth?.labId) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}labId=${auth.labId}`;
        }
      }
    } catch {}
  }
  return originalFetch(url, init);
};

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import StlPage from '@/pages/stl-page';
import ExternalLabLoginPage from '@/pages/external-lab-login-page';
import ExternalLabPage from '@/pages/external-lab-page';
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, BarChart3, Bell, Building2, CalendarDays,
  Check, ChevronRight, CircleDot, ClipboardList, Clock3, DollarSign, FileBox, FilePlus2, Gauge, HeartPulse,
  LayoutDashboard, LogOut, MapPin, Menu, PackageCheck, Phone, Plus, QrCode, RefreshCw, Search,
  Settings, Stethoscope, Trash2, Truck, UserRound, UsersRound, X, ShieldAlert
} from 'lucide-react';
import {
  getGetClinicQueryKey, getGetDashboardSummaryQueryKey, getGetJobByQrQueryKey, getGetJobQueryKey,
  getHealthCheckQueryKey,
  getListClinicsQueryKey, getListDoctorsQueryKey, getListJobTimelineQueryKey,
  getListJobsQueryKey, useCreateClinic, useCreateJob, useGetClinic, useGetDashboardSummary,
  useGetJob, useGetJobByQr, useHealthCheck, useListClinicJobs, useListClinics, useListDoctors,
  useListJobTimeline, useListJobs, useUpdateJobStatus, setBaseUrl
} from '@workspace/api-client-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import {
  Route,
  Switch,
  Link,
  useParams,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const API_BASE = 'https://laboratuvar-takip.onrender.com';
const API_BASE = 'https://laboratuvar-takip.onrender.com';
setBaseUrl(API_BASE);
const queryClient = new QueryClient();

type IconType = typeof LayoutDashboard;
const statusMeta: Record<string, { label: string; tone: string; icon: IconType }> = {
  waiting_pickup: { label: 'Alım bekliyor', tone: 'blue', icon: Truck },
  picked_up: { label: 'Kuryede', tone: 'slate', icon: Truck },
  received_lab: { label: 'Laboratuvara ulaştı', tone: 'teal', icon: ClipboardList },
  in_production: { label: 'Üretimde', tone: 'amber', icon: Activity },
  quality_check: { label: 'Kalite kontrolde', tone: 'blue', icon: Gauge },
  ready_delivery: { label: 'Teslime hazır', tone: 'green', icon: PackageCheck },
  out_for_delivery: { label: 'Kliniğe teslim ediliyor', tone: 'teal', icon: Truck },
  delivered: { label: 'Teslim edildi', tone: 'green', icon: Check },
};
const toneClass: Record<string, string> = {
  teal: 'bg-[hsl(173_40%_91%)] text-[hsl(173_46%_28%)]',
  amber: 'bg-[hsl(35_80%_91%)] text-[hsl(28_67%_34%)]',
  blue: 'bg-[hsl(205_55%_91%)] text-[hsl(204_53%_32%)]',
  slate: 'bg-[hsl(204_16%_90%)] text-[hsl(204_25%_36%)]',
  green: 'bg-[hsl(146_39%_90%)] text-[hsl(147_45%_29%)]',
};
const stages = ['waiting_pickup', 'picked_up', 'received_lab', 'in_production', 'quality_check', 'ready_delivery', 'out_for_delivery', 'delivered'];
const todayLabel = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' }).format(new Date());
const fmtDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value)) : '—';
const fmtDay = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(value)) : '—';

function getAuth() {
  try {
    const raw = localStorage.getItem('pt_auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(data: any) {
  localStorage.setItem('pt_auth', JSON.stringify(data));
}

function clearAuth() {
  localStorage.removeItem('pt_auth');
}

function Logo() {
  const [labName, setLabName] = useState('protez');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.json())
      .then(d => {
        if (d?.labName) setLabName(d.labName);
        if (d?.logoUrl) setLogoUrl(d.logoUrl);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Link href="/dashboard" className="brand flex items-center gap-3 pl-3 sm:pl-0" data-testid="link-brand">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-xl object-contain bg-white p-1 shadow-sm" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm">
          <HeartPulse size={19} strokeWidth={2.5} />
        </span>
      )}
      <span className="brand-copy min-w-0">
        <span className="block truncate text-[15px] font-extrabold tracking-[-.04em]">
          {labName}<span className="text-[hsl(var(--accent))]">.</span>
        </span>
        <span className="block text-[9px] font-medium uppercase tracking-[.18em] text-[hsl(var(--sidebar-muted))]">iş takip</span>
      </span>
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    if (!auth) {
      setLocation('/');
    } else if (auth.role === 'doctor' && !location.startsWith('/doctor-portal')) {
      setLocation('/doctor-portal');
    }
  }, [auth, location, setLocation]);

  const nav = [
    { href:'/dashboard', label:'Genel görünüm', icon:LayoutDashboard },
    { href:'/jobs', label:'İşler', icon:ClipboardList },
    { href:'/scan', label:'QR okut', icon:QrCode },
    { href:'/clinics', label:'Klinikler', icon:Building2 },
    { href:'/doctors', label:'Doktorlar & Girişler', icon:Stethoscope },
    { href:'/stl', label:'STL Dosyaları', icon:FileBox },
  ];

  return (
    <div className="app-shell min-h-screen relative">
      {mobileMenu && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden" 
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <Logo />
        
        <div className="sidebar-divider my-7 border-t border-white/10 mx-3 sm:mx-4" />
        <nav className="nav flex flex-1 flex-col gap-1 px-3 sm:px-0">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--sidebar-muted))] nav-copy">Operasyon</div>
          {nav.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className={`nav-link ${location === item.href ? 'active' : ''}`} data-testid={`link-nav-${item.label}`}>
              <item.icon className="nav-icon" /><span className="nav-copy">{item.label}</span>
            </Link>
          ))}
          <div className="mt-7 mb-2 text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--sidebar-muted))] nav-copy">Çalışma alanı</div>
          <Link href="/settings" onClick={() => setMobileMenu(false)} className={`nav-link ${location === '/settings' ? 'active' : ''}`} data-testid="link-nav-settings">
            <Settings className="nav-icon"/><span className="nav-copy">Ayarlar</span>
          </Link>
        </nav>
        <div className="sidebar-foot mt-auto border-t border-white/10 pt-4 px-3 sm:px-2">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">LAB</span>
            <span className="sidebar-foot-copy min-w-0">
              <span className="block truncate text-xs font-bold text-white">{auth?.labName || 'Laboratuvar Yöneticisi'}</span>
              <span className="block truncate text-[10px] text-[hsl(var(--sidebar-muted))]">Lab Admin Portalı</span>
            </span>
            <button
              className="btn btn-ghost ml-auto p-1.5 text-[hsl(var(--sidebar-muted))] hover:text-white"
              title="Çıkış Yap"
              onClick={() => { clearAuth(); setLocation('/'); }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="flex h-[68px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.72)] pl-4 pr-0 backdrop-blur-md sm:pl-8 sm:pr-0">
          <button className="btn btn-ghost sm:hidden" onClick={() => setMobileMenu(true)} data-testid="button-open-menu"><Menu size={19}/></button>
          <div className="eyebrow hidden sm:block">Merkez Laboratuvar Paneli</div>
          <div className="relative ml-auto flex items-center gap-2">
            <button className="btn btn-ghost relative p-2" onClick={()=>setNotificationsOpen(v=>!v)} data-testid="button-notifications">
              <Bell size={18}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]"/>
            </button>
            {notificationsOpen && (
              <div className="card absolute right-0 top-11 z-20 w-64 p-4 shadow-xl">
                <div className="text-xs font-extrabold">Bildirimler</div>
                <div className="mt-3 rounded-lg bg-[hsl(var(--muted)/.65)] p-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
                  Şu an okunmamış bildirim yok.
                </div>
              </div>
            )}
            <div className="mx-1 h-5 w-px bg-[hsl(var(--border))]"/>
            <span className="hidden text-[11px] font-bold text-[hsl(var(--muted-foreground))] sm:block">{todayLabel}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function PageTitle({ eyebrow, title, description, actions }: { eyebrow:string; title:string; description?:string; actions?:ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="text-[28px] font-extrabold tracking-[-.055em] text-[hsl(var(--foreground))] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

function StatusBadge({ status, label }: { status?:string; label?:string }) {
  const meta = statusMeta[status || ''] || { label: label || status || 'Bilinmiyor', tone:'slate', icon:CircleDot };
  return <span className={`badge ${toneClass[meta.tone]}`}><span className="status-dot"/>{label || meta.label}</span>;
}

function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div className="card flex min-h-[190px] flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertCircle className="text-[hsl(var(--destructive))]" size={24}/>
      <div>
        <div className="text-sm font-bold">Veri alınamadı</div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Bağlantıyı kontrol edip yeniden deneyin.</p>
      </div>
      {retry && <button className="btn btn-quiet" onClick={retry} data-testid="button-retry"><RefreshCw size={14}/> Tekrar dene</button>}
    </div>
  );
}

function LoadingRows({ count=4 }: { count?:number }) {
  return (
    <div className="space-y-3">
      {Array.from({length:count}).map((_,i)=>(
        <div className="flex items-center gap-3" key={i}>
          <div className="skeleton h-9 w-9 rounded-full"/>
          <div className="flex-1"><div className="skeleton mb-2 h-3 w-2/5"/><div className="skeleton h-2.5 w-3/5"/></div>
          <div className="skeleton h-6 w-20"/>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, text, action }: {title:string;text:string;action?:ReactNode}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">
        <PackageCheck size={20}/>
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[hsl(var(--muted-foreground))]">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LoginPage() {
  const [tab, setTab] = useState<'lab' | 'doctor'>('lab');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleLabLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/lab-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Giriş yapılamadı.');
      }
      setAuth({ role: 'lab', labId: data.lab.id, labName: data.lab.name, token: data.token });
      setLocation('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Geçersiz e-posta veya şifre.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/doctor-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Giriş yapılamadı.');
      }
      setAuth({ role: 'doctor', doctor: data.doctor });
      setLocation('/doctor-portal');
    } catch (err: any) {
      setError(err.message || 'Geçersiz kullanıcı adı veya şifre.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="card w-full max-w-md overflow-hidden border-[hsl(var(--border))] shadow-2xl">
        <div className="flex flex-col items-center bg-[hsl(var(--primary))] p-7 text-center text-[hsl(var(--primary-foreground))]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
            <HeartPulse size={26} strokeWidth={2.5} className="text-[hsl(var(--accent))]" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Dental Protez Laboratuvar Sistemi</h1>
          <p className="mt-1 text-xs text-white/70">Lütfen giriş türünüzü seçerek panele bağlanın</p>
        </div>

        <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.4)]">
          <button
            className={`flex-1 py-3.5 text-xs font-bold transition-all ${tab === 'lab' ? 'border-b-2 border-[hsl(var(--primary))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-xs' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
            onClick={() => { setTab('lab'); setError(''); setEmail(''); setPassword(''); }}
          >
            Laboratuvar Girişi
          </button>
          <button
            className={`flex-1 py-3.5 text-xs font-bold transition-all ${tab === 'doctor' ? 'border-b-2 border-[hsl(var(--primary))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-xs' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
            onClick={() => { setTab('doctor'); setError(''); setEmail(''); setPassword(''); }}
          >
            Klinik / Doktor Girişi
          </button>
        </div>

        <div className="p-6 sm:p-7">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-[hsl(var(--destructive)/.1)] p-3 text-xs font-bold text-[hsl(var(--destructive))]">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {tab === 'lab' ? (
            <form onSubmit={handleLabLogin} className="space-y-4" autoComplete="off">
              <div>
                <label className="label">Laboratuvar E-posta Adresi</label>
                <input
                  type="email"
                  className="input"
                  placeholder="laboratuvar@ornek.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Şifre</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5">
                {loading ? 'Giriş yapılıyor...' : 'Laboratuvar Paneline Gir'} <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleDoctorLogin} className="space-y-4" autoComplete="off">
              <div>
                <label className="label">Doktor Kullanıcı Adı</label>
                <input
                  className="input"
                  placeholder="Kullanıcı adı"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Şifre</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5">
                {loading ? 'Giriş yapılıyor...' : 'Doktor Portalı Girişi'} <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [labName, setLabName] = useState('');
  const [labs, setLabs] = useState<any[]>([]);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    if (adminPass === 'cangkz19.') {
      setIsAdminLoggedIn(true);
      setError('');
      loadLabs();
    } else {
      setError('Geçersiz Super Admin Şifresi.');
    }
  };

  const loadLabs = () => {
    fetch(`${API_BASE}/api/admin/labs`)
      .then(r => r.json())
      .then(d => setLabs(Array.isArray(d) ? d : []))
      .catch(() => setLabs([]));
  };

  const handleCreateLab = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/labs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: labName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Laboratuvar oluşturulamadı.');
      setSuccessMsg(`Başarıyla oluşturuldu: ${labName}`);
      setLabName('');
      setEmail('');
      setPassword('');
      loadLabs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-md">
              <ShieldAlert size={20} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">SaaS Super Admin Paneli</h1>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Yeni laboratuvar müşterileri tanımlayın ve yönetin.</p>
            </div>
          </div>
          <Link href="/" className="btn btn-quiet text-xs">Ana Sayfaya Dön</Link>
        </div>

        {!isAdminLoggedIn ? (
          <div className="card mx-auto max-w-md p-6 shadow-xl">
            <h2 className="text-base font-extrabold mb-4">Yönetici Girişi</h2>
            {error && <div className="mb-4 rounded bg-red-100 p-3 text-xs text-red-600 font-bold">{error}</div>}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="label">Super Admin Şifresi</label>
                <input
                  type="password"
                  className="input mono"
                  placeholder="Yönetici şifresi"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center">Yönetici Paneline Gir</button>
            </form>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <section className="card p-5">
              <h2 className="text-sm font-extrabold mb-4">Yeni Laboratuvar Müşterisi Tanımla</h2>
              {error && <div className="mb-3 rounded bg-red-100 p-2 text-xs text-red-600 font-bold">{error}</div>}
              {successMsg && <div className="mb-3 rounded bg-green-100 p-2 text-xs text-green-700 font-bold">{successMsg}</div>}
              <form onSubmit={handleCreateLab} className="space-y-3">
                <div>
                  <label className="label">Laboratuvar Adı</label>
                  <input className="input" placeholder="Örn: Can Dental Lab" value={labName} onChange={e => setLabName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Laboratuvar E-posta</label>
                  <input type="email" className="input" placeholder="lab@ornek.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Giriş Şifresi</label>
                  <input className="input mono" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary w-full justify-center mt-2"><Plus size={14}/> Laboratuvar Ekle</button>
              </form>
            </section>

            <section className="card p-5">
              <h2 className="text-sm font-extrabold mb-4">Kayıtlı Müşteri Laboratuvarlar</h2>
              {labs.length ? (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {labs.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted)/.5)] p-3 text-xs">
                      <div>
                        <div className="font-extrabold">{l.name}</div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{l.email}</div>
                      </div>
                      <span className="mono text-[10px] bg-white px-2 py-1 rounded border shadow-2xs">ID: #{l.id}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Henüz kayıtlı laboratuvar bulunmuyor.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function DoctorPortal() {
  const auth = getAuth();
  const [location, setLocation] = useLocation();
  const [tab, setTab] = useState<'in_progress' | 'completed' | 'all'>('in_progress');
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const doctor = auth?.doctor;
  const authLabId = auth?.labId;

  useEffect(() => {
    if (!auth || auth.role !== 'doctor') {
      if (location !== '/') setLocation('/');
      return;
    }
    if (doctor?.id) {
      setLoading(true);
      const url = authLabId 
        ? `${API_BASE}/api/doctor/${doctor.id}/jobs?labId=${authLabId}`
        : `${API_BASE}/api/doctor/${doctor.id}/jobs`;
      fetch(url)
        .then(r => r.json())
        .then(d => { setJobs(Array.isArray(d) ? d : []); })
        .catch(() => setJobs([]))
        .finally(() => setLoading(false));
    }
  }, [doctor?.id, authLabId]);

  const viewTimeline = async (job: any) => {
    setSelectedJob(job);
    setTimelineLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${job.id}/timeline`);
      const data = await res.json();
      setTimeline(Array.isArray(data) ? data : []);
    } finally {
      setTimelineLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const isCompleted = job.status === 'delivered';
    if (tab === 'in_progress' && isCompleted) return false;
    if (tab === 'completed' && !isCompleted) return false;

    if (q.trim()) {
      const query = q.toLocaleLowerCase('tr-TR');
      const matchName = job.patientName?.toLocaleLowerCase('tr-TR').includes(query);
      const matchQr = job.qrCode?.toLocaleLowerCase('tr-TR').includes(query);
      const matchJob = job.jobNumber?.toLocaleLowerCase('tr-TR').includes(query);
      const matchRef = job.patientReference?.toLocaleLowerCase('tr-TR').includes(query);
      return matchName || matchQr || matchJob || matchRef;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 sm:px-8 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-xs">
            <Stethoscope size={19} strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-sm font-extrabold text-[hsl(var(--foreground))]">{doctor?.name}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{doctor?.clinicName} · Doktor Portalı</div>
          </div>
        </div>
        <button
          className="btn btn-quiet text-xs"
          onClick={() => { clearAuth(); setLocation('/'); }}
        >
          <LogOut size={14} /> Çıkış Yap
        </button>
      </header>

      <div className="content-wrap mx-auto max-w-5xl py-8">
        <PageTitle
          eyebrow="Klinik Vaka Takip"
          title="Vakalarım"
          description="Laboratuvardaki protez işlerinizi canlı aşamalarıyla takip edin."
        />

        <div className="card mb-5 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={15} />
            <input
              className="input pl-9"
              placeholder="Hasta adı, QR Kod (PTK-...) veya vaka numarası ile arayın..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-[hsl(var(--border))] pb-2">
          <button
            className={`btn px-4 text-xs font-bold ${tab === 'in_progress' ? 'btn-primary' : 'btn-ghost text-[hsl(var(--muted-foreground))]'}`}
            onClick={() => setTab('in_progress')}
          >
            İşlemde Olanlar ({jobs.filter(j => j.status !== 'delivered').length})
          </button>
          <button
            className={`btn px-4 text-xs font-bold ${tab === 'completed' ? 'btn-primary' : 'btn-ghost text-[hsl(var(--muted-foreground))]'}`}
            onClick={() => setTab('completed')}
          >
            Bitmiş Olanlar ({jobs.filter(j => j.status === 'delivered').length})
          </button>
          <button
            className={`btn px-4 text-xs font-bold ${tab === 'all' ? 'btn-primary' : 'btn-ghost text-[hsl(var(--muted-foreground))]'}`}
            onClick={() => setTab('all')}
          >
            Tüm İşlerim ({jobs.length})
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <LoadingRows count={5} />
          ) : filteredJobs.length ? (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => viewTimeline(job)}
                className="card flex cursor-pointer items-center justify-between p-4 transition-all hover:border-[hsl(var(--primary)/.5)] hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
                    <QrCode size={19} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-xs font-bold text-[hsl(var(--primary))]">{job.jobNumber}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="mt-1 text-sm font-extrabold">{job.patientName}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {job.prosthesisType} · Renk: {job.shade || '—'} · Ref: {job.patientReference || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs font-bold text-[hsl(var(--foreground))]">Teslim: {fmtDay(job.dueDate)}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{job.currentStage}</div>
                  </div>
                  <ChevronRight size={17} className="text-[hsl(var(--muted-foreground))]" />
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="Mevcut iş yok" text="Bu sekmede listelenecek herhangi bir vaka kaydı bulunmuyor." />
          )}
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
              <div>
                <div className="eyebrow">{selectedJob.jobNumber}</div>
                <h3 className="text-base font-extrabold">{selectedJob.patientName} - Vaka Yolculuğu</h3>
              </div>
              <button className="btn btn-ghost p-1.5" onClick={() => setSelectedJob(null)}><X size={18} /></button>
            </div>

            <div className="my-5 space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted)/.5)] p-3 text-xs">
                <div><strong>Protez:</strong> {selectedJob.prosthesisType}</div>
                <div><strong>Renk:</strong> {selectedJob.shade || '—'}</div>
                <div><strong>Teslimat:</strong> {fmtDay(selectedJob.dueDate)}</div>
              </div>

              <div className="text-xs font-extrabold text-[hsl(var(--foreground))]">Canlı Aşamalar</div>
              {timelineLoading ? (
                <LoadingRows count={3} />
              ) : timeline.length ? (
                <div className="relative space-y-4 pl-3">
                  {timeline.map((entry, idx) => (
                    <div key={entry.id} className="relative flex gap-3">
                      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${idx === timeline.length - 1 ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>
                        <CircleDot size={12} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{entry.label}</span>
                          <span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{fmtDate(entry.timestamp)}</span>
                        </div>
                        {entry.note && (
                          <div className="mt-1 rounded bg-[hsl(var(--muted)/.6)] p-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                            {entry.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Zaman çizelgesi henüz oluşturulmadı.</div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button className="btn btn-quiet" onClick={() => setSelectedJob(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const auth = getAuth();
  const labId = auth?.labId;
  
  const summary = useGetDashboardSummary(
    { query: { queryKey: [...getGetDashboardSummaryQueryKey(), labId] } }
  );
  
  const data = summary.data;
  const statusCounts = data?.statusCounts || [];
  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle
          eyebrow="Operasyon merkezi / bugün"
          title="Laboratuvar Paneli"
          description="Laboratuvar akışındaki kritik adımlar burada. Önceliklendirin, takipte kalın."
          actions={
            <>
              <Link href="/scan" className="btn btn-quiet" data-testid="link-dashboard-scan"><QrCode size={15}/> QR okut</Link>
              <Link href="/new-job" className="btn btn-primary" data-testid="link-dashboard-new"><Plus size={15}/> Yeni iş</Link>
            </>
          }
        />
        {summary.isError ? (
          <ErrorState retry={() => summary.refetch()}/>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[['activeJobs','Aktif işler',Activity,'teal'],['dueToday','Bugün teslim',Clock3,'amber'],['waitingPickup','Alım bekleyen',Truck,'blue'],['readyForDelivery','Teslime hazır',PackageCheck,'green']].map(([key,label,Icon,tone],i)=>(
                <div className={`card p-4 fade-up stagger-${i+1}`} key={key as string}>
                  <div className="mb-4 flex items-start justify-between">
                    <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{label as string}</span>
                    <span className={`rounded-lg p-2 ${toneClass[tone as string]}`}><Icon size={15}/></span>
                  </div>
                  <div className="text-[28px] font-extrabold tracking-[-.06em]">
                    {summary.isLoading ? <span className="skeleton inline-block h-8 w-12"/> : (data?.[key as keyof typeof data] as number || 0)}
                  </div>
                  <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {key === 'activeJobs' ? 'şu an akışta' : key === 'dueToday' ? 'gün sonuna kadar' : 'aksiyon bekliyor'}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
              <section className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
                  <div>
                    <div className="text-sm font-extrabold">Son işler</div>
                    <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">En son güncellenen vakalar</div>
                  </div>
                  <Link href="/jobs" className="btn btn-ghost px-2 text-[11px]" data-testid="link-dashboard-all-jobs">Tümünü gör <ArrowUpRight size={14}/></Link>
                </div>
                {summary.isLoading ? (
                  <div className="p-5"><LoadingRows/></div>
                ) : data?.recentJobs?.length ? (
                  <div>
                    {data.recentJobs.slice(0,6).map((job)=>(
                      <Link href={`/jobs/${job.id}`} key={job.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5 transition-colors last:border-0 hover:bg-[hsl(var(--muted)/.45)]" data-testid={`link-recent-job-${job.id}`}>
                        <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] sm:flex"><QrCode size={15}/></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="mono text-[11px] font-medium text-[hsl(var(--primary))]">{job.jobNumber}</span>
                            <StatusBadge status={job.status}/>
                          </div>
                          <div className="mt-1 truncate text-[12px] font-bold">{job.patientName} <span className="font-medium text-[hsl(var(--muted-foreground))]">· {job.prosthesisType}</span></div>
                        </div>
                        <div className="hidden text-right sm:block">
                          <div className="text-[11px] font-bold">{job.clinicName}</div>
                          <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Teslim {fmtDay(job.dueDate)}</div>
                        </div>
                        <ChevronRight className="text-[hsl(var(--muted-foreground))]" size={15}/>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Henüz iş yok" text="İlk kliniğinizden gelen vakayı oluşturarak akışı başlatın." action={<Link className="btn btn-primary" href="/new-job" data-testid="link-empty-new-job"><Plus size={14}/> Yeni iş oluştur</Link>}/>
                )}
              </section>
              <section className="card p-5">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Akış dağılımı</div>
                    <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Aktif işlerin mevcut durumu</div>
                  </div>
                  <BarChart3 size={17} className="text-[hsl(var(--muted-foreground))]"/>
                </div>
                {summary.isLoading ? (
                  <LoadingRows count={5}/>
                ) : (
                  <div className="space-y-4">
                    {statusCounts.map(item=>(
                      <div key={item.status}>
                        <div className="mb-1.5 flex justify-between text-[11px]">
                          <span className="font-semibold">{item.label}</span>
                          <span className="mono text-[hsl(var(--muted-foreground))]">{item.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                          <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{width:`${Math.max(7, Math.min(100, (item.count / Math.max(1, data?.activeJobs || 1))*100))}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function Jobs() {
  const auth = getAuth();
  const labId = auth?.labId;

  const [q,setQ] = useState(''); const [status,setStatus] = useState('');
  const jobs = useListJobs(
    { q:q || undefined, status:status || undefined },
    { query:{ queryKey:[...getListJobsQueryKey({ q:q || undefined, status:status || undefined }), labId] }}
  );
  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle eyebrow="Operasyon / iş akışı" title="İşler" description="Tüm laboratuvar vakalarını arayın, filtreleyin ve ilerlemeyi takip edin." actions={<Link href="/new-job" className="btn btn-primary" data-testid="link-jobs-new"><Plus size={15}/> Yeni iş</Link>}/>
        <div className="card mb-4 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={15}/>
              <input className="input pl-9" value={q} onChange={e=>setQ(e.target.value)} placeholder="İş no, hasta veya klinik ara..." data-testid="input-jobs-search"/>
            </div>
            <select className="input sm:w-48" value={status} onChange={e=>setStatus(e.target.value)} data-testid="select-jobs-status">
              <option value="">Tüm durumlar</option>
              {stages.map(s=><option key={s} value={s}>{statusMeta[s]?.label}</option>)}
            </select>
          </div>
        </div>
        <section className="card overflow-hidden">
          {jobs.isError ? (
            <ErrorState retry={()=>jobs.refetch()}/>
          ) : jobs.isLoading ? (
            <div className="p-5"><LoadingRows count={6}/></div>
          ) : jobs.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[hsl(var(--muted)/.55)]">
                  <tr>
                    {['İş / Hasta','Klinik & doktor','Protez','Fiyat','Durum','Teslim tarihi',''].map((h,i)=>(
                      <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]" key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.data.map((job: any)=>(
                    <tr className="group border-t border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--muted)/.35)]" key={job.id}>
                      <td className="px-5 py-4">
                        <Link href={`/jobs/${job.id}`} className="block" data-testid={`link-job-${job.id}`}>
                          <div className="mono text-[11px] font-medium text-[hsl(var(--primary))]">{job.jobNumber}</div>
                          <div className="mt-1 text-[12px] font-extrabold">{job.patientName}</div>
                          <div className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{job.patientReference || 'Hasta referansı yok'}</div>
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[11px] font-bold">{job.clinicName}</div>
                        <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{job.doctorName}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[11px] font-semibold">{job.prosthesisType}</div>
                        <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Renk {job.shade || '—'} · {job.toothCount || 1} Üye</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[11px] font-extrabold text-[hsl(var(--primary))]">{job.totalPrice ? `${job.totalPrice} ₺` : '—'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={job.status}/>
                        <div className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">{job.currentStage}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className={`text-[11px] font-bold ${new Date(job.dueDate) < new Date() ? 'text-[hsl(var(--destructive))]' : ''}`}>{fmtDay(job.dueDate)}</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/jobs/${job.id}`} className="btn btn-ghost p-2 opacity-60 group-hover:opacity-100" data-testid={`link-open-job-${job.id}`}><ArrowUpRight size={15}/></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Eşleşen iş bulunamadı" text="Arama veya filtreleri değiştirerek tekrar deneyin."/>
          )}
        </section>
      </div>
    </Shell>
  );
}

function JobDetail() {
  const auth = getAuth();
  const labId = auth?.labId;

  const params = useParams<{id:string}>(); const id = Number(params.id);
  const job = useGetJob(id, { query:{ enabled:!!id, queryKey:[...getGetJobQueryKey(id), labId] }});
  const timeline = useListJobTimeline(id, { query:{ enabled:!!id, queryKey:getListJobTimelineQueryKey(id) }});
  const update = useUpdateJobStatus();
  const [note,setNote] = useState('');
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [assignedTechs, setAssignedTechs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_BASE}/api/technicians`).then(r=>r.json()).then(d=>setTechnicians(Array.isArray(d)?d:[])).catch(()=>undefined);
  }, []);

  useEffect(() => {
    if (job.data && (job.data as any).assignedTechnicians) {
      try {
        setAssignedTechs(JSON.parse((job.data as any).assignedTechnicians));
      } catch {
        setAssignedTechs({});
      }
    }
  }, [job.data]);

  const saveTechnician = (stage: string, techName: string) => {
    const next = { ...assignedTechs, [stage]: techName };
    setAssignedTechs(next);
    fetch(`${API_BASE}/api/jobs/${id}/technicians`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTechnicians: next }),
    });
  };

  const nextStage = job.data ? stages[Math.min(stages.indexOf(job.data.status)+1, stages.length-1)] : '';
  const advance = () => {
    if (!job.data || !nextStage || nextStage === job.data.status) return;
    update.mutate({id, data:{status:nextStage,note:note || undefined}}, {
      onSuccess:()=>{
        setNote('');
        queryClient.invalidateQueries({queryKey:getGetJobQueryKey(id)});
        queryClient.invalidateQueries({queryKey:getListJobTimelineQueryKey(id)});
        queryClient.invalidateQueries({queryKey:getListJobsQueryKey()});
        queryClient.invalidateQueries({queryKey:getGetDashboardSummaryQueryKey()});
      }
    });
  };

  if (job.isError) return <Shell><div className="content-wrap"><ErrorState retry={()=>job.refetch()}/></div></Shell>;
  if (job.isLoading) return <Shell><div className="content-wrap"><LoadingRows count={7}/></div></Shell>;
  const data = job.data as any; if (!data) return null;

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <div className="mb-6 flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
          <Link href="/jobs" className="hover:text-[hsl(var(--primary))]" data-testid="link-breadcrumb-jobs">İşler</Link>
          <ChevronRight size={13}/>
          <span className="mono text-[hsl(var(--primary))]">{data.jobNumber}</span>
        </div>
        <PageTitle
          eyebrow="İş detayı / vaka kimliği"
          title={data.patientName}
          description={`${data.prosthesisType} · ${data.clinicName}`}
          actions={
            <>
              <Link href="/scan" className="btn btn-quiet" data-testid="link-detail-scan"><QrCode size={15}/> Başka iş tara</Link>
              <button className="btn btn-primary" disabled={!nextStage || nextStage===data.status || update.isPending} data-testid="button-advance-status" onClick={advance}>
                {update.isPending ? 'Güncelleniyor...' : `Sonraki aşama: ${statusMeta[nextStage]?.label || 'Tamamlandı'}`}
                <ArrowRight size={14}/>
              </button>
            </>
          }
        />
        <div className="mb-5 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-5 py-4">
              <div><div className="eyebrow">Kimlik</div><div className="mono mt-1 text-[15px] font-medium text-[hsl(var(--primary))]">{data.jobNumber}</div></div>
              <QrCode className="text-[hsl(var(--primary))]" size={29}/>
            </div>
            <div className="flex justify-center border-b border-[hsl(var(--border))] bg-white p-5">
              <QRCodeSVG value={data.qrCode} size={150} includeMargin bgColor="#ffffff" fgColor="#17353d" aria-label={`QR kod ${data.jobNumber}`} />
            </div>
            <div className="space-y-4 p-5">
              <div><div className="label">Hasta referansı</div><div className="text-sm font-bold">{data.patientReference || 'Belirtilmemiş'}</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="label">Diş Adedi</div><div className="text-sm font-bold">{data.toothCount || 1} Üye</div></div>
                <div><div className="label">Fiyat</div><div className="text-sm font-extrabold text-[hsl(var(--primary))]">{data.totalPrice ? `${data.totalPrice} ₺` : '—'}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="label">Öncelik</div><StatusBadge status={data.priority} label={data.priority === 'urgent' ? 'Acil' : data.priority === 'high' ? 'Yüksek' : 'Normal'}/></div>
                <div><div className="label">Teslim tarihi</div><div className="flex items-center gap-1.5 text-xs font-bold"><CalendarDays size={14} className="text-[hsl(var(--accent))]"/>{fmtDay(data.dueDate)}</div></div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><div className="text-sm font-extrabold">Vaka yolculuğu</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Her adımda sorumluluk görünür.</div></div>
              <StatusBadge status={data.status}/>
            </div>
            <div className="relative ml-2">
              {timeline.isLoading ? (
                <LoadingRows count={4}/>
              ) : timeline.data?.length ? (
                timeline.data.map((entry,i)=>(
                  <div className="relative flex gap-4 pb-6 last:pb-0" key={entry.id}>
                    <div className={`relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${i===timeline.data!.length-1 ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>
                      <CircleDot size={13}/>
                      {i<timeline.data!.length-1 && <span className="absolute left-1/2 top-7 h-6 w-px bg-[hsl(var(--border))]"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-extrabold">{entry.label}</div>
                        <div className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{fmtDate(entry.timestamp)}</div>
                      </div>
                      <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{entry.actor} · {entry.actorRole}</div>
                      {entry.note && <div className="mt-2 rounded-md bg-[hsl(var(--muted)/.62)] p-2 text-[11px] leading-4">{entry.note}</div>}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="Zaman çizgisi boş" text="İlk durum güncellemesi bu alanda görünecek."/>
              )}
            </div>
          </section>
        </div>

        <div className="card mb-5 p-5">
          <div className="mb-3 text-sm font-extrabold">Aşamalardaki Teknisyen Sorumluları</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {['CAD-CAM / Tasarım', 'Porselen / Fırın', 'Cila & Tesviye'].map((stageName) => (
              <div key={stageName} className="rounded-lg bg-[hsl(var(--muted)/.5)] p-3">
                <div className="label">{stageName}</div>
                <select
                  className="input mt-1 text-xs"
                  value={assignedTechs[stageName] || ''}
                  onChange={(e) => saveTechnician(stageName, e.target.value)}
                >
                  <option value="">Teknisyen Seçilmedi</option>
                  {technicians.map(t => <option key={t.id} value={t.name}>{t.name} ({t.department})</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5">
            <div className="mb-5 flex items-center gap-2 text-sm font-extrabold"><Building2 size={16} className="text-[hsl(var(--primary))]"/> Klinik ve doktor</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="label">Klinik</div><div className="text-xs font-bold">{data.clinicName}</div></div>
              <div><div className="label">Doktor</div><div className="text-xs font-bold">{data.doctorName}</div></div>
            </div>
          </section>
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between"><div className="text-sm font-extrabold">Operasyon notu</div><span className="eyebrow">Durum ilerlet</span></div>
            <textarea className="input min-h-[76px] resize-y" value={note} onChange={e=>setNote(e.target.value)} placeholder="Bu adımla ilgili kısa bir not ekleyin..." data-testid="textarea-status-note"/>
            <div className="mt-3 text-[10px] text-[hsl(var(--muted-foreground))]">Son güncelleme: {fmtDate(data.updatedAt)}</div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function NewJob() {
  const auth = getAuth();
  const labId = auth?.labId;

  const clinics = useListClinics({ query: { queryKey: [...getListClinicsQueryKey(), labId] } });
  const doctors = useListDoctors({}, { query: { queryKey: getListDoctorsQueryKey({}) } });
  const create = useCreateJob();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState({
    clinicId: '',
    doctorId: '',
    patientName: '',
    patientReference: '',
    prosthesisType: 'Zirkonyum kron',
    toothCount: '1',
    shade: '',
    priority: 'normal',
    dueDate: '',
    notes: '',
  });

  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!form.clinicId || !form.prosthesisType) {
      setUnitPrice(null);
      return;
    }

    setLoadingPrice(true);
    fetch(`${API_BASE}/api/clinics/${form.clinicId}/prices`)
      .then(r => r.json())
      .then(prices => {
        if (Array.isArray(prices)) {
          const match = prices.find((p: any) => p.procedureType === form.prosthesisType);
          setUnitPrice(match ? Number(match.price) : 0);
        } else {
          setUnitPrice(0);
        }
      })
      .catch(() => setUnitPrice(0))
      .finally(() => setLoadingPrice(false));
  }, [form.clinicId, form.prosthesisType]);

  const calculatedTotalPrice = unitPrice !== null ? unitPrice * Number(form.toothCount || 1) : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.clinicId || !form.doctorId || !form.patientName || !form.dueDate) return;

    create.mutate(
      {
        data: {
          ...form,
          clinicId: Number(form.clinicId),
          doctorId: Number(form.doctorId),
          toothCount: Number(form.toothCount),
          totalPrice: calculatedTotalPrice,
        } as any,
      },
      {
        onSuccess: (job) => {
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setLocation(`/jobs/${job.id}`);
        },
      }
    );
  };

  const clinicDoctors = doctors.data?.filter(d => !form.clinicId || d.clinicId === Number(form.clinicId)) || [];

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle
          eyebrow="Yeni kayıt / klinik vakası"
          title="Yeni iş oluştur"
          description="Vakayı sisteme alın; seçilen kliniğe özel birim fiyat otomatik kilitlenir."
          actions={<Link href="/jobs" className="btn btn-quiet" data-testid="link-new-cancel">Vazgeç</Link>}
        />
        <form className="grid gap-5 lg:grid-cols-[1fr_310px]" onSubmit={submit}>
          <section className="card p-5 sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><FilePlus2 size={17}/></span>
              <div>
                <div className="text-sm font-extrabold">Vaka bilgileri</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Zorunlu alanları eksiksiz doldurun.</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Klinik *</label>
                <select className="input" value={form.clinicId} onChange={e => { set('clinicId', e.target.value); set('doctorId', ''); }} required data-testid="select-new-clinic">
                  <option value="">Klinik seçin</option>
                  {clinics.data?.map(c => <option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Doktor *</label>
                <select className="input" value={form.doctorId} onChange={e => set('doctorId', e.target.value)} required data-testid="select-new-doctor">
                  <option value="">Doktor seçin</option>
                  {clinicDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Hasta adı *</label>
                <input className="input" value={form.patientName} onChange={e => set('patientName', e.target.value)} placeholder="Örn. Merve Aksoy" required data-testid="input-new-patient"/>
              </div>
              <div>
                <label className="label">Hasta referansı</label>
                <input className="input" value={form.patientReference} onChange={e => set('patientReference', e.target.value)} placeholder="Örn. MA-240612" data-testid="input-new-reference"/>
              </div>
              <div>
                <label className="label">Protez türü *</label>
                <select className="input" value={form.prosthesisType} onChange={e => set('prosthesisType', e.target.value)} required data-testid="select-new-prosthesis">
                  <option>Zirkonyum kron</option>
                  <option>E.max veneer</option>
                  <option>Geçici kron</option>
                  <option>İmplant üstü kron</option>
                  <option>Hareketli protez</option>
                </select>
              </div>
              <div>
                <label className="label">Diş / Üye Sayısı</label>
                <input type="number" min="1" max="32" className="input" value={form.toothCount} onChange={e => set('toothCount', e.target.value)} required />
              </div>
              <div>
                <label className="label">Renk</label>
                <input className="input" value={form.shade} onChange={e => set('shade', e.target.value)} placeholder="Örn. A2" data-testid="input-new-shade"/>
              </div>
              <div>
                <label className="label">Öncelik</label>
                <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)} data-testid="select-new-priority">
                  <option value="normal">Normal</option>
                  <option value="high">Yüksek</option>
                  <option value="urgent">Acil</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Teslim tarihi *</label>
                <input className="input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} required data-testid="input-new-due-date"/>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-[hsl(var(--muted)/.5)] p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold">Hesaplanan Vaka Tutarı</div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Kliniğe özel birim fiyat × Üye sayısı üzerinden kilitlenir</div>
              </div>
              <div className="text-lg font-extrabold text-[hsl(var(--primary))]">
                {loadingPrice ? 'Hesaplanıyor...' : `${calculatedTotalPrice.toLocaleString('tr-TR')} ₺`}
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Not</label>
              <textarea className="input min-h-[100px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Laboratuvar ekibinin bilmesi gereken detaylar..." data-testid="textarea-new-notes"/>
            </div>
            <div className="mt-7 flex justify-end">
              <button className="btn btn-primary min-w-36" type="submit" disabled={create.isPending} data-testid="button-submit-new-job">
                {create.isPending ? 'Kaydediliyor...' : 'İşi kaydet'} <ArrowRight size={14}/>
              </button>
            </div>
          </section>
          <aside className="card h-fit bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]">
            <div className="eyebrow text-white/55">Kimlik ve Fiyat</div>
            <QrCode className="my-7" size={52} strokeWidth={1.2}/>
            <h2 className="text-lg font-extrabold tracking-[-.04em]">Otomatik fiyatlandırma.</h2>
            <p className="mt-2 text-xs leading-5 text-white/65">Klinik özel fiyat listesi baz alınarak tutar iş anında sabitlenir, vaka etiketi QR kod ile üretilir.</p>
          </aside>
        </form>
      </div>
    </Shell>
  );
}

function Scan() {
  const auth = getAuth();
  const labId = auth?.labId;

  const [qr,setQr]=useState(''); const [submitted,setSubmitted]=useState(''); const [cameraOpen,setCameraOpen]=useState(false); const scannerRef=useRef<Html5QrcodeScanner | null>(null); const [,setLocation]=useLocation();
  const result=useGetJobByQr(submitted, {query:{enabled:!!submitted,queryKey:[...getGetJobByQrQueryKey(submitted), labId]}});
  const search=(e:FormEvent)=>{e.preventDefault(); if(qr.trim())setSubmitted(qr.trim())};
  useEffect(() => { if(result.data) setLocation(`/jobs/${result.data.id}`); }, [result.data, setLocation]);

  const startCamera = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraOpen(true);
    } catch (err) {
      alert("Kamera izni alınamadı. Lütfen cihaz ayarlarından uygulama izinlerini kontrol edin.");
    }
  };

  useEffect(() => {
    if (!cameraOpen) return;
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 220, height: 220 } }, false);
    scanner.render((decodedText) => { setQr(decodedText); setSubmitted(decodedText); setCameraOpen(false); void scanner.clear(); }, () => undefined);
    scannerRef.current=scanner;
    return () => { if (scannerRef.current) { void scannerRef.current.clear(); scannerRef.current=null; } };
  }, [cameraOpen]);

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle eyebrow="Hızlı erişim / kimlik çözümleme" title="QR okut" description="Kamerayı açın veya etiketteki kodu iş numarasıyla arayın."/>
        <div className="mx-auto max-w-2xl">
          <section className="card overflow-hidden">
            <div className="flex min-h-[235px] flex-col items-center justify-center bg-[hsl(var(--primary))] p-7 text-center text-[hsl(var(--primary-foreground))]">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><QrCode size={48} strokeWidth={1.3}/></div>
              <div className="text-lg font-extrabold tracking-[-.04em]">Vaka kimliğini bulun</div>
              <p className="mt-2 max-w-sm text-xs leading-5 text-white/65">Telefon veya bilgisayar kameranızla etiketi doğrudan okutun.</p>
            </div>
            <div className="border-b border-[hsl(var(--border))] p-5 sm:p-7">
              {cameraOpen ? (
                <div><div id="qr-reader" className="overflow-hidden rounded-lg" /><button className="btn btn-quiet mt-3" type="button" onClick={()=>setCameraOpen(false)} data-testid="button-close-camera">Kamerayı kapat</button></div>
              ) : (
                <button className="btn btn-primary w-full justify-center" type="button" onClick={startCamera} data-testid="button-open-camera"><QrCode size={15}/> Kamerayı aç</button>
              )}
            </div>
            <form className="p-5 sm:p-7" onSubmit={search}>
              <label className="label">QR kod veya iş kimliği</label>
              <div className="flex gap-2">
                <input autoFocus={!cameraOpen} className="input mono" value={qr} onChange={e=>setQr(e.target.value)} placeholder="Örn. PTK-DART1042" data-testid="input-scan-code"/>
                <button className="btn btn-primary px-5" type="submit" disabled={result.isLoading} data-testid="button-scan-search"><Search size={15}/> Bul</button>
              </div>
              {result.isError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-[hsl(var(--destructive)/.08)] p-3 text-xs text-[hsl(var(--destructive))]">
                  <AlertCircle size={15}/><span>Bu kimliğe ait bir iş bulunamadı. Kodu kontrol edip tekrar deneyin.</span>
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Clinics() {
  const auth = getAuth();
  const labId = auth?.labId;

  const [open,setOpen]=useState(false); const [form,setForm]=useState({name:'',code:'',address:'',phone:''});
  const clinics=useListClinics({query:{queryKey:[...getListClinicsQueryKey(), labId]}}); 
  const create=useCreateClinic();
  const submit=(e:FormEvent)=>{
    e.preventDefault();
    if(!form.name||!form.code)return;
    create.mutate({data:form},{
      onSuccess:()=>{
        setOpen(false);
        setForm({name:'',code:'',address:'',phone:''});
        queryClient.invalidateQueries({queryKey:getListClinicsQueryKey()});
      }
    });
  };

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle eyebrow="Ağ / klinik ilişkileri" title="Klinikler" description="Klinik ekipleri, aktif vakalar ve iletişim bilgileri tek yerde." actions={<button className="btn btn-primary" onClick={()=>setOpen(true)} data-testid="button-new-clinic"><Plus size={15}/> Klinik ekle</button>}/>
        {open && (
          <div className="card mb-5 border-[hsl(var(--primary)/.35)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-extrabold">Yeni klinik</div>
              <button className="btn btn-ghost p-1.5" onClick={()=>setOpen(false)} data-testid="button-close-clinic-form"><X size={16}/></button>
            </div>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
              <div><label className="label">Klinik adı *</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required data-testid="input-clinic-name"/></div>
              <div><label className="label">Klinik kodu *</label><input className="input mono" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} required data-testid="input-clinic-code"/></div>
              <div><label className="label">Adres</label><input className="input" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} data-testid="input-clinic-address"/></div>
              <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} data-testid="input-clinic-phone"/></div>
              <div className="flex justify-end sm:col-span-2"><button className="btn btn-primary" type="submit" disabled={create.isPending} data-testid="button-submit-clinic">{create.isPending?'Kaydediliyor...':'Klinik kaydet'}</button></div>
            </form>
          </div>
        )}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinics.isError ? (
            <div className="md:col-span-2 xl:col-span-3"><ErrorState retry={()=>clinics.refetch()}/></div>
          ) : clinics.isLoading ? (
            Array.from({length:6}).map((_,i)=>(
              <div className="card h-[190px] p-5" key={i}>
                <div className="skeleton h-9 w-9 rounded-lg"/>
                <div className="skeleton mt-5 h-4 w-3/4"/>
                <div className="skeleton mt-3 h-3 w-1/2"/>
              </div>
            ))
          ) : clinics.data?.length ? (
            clinics.data.map(clinic=>(
              <Link href={`/clinics/${clinic.id}`} className="card group p-5 transition-transform hover:-translate-y-0.5" key={clinic.id} data-testid={`link-clinic-${clinic.id}`}>
                <div className="flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Building2 size={17}/></span>
                  <span className="mono rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">{clinic.code}</span>
                </div>
                <div className="mt-5 text-sm font-extrabold">{clinic.name}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]"><MapPin size={12}/>{clinic.address||'Adres bilgisi yok'}</div>
                <div className="mt-5 flex items-center gap-5 border-t border-[hsl(var(--border))] pt-4">
                  <div><div className="text-lg font-extrabold">{clinic.activeJobs}</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">aktif iş</div></div>
                  <div><div className="text-lg font-extrabold">{clinic.doctorsCount}</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">doktor</div></div>
                  <ArrowUpRight className="ml-auto text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={16}/>
                </div>
              </Link>
            ))
          ) : (
            <div className="card md:col-span-2 xl:col-span-3"><EmptyState title="Klinik dizini boş" text="İlk klinik kaydınızı oluşturarak ekip ağını kurun." action={<button className="btn btn-primary" onClick={()=>setOpen(true)} data-testid="button-empty-new-clinic"><Plus size={14}/> Klinik ekle</button>}/></div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function ClinicDetail() {
  const auth = getAuth();
  const labId = auth?.labId;

  const id=Number(useParams<{id:string}>().id);
  const clinic=useGetClinic(id, {query:{enabled:!!id,queryKey:[...getGetClinicQueryKey(id), labId]}});
  const jobs = useListClinicJobs(id, { query: { enabled: !!id, queryKey: [...getListClinicsQueryKey(), id, labId] } });

  const [prices, setPrices] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [procType, setProcType] = useState('Zirkonyum kron');
  const [priceVal, setPriceVal] = useState('');

  const loadPrices = () => {
    fetch(`${API_BASE}/api/clinics/${id}/prices`).then(r=>r.json()).then(d=>setPrices(Array.isArray(d)?d:[])).catch(()=>undefined);
    const finUrl = labId ? `${API_BASE}/api/clinics/${id}/finance-summary?labId=${labId}` : `${API_BASE}/api/clinics/${id}/finance-summary`;
    fetch(finUrl).then(r=>r.json()).then(d=>setFinance(d)).catch(()=>undefined);
  };

  useEffect(() => { if (id) loadPrices(); }, [id, labId]);

  const addPrice = (e: FormEvent) => {
    e.preventDefault();
    if (!priceVal) return;
    fetch(`${API_BASE}/api/clinics/${id}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procedureType: procType, price: priceVal }),
    }).then(() => { setPriceVal(''); loadPrices(); });
  };

  const deletePrice = (priceId: number) => {
    fetch(`${API_BASE}/api/clinics/prices/${priceId}`, { method: 'DELETE' }).then(() => loadPrices());
  };

  if(clinic.isError)return <Shell><div className="content-wrap"><ErrorState retry={()=>clinic.refetch()}/></div></Shell>;
  if(clinic.isLoading)return <Shell><div className="content-wrap"><LoadingRows count={6}/></div></Shell>;
  const data=clinic.data; if(!data)return null;

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <div className="mb-6 flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
          <Link href="/clinics" data-testid="link-breadcrumb-clinics">Klinikler</Link>
          <ChevronRight size={13}/>
          <span>{data.code}</span>
        </div>
        <PageTitle eyebrow={`Klinik / ${data.code}`} title={data.name} description={data.address||'Adres bilgisi eklenmemiş.'} actions={<a className="btn btn-quiet" href={data.phone?`tel:${data.phone}`:undefined} aria-disabled={!data.phone} data-testid="link-clinic-contact"><Phone size={14}/> İletişim bilgisi</a>}/>
        
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4"><div className="label">Bu Ayki Ciro</div><div className="text-2xl font-extrabold text-[hsl(var(--primary))]">{finance?.thisMonthTotal || '0.00'} ₺</div></div>
          <div className="card p-4"><div className="label">Toplam Ciro</div><div className="text-2xl font-extrabold">{finance?.overallTotal || '0.00'} ₺</div></div>
          <div className="card p-4"><div className="label">Aktif İşler</div><div className="text-2xl font-extrabold">{data.activeJobs}</div></div>
          <div className="card p-4"><div className="label">Kayıtlı Doktor</div><div className="text-2xl font-extrabold">{data.doctorsCount}</div></div>
        </div>

        <div className="card mb-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold">Kliniğe Özel Birim Fiyatlar</div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Bu klinik için geçerli protez birim fiyatları</div>
            </div>
            <DollarSign size={18} className="text-[hsl(var(--primary))]" />
          </div>

          <form onSubmit={addPrice} className="mb-4 flex flex-wrap gap-2">
            <select className="input flex-1 min-w-48" value={procType} onChange={e=>setProcType(e.target.value)}>
              <option>Zirkonyum kron</option>
              <option>E.max veneer</option>
              <option>Geçici kron</option>
              <option>İmplant üstü kron</option>
              <option>Hareketli protez</option>
            </select>
            <input
              type="number"
              step="0.5"
              placeholder="Fiyat (₺)"
              className="input w-36"
              value={priceVal}
              onChange={e=>setPriceVal(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary"><Plus size={14} /> Fiyat Ata</button>
          </form>

          <div className="grid gap-2 sm:grid-cols-3">
            {prices.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted)/.5)] px-3 py-2 text-xs">
                <div>
                  <span className="font-bold">{p.procedureType}</span>: <span className="text-[hsl(var(--primary))] font-extrabold">{p.price} ₺</span>
                </div>
                <button onClick={() => deletePrice(p.id)} className="text-[hsl(var(--destructive))] hover:opacity-70"><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between"><div className="text-sm font-extrabold">Doktor ekibi</div><UsersRound size={16} className="text-[hsl(var(--primary))]"/></div>
            {data.doctors?.length ? (
              <div className="space-y-1">
                {data.doctors.map(doc=>(
                  <div className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-[hsl(var(--muted)/.5)]" key={doc.id} data-testid={`row-clinic-doctor-${doc.id}`}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><UserRound size={15}/></div>
                    <div className="min-w-0"><div className="text-xs font-bold">{doc.name}</div><div className="mt-0.5 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{doc.specialty||'Uzmanlık belirtilmemiş'}</div></div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Doktor kaydı yok" text="Bu kliniğe henüz doktor eklenmemiş."/>
            )}
          </section>
          <section className="card overflow-hidden">
            <div className="border-b border-[hsl(var(--border))] px-5 py-4">
              <div className="text-sm font-extrabold">Klinik işleri</div>
              <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Bu klinikten gelen son vakalar</div>
            </div>
            {jobs.isLoading ? (
              <div className="p-5"><LoadingRows count={4}/></div>
            ) : jobs.data?.length ? (
              <div>
                {jobs.data.map(job=>(
                  <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5 last:border-0 hover:bg-[hsl(var(--muted)/.4)]" key={job.id} data-testid={`link-clinic-job-${job.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="mono text-[10px] text-[hsl(var(--primary))]">{job.jobNumber}</div>
                      <div className="mt-1 truncate text-xs font-bold">{job.patientName} <span className="font-medium text-[hsl(var(--muted-foreground))]">· {job.prosthesisType}</span></div>
                    </div>
                    <StatusBadge status={job.status}/>
                    <ChevronRight size={14}/>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Bu klinikte iş yok" text="Yeni vakalar geldiğinde burada listelenecek."/>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Doctors() {
  const [clinicId, setClinicId] = useState('');
  const [doctorQ, setDoctorQ] = useState('');
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const auth = getAuth();
  const labId = auth?.labId;

  const clinics = useListClinics({ query: { queryKey: [...getListClinicsQueryKey(), labId] } });
  const doctors = useListDoctors(
    { clinicId: clinicId ? Number(clinicId) : undefined },
    { query: { queryKey: getListDoctorsQueryKey({ clinicId: clinicId ? Number(clinicId) : undefined }) } }
  );

  const [form, setForm] = useState({
    clinicId: '',
    name: '',
    specialty: 'Diş Hekimi',
    email: '',
    username: '',
    password: '123456',
  });

  const visibleDoctors = (doctors.data as any[])?.filter((doc) =>
    `${doc.name} ${doc.specialty} ${doc.username || ''}`
      .toLocaleLowerCase('tr-TR')
      .includes(doctorQ.toLocaleLowerCase('tr-TR'))
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.clinicId || !form.name || !form.username) return;
    await fetch(`${API_BASE}/api/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, clinicId: Number(form.clinicId) }),
    });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: getListDoctorsQueryKey() });
    setForm({ clinicId: '', name: '', specialty: 'Diş Hekimi', email: '', username: '', password: '123456' });
  };

  const copyCredentials = (doc: any) => {
    const text = `Klinik / Doktor Portalı Giriş Bilgileri:\nKullanıcı Adı: ${doc.username || '—'}\nŞifre: ${doc.password || '123456'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle
          eyebrow="Ağ / klinik ekipleri"
          title="Doktorlar & Giriş Bilgileri"
          description="Klinik hekimlerinin panel giriş hesaplarını ve şifrelerini buradan yönetebilirsiniz."
          actions={
            <button className="btn btn-primary" onClick={() => setOpen(true)} data-testid="button-new-doctor">
              <Plus size={15} /> Doktor ekle
            </button>
          }
        />

        <div className="mb-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={15} />
            <input
              className="input pl-9"
              value={doctorQ}
              onChange={(e) => setDoctorQ(e.target.value)}
              placeholder="Doktor adı, uzmanlık veya kullanıcı adı ara..."
            />
          </div>
          <select
            className="input sm:w-56"
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
          >
            <option value="">Tüm klinikler</option>
            {clinics.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {open && (
          <div className="card mb-5 border-[hsl(var(--primary)/.4)] p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold">Yeni Doktor ve Giriş Hesabı Tanımla</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Doktorun portala giriş yapacağı kullanıcı adı ve şifreyi belirleyin.</div>
              </div>
              <button className="btn btn-ghost p-1.5" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
              <div>
                <label className="label">Bağlı Olduğu Klinik *</label>
                <select
                  className="input"
                  value={form.clinicId}
                  onChange={(e) => setForm({ ...form, clinicId: e.target.value })}
                  required
                >
                  <option value="">Klinik seçin</option>
                  {clinics.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Doktor Ad Soyad *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Dr. Ahmet Yılmaz"
                  required
                />
              </div>
              <div>
                <label className="label">Uzmanlık</label>
                <input
                  className="input"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              </div>
              <div>
                <label className="label">E-posta</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="doktor@klinik.com"
                />
              </div>
              <div>
                <label className="label">Giriş Kullanıcı Adı *</label>
                <input
                  className="input mono"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Örn: dr_ahmet"
                  required
                />
              </div>
              <div>
                <label className="label">Giriş Şifresi *</label>
                <input
                  className="input mono"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Vazgeç</button>
                <button className="btn btn-primary" type="submit">Doktor Hesabını Oluştur</button>
              </div>
            </form>
          </div>
        )}

        <section className="card overflow-hidden">
          {doctors.isError ? (
            <ErrorState retry={() => doctors.refetch()} />
          ) : doctors.isLoading ? (
            <div className="p-5"><LoadingRows count={6} /></div>
          ) : visibleDoctors?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-[hsl(var(--muted)/.55)]">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Doktor</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Klinik</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Giriş Kullanıcı Adı</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Giriş Şifresi</th>
                    <th className="px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDoctors.map((doc: any) => (
                    <tr key={doc.id} className="border-t border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--muted)/.35)]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
                            <Stethoscope size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold">{doc.name}</div>
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{doc.specialty || 'Diş Hekimi'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-bold text-[hsl(var(--foreground))]">
                          {clinics.data?.find((c) => c.id === doc.clinicId)?.name || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="mono rounded bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--primary))]">
                          {doc.username || 'dr_' + doc.id}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="mono rounded bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--foreground))]">
                          {doc.password || '123456'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          className="btn btn-quiet py-1 px-2.5 text-[11px]"
                          onClick={() => copyCredentials(doc)}
                          title="Giriş bilgilerini kopyala"
                        >
                          {copiedId === doc.id ? (
                            <span className="flex items-center gap-1 text-[hsl(var(--primary))] font-bold">
                              <Check size={13} /> Kopyalandı
                            </span>
                          ) : (
                            'Bilgileri Kopyala'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Doktor dizini boş"
              text="Henüz kayıtlı doktor veya giriş hesabı bulunamadı."
              action={
                <button className="btn btn-primary" onClick={() => setOpen(true)}>
                  <Plus size={14} /> Doktor ekle
                </button>
              }
            />
          )}
        </section>
      </div>
    </Shell>
  );
}

function SettingsPage() {
  const health=useHealthCheck({query:{queryKey:getHealthCheckQueryKey()}});
  const [labName, setLabName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const [techs, setTechs] = useState<any[]>([]);
  const [newTechName, setNewTechName] = useState('');
  const [newTechDept, setNewTechDept] = useState('Porselen');

  const loadSettingsAndTechs = () => {
    fetch(`${API_BASE}/api/settings`).then(r=>r.json()).then(d=>{ if(d) { setLabName(d.labName || ''); setLogoUrl(d.logoUrl || ''); } });
    fetch(`${API_BASE}/api/technicians`).then(r=>r.json()).then(d=>setTechs(Array.isArray(d)?d:[]));
  };

  useEffect(() => { loadSettingsAndTechs(); }, []);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labName, logoUrl }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addTech = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTechName) return;
    await fetch(`${API_BASE}/api/technicians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTechName, department: newTechDept }),
    });
    setNewTechName('');
    loadSettingsAndTechs();
  };

  const deleteTech = async (techId: number) => {
    await fetch(`${API_BASE}/api/technicians/${techId}`, { method: 'DELETE' });
    loadSettingsAndTechs();
  };

  return (
    <Shell>
      <div className="content-wrap fade-up">
        <PageTitle eyebrow="Çalışma alanı / yapılandırma" title="Laboratuvar Ayarları" description="Laboratuvar marka kimliği ve teknisyen kadrosunu yönetin."/>
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section className="card p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Settings size={18}/></span>
                <div><div className="text-sm font-extrabold">Laboratuvar Kimliği & Logo</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">Tüm panelde görünecek laboratuvar ismi ve logosu.</div></div>
              </div>
              <form onSubmit={saveSettings} className="space-y-4">
                <div><label className="label">Laboratuvar İsmi</label><input className="input" value={labName} onChange={e=>setLabName(e.target.value)} placeholder="Örn: Can Dental Laboratuvarı" required /></div>
                <div><label className="label">Logo Görsel URL'si</label><input className="input" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://ornek.com/logo.png" /></div>
                <div className="flex items-center justify-between pt-2">
                  {saved && <span className="text-xs font-bold text-[hsl(var(--primary))] flex items-center gap-1"><Check size={14}/> Kaydedildi</span>}
                  <button type="submit" className="btn btn-primary ml-auto">Ayarları Güncelle</button>
                </div>
              </form>
            </section>

            <section className="card p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><UsersRound size={18}/></span>
                <div><div className="text-sm font-extrabold">Laboratuvar Teknisyenleri</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">Aşamalara atanacak ekip üyeleri.</div></div>
              </div>
              <form onSubmit={addTech} className="mb-4 flex flex-wrap gap-2">
                <input className="input flex-1 min-w-40" placeholder="Teknisyen Adı (Örn: Can)" value={newTechName} onChange={e=>setNewTechName(e.target.value)} required />
                <select className="input w-44" value={newTechDept} onChange={e=>setNewTechDept(e.target.value)}>
                  <option>Porselen</option>
                  <option>CAD-CAM Tasarım</option>
                  <option>Model & Alçı</option>
                  <option>Cila & Tesviye</option>
                </select>
                <button type="submit" className="btn btn-primary"><Plus size={14}/> Teknisyen Ekle</button>
              </form>
              <div className="grid gap-2 sm:grid-cols-2">
                {techs.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted)/.5)] p-3 text-xs">
                    <div><div className="font-bold">{t.name}</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">{t.department}</div></div>
                    <button onClick={() => deleteTech(t.id)} className="text-[hsl(var(--destructive))] hover:opacity-70"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card h-fit p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-extrabold">Bağlantı durumu</div>
              <span className={`badge ${health.isError?'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]':'bg-[hsl(146_39%_90%)] text-[hsl(147_45%_29%)]'}`}>
                <span className="status-dot"/>{health.isLoading?'Kontrol ediliyor':health.isError?'Çevrimdışı':'API aktif'}
              </span>
            </div>
            <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4">
              <HeartPulse size= {18} className="text-[hsl(var(--primary))]"/>
              <div>
                <div className="text-xs font-bold">Postgres & API Servisi</div>
                <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{health.data?.status||'Aktif ve çalışıyor'}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/doctor-portal" component={DoctorPortal} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:id" component={JobDetail} />
      <Route path="/new-job" component={NewJob} />
      <Route path="/scan" component={Scan} />
      <Route path="/clinics" component={Clinics} />
      <Route path="/clinics/:id" component={ClinicDetail} />
      <Route path="/doctors" component={Doctors} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/stl" component={StlPage} />
      <Route path="/external-lab-login" component={ExternalLabLoginPage} />
      <Route path="/external-lab" component={ExternalLabPage} />
      <Route component={NotFound} />
    </Switch>
  </RoutedErrorBoundary>
);
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
