import { useState, useCallback, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import { Link } from 'wouter';
import '../resident.css';
import { type Lang, type Theme, type Translations, loadLang, saveLang, loadTheme, saveTheme, t, formatDate, formatDateTime, formatTime, timeAgo, parkingLabel, parkingShort } from '../i18n';
import { residentApi, setAuthToken, getAuthToken, clearAuth } from '../lib/residentApi';

const STAGES = ['Idea', 'Ogrody', 'Alfa', 'Omega', 'Leo', 'Venus', 'Orion', 'Aurora'] as const;
type Stage = typeof STAGES[number];
type ParkingType = 'naziemne' | 'podziemne';
type AppScreen = 'home' | 'board' | 'add' | 'notifications' | 'profile' | 'settings' | 'messages' | 'chat' | 'regulations' | 'archive';
type BoardTab = 'sharing' | 'seeking';
type StageFilter = Stage | 'all';

interface HomeWidget { id: string; label: string; enabled: boolean; }

interface ResidentUser {
  id: string; firstName: string; lastName: string; city: string;
  street: string; building: string; apartment: string;
  spaceCode: string; parkingType: ParkingType; stage: Stage;
  plateNumber?: string;
  role: 'resident' | 'admin';
}

function getInitials(u: ResidentUser) { return (u.firstName[0] + u.lastName[0]).toUpperCase(); }
function fullName(u: ResidentUser) { return `${u.firstName} ${u.lastName}`; }

const STORAGE_KEY = 'ideapark_resident_user';

function loadUser(): ResidentUser | null { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function saveUser(u: ResidentUser) { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); }
function clearUser() { localStorage.removeItem(STORAGE_KEY); }

const DEMO_SMS_CODE = '123456';

function anonName(userId: string, currentUserId: string, realName: string, _T: { anonymousResident: string }): string {
  if (userId === currentUserId) return realName;
  const parts = realName.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
  return parts[0] || realName;
}

function anonAvatar(_userId: string, _currentUserId: string, realAvatar: string): string {
  return realAvatar;
}

const SESSION_TIMEOUT = 30 * 60 * 1000;
const SESSION_TS_KEY = 'ideapark_session_ts';
function touchSession() { localStorage.setItem(SESSION_TS_KEY, Date.now().toString()); }
function isSessionValid(): boolean {
  const ts = localStorage.getItem(SESSION_TS_KEY);
  if (!ts) return false;
  return (Date.now() - parseInt(ts, 10)) < SESSION_TIMEOUT;
}

interface ChatMessage { id: string; fromUserId: string; text: string; createdAt: string; }
interface ChatThread { id: string; spaceCode: string; userA: string; userB: string; messages: ChatMessage[]; relatedReservationId: string; userAName?: string; userBName?: string; }

interface Proposal { id: string; fromUserId: string; fromUserName: string; fromAvatar: string; spaceCode: string; parkingType: ParkingType; stage: Stage; note: string; createdAt: string; }
interface SharingEntry { id: string; userId: string; residentName: string; ownerName: string; avatar: string; stage: Stage; spaceCode: string; parkingType: ParkingType; dateFrom: string; dateTo: string; from: string; to: string; note: string; postedAt: string; status: 'available' | 'pending' | 'confirmed' | 'completed'; requestedByUserId?: string | null; requestedBy?: { userId: string; userName: string; avatar: string } | null; ownerPlate?: string; borrowerPlate?: string; vacatedAt?: string; }
interface SeekingEntry { id: string; userId: string; residentName: string; avatar: string; stage: Stage; from: string; to: string; note: string; postedAt: string; status: 'open' | 'has_proposal' | 'matched'; proposals: Proposal[]; matchedSpaceCode?: string; matchedOwner?: string; matchedParkingType?: ParkingType; }
interface NotificationItem { id: string; type: string; title: string; body: string; spaceCode?: string; createdAt: string; read: boolean; relatedId?: string; }

function daysBetween(from: string, to: string) { return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

const I18nCtx = createContext<{ lang: Lang; T: Translations }>({ lang: 'pl', T: t('pl') });

export function ResidentBoard() {
  const [currentUser, setCurrentUser] = useState<ResidentUser | null>(() => {
    const u = loadUser();
    const token = getAuthToken();
    if (u && token && isSessionValid()) return u;
    clearUser(); clearAuth();
    return null;
  });
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [lang, setLangState] = useState<Lang>(loadLang);
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState(false);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearUser(); clearAuth(); setCurrentUser(null); setSessionExpiredMsg(true);
    };
    window.addEventListener('ideapark:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('ideapark:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (!isSessionValid()) { clearUser(); clearAuth(); setCurrentUser(null); setSessionExpiredMsg(true); }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const setLang = (l: Lang) => { saveLang(l); setLangState(l); };
  const setTheme = (th: Theme) => { saveTheme(th); setThemeState(th); };

  const handleLogin = (u: ResidentUser, token: string) => { setAuthToken(token); saveUser(u); touchSession(); setCurrentUser(u); setSessionExpiredMsg(false); };

  const T_val = useMemo(() => t(lang), [lang]);
  const ctx = useMemo(() => ({ lang, T: T_val }), [lang, T_val]);

  if (!currentUser) {
    return <I18nCtx.Provider value={ctx}><AuthFlow authScreen={authScreen} setAuthScreen={setAuthScreen} onLogin={handleLogin} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} sessionExpired={sessionExpiredMsg} /></I18nCtx.Provider>;
  }
  return <I18nCtx.Provider value={ctx}><MainApp user={currentUser} onLogout={() => { clearUser(); clearAuth(); localStorage.removeItem(SESSION_TS_KEY); setCurrentUser(null); }} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} /></I18nCtx.Provider>;
}

function AuthFlow({ authScreen, setAuthScreen, onLogin, lang, setLang, theme, setTheme, sessionExpired }: {
  authScreen: 'login' | 'register'; setAuthScreen: (s: 'login' | 'register') => void;
  onLogin: (u: ResidentUser, token: string) => void; lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void; sessionExpired?: boolean;
}) {
  const { T } = useContext(I18nCtx);
  const [loginFirst, setLoginFirst] = useState('');
  const [loginLast, setLoginLast] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [regFirst, setRegFirst] = useState('');
  const [regLast, setRegLast] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCity, setRegCity] = useState('Radom');
  const [regStreet, setRegStreet] = useState('ul. Listopadowa');
  const [regBuilding, setRegBuilding] = useState('4');
  const [regApartment, setRegApartment] = useState('');
  const [regSpace, setRegSpace] = useState('');
  const [regParkingType, setRegParkingType] = useState<ParkingType>('podziemne');
  const [regStage, setRegStage] = useState<Stage>('Orion');
  const [regPlate, setRegPlate] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSmsCode, setRegSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [regError, setRegError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [demoUsers, setDemoUsers] = useState<ResidentUser[]>([]);
  useEffect(() => { residentApi.getDemoUsers().then(setDemoUsers).catch(() => {}); }, []);

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await residentApi.login(loginFirst.trim(), loginLast.trim(), loginPassword);
      onLogin(result.user, result.token);
    } catch { setLoginError(T.loginError); }
    finally { setLoginLoading(false); }
  };

  const handleDemoLogin = async (u: ResidentUser) => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await residentApi.login(u.firstName, u.lastName, 'IdeaPark2026!');
      onLogin(result.user, result.token);
    } catch { setLoginError(T.loginError); }
    finally { setLoginLoading(false); }
  };

  const handleRegister = async () => {
    setRegError('');
    if (!regFirst.trim() || !regLast.trim()) { setRegError(T.regErrorName); return; }
    if (!regPassword || regPassword.length < 8) { setRegError(T.passwordTooShort || 'Hasło musi mieć min. 8 znaków'); return; }
    if (!regCity.trim() || !regStreet.trim() || !regBuilding.trim() || !regApartment.trim()) { setRegError(T.regErrorAddress); return; }
    if (!regSpace.trim()) { setRegError(T.regErrorSpace); return; }
    if (!phoneVerified) { setRegError(T.phoneRequired); return; }
    try {
      const result = await residentApi.register({ firstName: regFirst.trim(), lastName: regLast.trim(), password: regPassword, city: regCity.trim(), street: regStreet.trim(), building: regBuilding.trim(), apartment: regApartment.trim(), spaceCode: regSpace.trim().toUpperCase(), parkingType: regParkingType, stage: regStage, phone: regPhone.trim(), plateNumber: regPlate.trim() || undefined });
      onLogin(result.user, result.token);
    } catch (e: any) { setRegError(e.message || T.regErrorExists); }
  };

  return (
    <div className="app-wrap">
      <div className="auth-container">
        <div className="auth-top-bar">
          <div className="auth-lang-switch">
            <button className={`lang-btn ${lang === 'pl' ? 'lang-active' : ''}`} onClick={() => setLang('pl')}>PL</button>
            <button className={`lang-btn ${lang === 'en' ? 'lang-active' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>
          <div className="auth-theme-switch">
            <button className={`theme-btn ${theme === 'light' ? 'theme-active' : ''}`} onClick={() => setTheme('light')} title={T.themeLight}>☀️</button>
            <button className={`theme-btn ${theme === 'beige' ? 'theme-active' : ''}`} onClick={() => setTheme('beige')} title={T.themeBeige}>🏖️</button>
            <button className={`theme-btn ${theme === 'dark' ? 'theme-active' : ''}`} onClick={() => setTheme('dark')} title={T.themeDark}>🌙</button>
          </div>
        </div>

        <div className="auth-logo">
          <div className="auth-logo-icon">P</div>
          <div className="auth-logo-name">IdeaPark</div>
          <div className="auth-logo-sub">{T.residenceName} · {T.residenceCity}</div>
        </div>

        {sessionExpired && <div className="auth-error auth-session-expired">⏱️ {T.sessionExpired}</div>}

        <div className="auth-tabs">
          <button className={`auth-tab ${authScreen === 'login' ? 'auth-tab-active' : ''}`} onClick={() => setAuthScreen('login')}>{T.login}</button>
          <button className={`auth-tab ${authScreen === 'register' ? 'auth-tab-active' : ''}`} onClick={() => setAuthScreen('register')}>{T.register}</button>
        </div>

        {authScreen === 'login' && (
          <div className="auth-form">
            <div className="auth-form-title">{T.loginTitle}</div>
            <div className="auth-form-sub">{T.loginSub}</div>
            <label className="field-label">{T.firstName}</label>
            <input className="field-input" placeholder="Jan" value={loginFirst} onChange={e => setLoginFirst(e.target.value)} />
            <label className="field-label">{T.lastName}</label>
            <input className="field-input" placeholder="Nowak" value={loginLast} onChange={e => setLoginLast(e.target.value)} />
            <label className="field-label">🔒 {T.password || 'Hasło'}</label>
            <input className="field-input" type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && loginFirst.trim() && loginLast.trim() && loginPassword) handleLogin(); }} />
            {loginError && <div className="auth-error">{loginError}</div>}
            <button className="btn-primary btn-full auth-submit" onClick={handleLogin} disabled={!loginFirst.trim() || !loginLast.trim() || !loginPassword || loginLoading}>{loginLoading ? '⏳' : T.loginBtn}</button>
            <div className="auth-hint">
              <div className="auth-hint-title">{T.demoAccounts}</div>
              <div className="auth-hint-small" style={{marginBottom:'6px',opacity:.7}}>{T.demoPassword || 'Hasło demo: IdeaPark2026!'}</div>
              <div className="auth-hint-list">
                {demoUsers.slice(0, 4).map(u => (
                  <button key={u.id} className="auth-demo-btn" onClick={() => handleDemoLogin(u)} disabled={loginLoading}>
                    {u.firstName} {u.lastName} <span className="auth-demo-info">· {T.stage} {u.stage} · {u.spaceCode} · {parkingShort(u.parkingType, lang)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {authScreen === 'register' && (
          <div className="auth-form">
            <div className="auth-form-title">{T.registerTitle}</div>
            <div className="auth-form-sub">{T.registerSub}</div>
            <div className="auth-section-label">{T.personalData}</div>
            <div className="auth-row">
              <div className="auth-field-half"><label className="field-label">{T.firstName}</label><input className="field-input" placeholder="Jan" value={regFirst} onChange={e => setRegFirst(e.target.value)} /></div>
              <div className="auth-field-half"><label className="field-label">{T.lastName}</label><input className="field-input" placeholder="Nowak" value={regLast} onChange={e => setRegLast(e.target.value)} /></div>
            </div>
            <label className="field-label">🔒 {T.password || 'Hasło'} ({T.minChars || 'min. 8 znaków'})</label>
            <input className="field-input" type="password" placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            <div className="auth-section-label">{T.address}</div>
            <label className="field-label">{T.city}</label>
            <input className="field-input" placeholder="Radom" value={regCity} onChange={e => setRegCity(e.target.value)} />
            <div className="auth-row">
              <div className="auth-field-half"><label className="field-label">{T.street}</label><input className="field-input" placeholder="ul. Listopadowa" value={regStreet} onChange={e => setRegStreet(e.target.value)} /></div>
              <div className="auth-field-half"><label className="field-label">{T.buildingNo}</label><input className="field-input" placeholder="4" value={regBuilding} onChange={e => setRegBuilding(e.target.value)} /></div>
            </div>
            <label className="field-label">{T.apartmentNo}</label>
            <input className="field-input" placeholder="12A" value={regApartment} onChange={e => setRegApartment(e.target.value)} />
            <div className="auth-section-label">{T.parkingSpot}</div>
            <label className="field-label">{T.spaceNumber}</label>
            <input className="field-input" placeholder="P1-014" value={regSpace} onChange={e => setRegSpace(e.target.value)} />
            <label className="field-label">{T.plateNumber}</label>
            <input className="field-input" placeholder="WRA 12345" value={regPlate} onChange={e => setRegPlate(e.target.value.toUpperCase())} />
            <label className="field-label">{T.parkingType}</label>
            <div className="auth-toggle-row">
              <button className={`auth-toggle ${regParkingType === 'podziemne' ? 'auth-toggle-active' : ''}`} onClick={() => setRegParkingType('podziemne')}>{T.undergroundIcon}</button>
              <button className={`auth-toggle ${regParkingType === 'naziemne' ? 'auth-toggle-active' : ''}`} onClick={() => setRegParkingType('naziemne')}>{T.surfaceIcon}</button>
            </div>
            <label className="field-label">{T.stage}</label>
            <div className="auth-stage-grid">
              {STAGES.map(s => (
                <button key={s} className={`auth-toggle ${regStage === s ? 'auth-toggle-active' : ''}`} onClick={() => setRegStage(s)}>{s}</button>
              ))}
            </div>
            <div className="auth-section-label">📱 {T.phoneNumber}</div>
            <div style={{display:'flex',gap:'8px'}}>
              <input className="field-input" style={{flex:1}} placeholder={T.phonePlaceholder} value={regPhone} onChange={e => setRegPhone(e.target.value)} disabled={phoneVerified} />
              {!smsSent && !phoneVerified && <button className="btn-primary" style={{whiteSpace:'nowrap',fontSize:'13px',padding:'10px 14px'}} onClick={() => { if (!regPhone.trim()) { setRegError(T.phoneRequired); return; } setSmsSent(true); setRegError(''); }}>{T.sendSmsCode}</button>}
            </div>
            {smsSent && !phoneVerified && (
              <div style={{marginTop:'8px'}}>
                <div className="auth-hint-small">✉️ {T.smsSent} {regPhone}</div>
                <div style={{display:'flex',gap:'8px',marginTop:'6px'}}>
                  <input className="field-input" style={{flex:1,fontFamily:'monospace',letterSpacing:'3px',textAlign:'center'}} maxLength={6} placeholder={T.smsCodePlaceholder} value={regSmsCode} onChange={e => setRegSmsCode(e.target.value.replace(/\D/g,''))} />
                  <button className="btn-primary" style={{whiteSpace:'nowrap',fontSize:'13px',padding:'10px 14px'}} onClick={() => { if (regSmsCode === DEMO_SMS_CODE) { setPhoneVerified(true); setRegError(''); } else { setRegError(T.smsCodeError); } }}>{T.verifySmsCode}</button>
                </div>
                <div className="auth-hint-small" style={{marginTop:'4px',opacity:.7}}>{T.smsCodeDemo}</div>
              </div>
            )}
            {phoneVerified && <div style={{marginTop:'6px',color:'var(--green)',fontWeight:600,fontSize:'13px'}}>✅ {T.phoneVerified}</div>}
            {regError && <div className="auth-error">{regError}</div>}
            <p className="reg-terms-note">{T.regAcceptTerms}</p>
            <button className="btn-primary btn-full auth-submit" onClick={handleRegister}>{T.registerBtn}</button>
          </div>
        )}
      </div>
    </div>
  );
}


function MainApp({ user, onLogout, lang, setLang, theme, setTheme }: {
  user: ResidentUser; onLogout: () => void;
  lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void;
}) {
  const { T } = useContext(I18nCtx);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [boardTab, setBoardTab] = useState<BoardTab>('sharing');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');

  const [sharing, setSharing] = useState<SharingEntry[]>([]);
  const [seeking, setSeeking] = useState<SeekingEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [rawSh, rawSk] = await Promise.all([residentApi.getSharing(), residentApi.getSeeking()]);
      setSharing(rawSh.map((s: any) => ({
        ...s,
        from: s.dateFrom || s.from,
        to: s.dateTo || s.to,
        residentName: s.ownerName || s.residentName || '',
        avatar: s.avatar || '',
        note: s.note || '',
        ownerPlate: s.ownerPlate || '',
        borrowerPlate: s.borrowerPlate || '',
        vacatedAt: s.vacatedAt || null,
        requestedBy: s.requestedByUserId ? { userId: s.requestedByUserId, userName: '', avatar: '' } : null,
      })));
      setSeeking(rawSk.map((s: any) => ({
        ...s,
        from: s.dateFrom || s.from,
        to: s.dateTo || s.to,
        residentName: s.seekerName || s.residentName || '',
        avatar: s.avatar || '',
        note: s.note || '',
        matchedOwner: s.matchedOwnerId || s.matchedOwner || '',
        proposals: (s.proposals || []).map((p: any) => ({ ...p, fromAvatar: p.fromAvatar || '', note: p.note || '' })),
      })));
    } catch (e) { console.error('Failed to load data', e); }
  }, []);

  useEffect(() => { refreshData().finally(() => setDataLoading(false)); }, [refreshData]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const refreshNotifications = useCallback(async () => {
    try { const n = await residentApi.getNotifications(); setNotifications(n); } catch {}
  }, [user.id]);
  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  const [toast, setToast] = useState<string | null>(null);
  const [addType, setAddType] = useState<'share' | 'seek'>('share');
  const [addFrom, setAddFrom] = useState(todayStr());
  const [addTo, setAddTo] = useState('');
  const [addTimeFrom, setAddTimeFrom] = useState('08:00');
  const [addTimeTo, setAddTimeTo] = useState('18:00');
  const [proposalModal, setProposalModal] = useState<string | null>(null);
  const [confirmationView, setConfirmationView] = useState<{ spaceCode: string; parkingType: ParkingType; from: string; to: string; owner: string; stage: Stage; type: 'reserved' | 'matched' } | null>(null);

  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [lastArchived, setLastArchived] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ParkingType>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [archiveData, setArchiveData] = useState<{ sharing: any[]; seeking: any[] }>({ sharing: [], seeking: [] });
  const [archiveTab, setArchiveTab] = useState<'sharing' | 'seeking'>('sharing');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const loadArchive = useCallback(async () => {
    setArchiveLoading(true);
    try { const data = await residentApi.getArchive(); setArchiveData(data); } catch {}
    setArchiveLoading(false);
  }, []);

  const WIDGETS_KEY = 'ideapark_home_widgets';
  const defaultWidgets: HomeWidget[] = [
    { id: 'spaceCard', label: T.showSpaceCard, enabled: true },
    { id: 'reservation', label: T.showReservation, enabled: true },
    { id: 'myAds', label: T.showMyAds, enabled: true },
    { id: 'quickActions', label: T.showQuickActions, enabled: true },
    { id: 'recent', label: T.showRecent, enabled: true },
  ];
  const [homeWidgets, setHomeWidgets] = useState<HomeWidget[]>(() => {
    try { const s = localStorage.getItem(WIDGETS_KEY); return s ? JSON.parse(s) : defaultWidgets; } catch { return defaultWidgets; }
  });
  const [showCustomize, setShowCustomize] = useState(false);
  const isWidgetOn = (id: string) => homeWidgets.find(w => w.id === id)?.enabled ?? true;
  const toggleWidget = (id: string) => {
    setHomeWidgets(prev => { const n = prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w); localStorage.setItem(WIDGETS_KEY, JSON.stringify(n)); return n; });
  };

  const archiveItem = useCallback((id: string) => {
    setArchivedIds(prev => new Set(prev).add(id));
    setLastArchived(id);
    setTimeout(() => setLastArchived(prev => prev === id ? null : prev), 5000);
  }, []);
  const undoArchive = useCallback(() => {
    if (!lastArchived) return;
    setArchivedIds(prev => { const n = new Set(prev); n.delete(lastArchived); return n; });
    setLastArchived(null);
  }, [lastArchived]);

  const CU = user;
  const avatar = getInitials(CU);
  const name = fullName(CU);

  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');

  const refreshChats = useCallback(async () => {
    try { const c = await residentApi.getChats(); setChats(c); } catch {}
  }, [user.id]);
  useEffect(() => { refreshChats(); }, [refreshChats]);

  useEffect(() => { touchSession(); }, [screen]);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); }, []);

  const handleReportVehicle = useCallback(async (sharingId: string) => {
    if (!confirm(T.reportVehicleConfirm)) return;
    try { await residentApi.reportVehicle(sharingId); showToast(T.reportVehicleSent); } catch (e: any) { showToast(e.message || 'Error'); }
  }, [T, showToast]);
  const addNotif = useCallback(async (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
    try {
      await residentApi.addNotification({ type: n.type, title: n.title, body: n.body, spaceCode: n.spaceCode, relatedId: n.relatedId });
      refreshNotifications();
    } catch {}
  }, [user.id, refreshNotifications]);

  const [vacateModal, setVacateModal] = useState<{ sharingId: string; spaceCode: string; endTime: string; role: 'borrower' | 'owner'; borrowerPlate?: string } | null>(null);
  const alertSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkAlerts = () => {
      const now = Date.now();
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const confirmedSharing = sharing.filter(s => s.status === 'confirmed' && !s.vacatedAt);

      for (const entry of confirmedSharing) {
        const endTime = new Date(entry.to).getTime();
        const timeLeft = endTime - now;
        const isBorrower = entry.requestedByUserId === CU.id;
        const isOwner = entry.userId === CU.id;

        if (!isBorrower && !isOwner) continue;

        const alertKey2h = `2h_${entry.id}`;
        const alertKeyExpired = `expired_${entry.id}`;

        if (timeLeft > 0 && timeLeft <= TWO_HOURS && !alertSentRef.current.has(alertKey2h)) {
          alertSentRef.current.add(alertKey2h);
          const h = Math.floor(timeLeft / 3600000);
          const m = Math.floor((timeLeft % 3600000) / 60000);
          const timeStr = h > 0 ? `${h} ${T.hours} ${m} ${T.minutes}` : `${m} ${T.minutes}`;
          if (isBorrower) {
            addNotif({ type: 'time_alert', title: `⏰ ${T.alertTimeRunningOut}`, body: `${T.alertVacateIn} ${timeStr}. ${T.alertConfirmVacatedDesc}`, spaceCode: entry.spaceCode });
          }
          if (isOwner) {
            addNotif({ type: 'time_alert', title: `⏰ ${T.alertTimeRunningOut}`, body: `${entry.spaceCode} — ${T.alertVacateIn} ${timeStr}`, spaceCode: entry.spaceCode });
          }
        }

        if (timeLeft <= 0 && !alertSentRef.current.has(alertKeyExpired)) {
          alertSentRef.current.add(alertKeyExpired);
          if (isBorrower) {
            setVacateModal({ sharingId: entry.id, spaceCode: entry.spaceCode, endTime: entry.to, role: 'borrower' });
            addNotif({ type: 'time_alert', title: `🚨 ${T.alertVacateNow}`, body: `${T.alertConfirmVacatedDesc} ${entry.spaceCode}`, spaceCode: entry.spaceCode });
          }
          if (isOwner) {
            addNotif({ type: 'time_alert', title: `🚨 ${T.alertOwnerNotice}`, body: `${entry.spaceCode} — ${T.alertOwnerVehicleStill} ${entry.borrowerPlate ? `(${T.plateNumberShort} ${entry.borrowerPlate})` : ''}`, spaceCode: entry.spaceCode });
            if (!isBorrower) {
              setVacateModal({ sharingId: entry.id, spaceCode: entry.spaceCode, endTime: entry.to, role: 'owner', borrowerPlate: entry.borrowerPlate });
            }
          }
        }
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [sharing, CU.id, T, addNotif]);

  const handleConfirmVacated = useCallback(async (sharingId: string) => {
    try {
      await residentApi.confirmVacated(sharingId);
      showToast(T.vacatedConfirmed);
      setVacateModal(null);
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [showToast, T, refreshData]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const unreadMsgCount = useMemo(() => chats.reduce((sum, c) => sum + c.messages.filter(m => m.fromUserId !== CU.id).length, 0) > 0 ? chats.length : 0, [chats, CU.id]);

  const sendChatMessage = useCallback(async (chatId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await residentApi.sendMessage(chatId, text.trim());
      await refreshChats();
      setChatInput('');
    } catch {}
  }, [CU.id, refreshChats]);

  const openChat = useCallback(async (otherUserId: string, spaceCode: string, reservationId: string) => {
    const isParty = sharing.some(s => s.id === reservationId && s.status === 'confirmed' && (s.userId === CU.id || s.requestedBy?.userId === CU.id))
      || seeking.some(s => s.id === reservationId && s.status === 'matched' && s.userId === CU.id);
    if (!isParty) return;
    try {
      const res = await residentApi.getOrCreateChat(otherUserId, spaceCode, reservationId);
      await refreshChats();
      setActiveChatId(res.id);
      setScreen('chat');
    } catch {}
  }, [sharing, seeking, CU.id, refreshChats]);
  const myReservation = useMemo(() => {
    const cs = sharing.find(s => s.requestedBy?.userId === CU.id && s.status === 'confirmed');
    if (cs) return { spaceCode: cs.spaceCode, parkingType: cs.parkingType, from: cs.from, to: cs.to, owner: anonName(cs.userId, CU.id, cs.residentName, T), stage: cs.stage, id: cs.id, otherUserId: cs.userId };
    const ms = seeking.find(s => s.userId === CU.id && s.status === 'matched');
    if (ms) return { spaceCode: ms.matchedSpaceCode!, parkingType: (ms.matchedParkingType || 'podziemne') as ParkingType, from: ms.from, to: ms.to, owner: anonName(ms.userId, CU.id, ms.matchedOwner || '', T), stage: ms.stage, id: ms.id, otherUserId: '' };
    const ownConfirmed = sharing.find(s => s.userId === CU.id && s.status === 'confirmed' && s.requestedBy);
    if (ownConfirmed && ownConfirmed.requestedBy) return { spaceCode: ownConfirmed.spaceCode, parkingType: ownConfirmed.parkingType, from: ownConfirmed.from, to: ownConfirmed.to, owner: anonName(ownConfirmed.requestedBy.userId, CU.id, ownConfirmed.requestedBy.userName, T), stage: ownConfirmed.stage, id: ownConfirmed.id, otherUserId: ownConfirmed.requestedBy.userId };
    return null;
  }, [sharing, seeking, CU.id, T]);

  const mySharing = useMemo(() => sharing.find(s => s.userId === CU.id && s.status !== 'confirmed'), [sharing, CU.id]);
  const mySeeking = useMemo(() => seeking.find(s => s.userId === CU.id && s.status !== 'matched'), [seeking, CU.id]);

  const handleAddListing = useCallback(async () => {
    if (!addTo || !addFrom) { showToast(T.fillDates); return; }
    const fromISO = `${addFrom}T${addTimeFrom}:00`;
    const toISO = `${addTo}T${addTimeTo}:00`;
    try {
      if (addType === 'share') {
        await residentApi.addSharing(fromISO, toISO);
        addNotif({ type: 'new_listing', title: T.notifListingPublished, body: `${T.notifYouShare} ${CU.spaceCode} (${parkingShort(CU.parkingType, lang)}) ${formatDateTime(fromISO, lang)} – ${formatDateTime(toISO, lang)}` });
        showToast(T.spaceShared);
      } else {
        await residentApi.addSeeking(fromISO, toISO);
        addNotif({ type: 'new_listing', title: T.notifListingPublished, body: `${T.notifYouSeek} ${formatDateTime(fromISO, lang)} – ${formatDateTime(toISO, lang)}` });
        showToast(T.listingPublished);
      }
      await refreshData();
      setAddFrom(todayStr()); setAddTo(''); setAddTimeFrom('08:00'); setAddTimeTo('18:00');
      setScreen('board'); setBoardTab(addType === 'share' ? 'sharing' : 'seeking');
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [addType, addFrom, addTo, addTimeFrom, addTimeTo, CU, showToast, addNotif, T, lang, refreshData]);

  const handleRequestSpace = useCallback(async (sharingId: string) => {
    try {
      await residentApi.requestSpace(sharingId);
      const target = sharing.find(s => s.id === sharingId);
      if (target) addNotif({ type: 'reservation_request', title: T.notifRequestSent, body: `${T.notifYouAsked} ${target.spaceCode} (${parkingShort(target.parkingType, lang)})`, spaceCode: target.spaceCode, relatedId: sharingId });
      showToast(T.requestSentShort);
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [sharing, CU, showToast, addNotif, T, lang, refreshData]);

  const handleAcceptRequest = useCallback(async (sharingId: string) => {
    const target = sharing.find(s => s.id === sharingId);
    if (!target || target.status !== 'pending' || target.userId !== CU.id || !target.requestedBy) return;
    try {
      await residentApi.acceptRequest(sharingId);
      const reqUser = target.requestedBy;
      addNotif({ type: 'reservation_accepted', title: T.notifReservationConfirmed, body: `${target.spaceCode} (${parkingShort(target.parkingType, lang)}) → ${anonName(reqUser.userId, CU.id, reqUser.userName, T)}`, spaceCode: target.spaceCode, relatedId: sharingId });
      await residentApi.getOrCreateChat(reqUser.userId, target.spaceCode, sharingId);
      await Promise.all([refreshData(), refreshChats()]);
      setConfirmationView({ spaceCode: target.spaceCode, parkingType: target.parkingType, from: target.from, to: target.to, owner: anonName(reqUser.userId, CU.id, reqUser.userName, T), stage: target.stage, type: 'reserved' });
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [sharing, CU.id, addNotif, T, lang, refreshData, refreshChats, showToast]);

  const handleRejectRequest = useCallback(async (sharingId: string) => {
    const target = sharing.find(s => s.id === sharingId);
    if (!target || target.status !== 'pending' || target.userId !== CU.id) return;
    try {
      await residentApi.rejectRequest(sharingId);
      addNotif({ type: 'reservation_rejected', title: T.notifRejected, body: `${T.notifRejectedReservation} ${target.spaceCode}`, relatedId: sharingId });
      showToast(T.rejected);
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [sharing, CU.id, showToast, addNotif, T, refreshData]);

  const handleOfferToSeeker = useCallback(async (seekingId: string) => {
    try {
      await residentApi.addProposal(seekingId);
      addNotif({ type: 'proposal_received', title: T.notifProposalSent, body: `${T.notifYouProposed} ${CU.spaceCode} (${parkingShort(CU.parkingType, lang)})`, spaceCode: CU.spaceCode, relatedId: seekingId });
      setProposalModal(null); showToast(T.proposalSentShort);
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); setProposalModal(null); }
  }, [CU, showToast, addNotif, T, lang, refreshData]);

  const handleAcceptProposal = useCallback(async (seekingId: string, proposal: Proposal) => {
    const target = seeking.find(s => s.id === seekingId);
    if (!target) return;
    try {
      await residentApi.acceptProposal(seekingId, proposal.id);
      addNotif({ type: 'match', title: T.notifSpaceReserved, body: `${proposal.spaceCode} (${parkingShort(proposal.parkingType, lang)}) → ${anonName(proposal.fromUserId, CU.id, proposal.fromUserName, T)}`, spaceCode: proposal.spaceCode, relatedId: seekingId });
      await residentApi.getOrCreateChat(proposal.fromUserId, proposal.spaceCode, seekingId);
      await Promise.all([refreshData(), refreshChats()]);
      setConfirmationView({ spaceCode: proposal.spaceCode, parkingType: proposal.parkingType, from: target.from, to: target.to, owner: anonName(proposal.fromUserId, CU.id, proposal.fromUserName, T), stage: proposal.stage, type: 'matched' });
    } catch (e: any) { showToast(e.message || T.spaceNotAvailable); await refreshData(); }
  }, [seeking, CU.id, showToast, addNotif, T, lang, refreshData, refreshChats]);

  const handleRejectProposal = useCallback(async (seekingId: string, proposalId: string) => {
    try {
      await residentApi.rejectProposal(seekingId, proposalId);
      showToast(T.proposalRejected);
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [CU.id, showToast, T, refreshData]);

  const [editModal, setEditModal] = useState<{ id: string; type: 'sharing' | 'seeking'; from: string; to: string } | null>(null);
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editFromTime, setEditFromTime] = useState('08:00');
  const [editToTime, setEditToTime] = useState('18:00');

  const openEditModal = useCallback((id: string, type: 'sharing' | 'seeking', from: string, to: string) => {
    const fd = new Date(from);
    const td = new Date(to);
    setEditFrom(fd.toISOString().split('T')[0]);
    setEditTo(td.toISOString().split('T')[0]);
    setEditFromTime(fd.toTimeString().slice(0, 5));
    setEditToTime(td.toTimeString().slice(0, 5));
    setEditModal({ id, type, from, to });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editModal) return;
    try {
      const from = `${editFrom}T${editFromTime}:00`;
      const to = `${editTo}T${editToTime}:00`;
      if (editModal.type === 'sharing') {
        await residentApi.editSharing(editModal.id, from, to);
      } else {
        await residentApi.editSeeking(editModal.id, from, to);
      }
      showToast(T.save + ' ✓');
      setEditModal(null);
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [editModal, editFrom, editTo, editFromTime, editToTime, showToast, T, refreshData]);

  const handleDeleteSharing = useCallback(async (id: string) => {
    if (!confirm(T.confirmDelete)) return;
    try {
      await residentApi.deleteSharing(id);
      showToast(T.deleteListing + ' ✓');
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [showToast, T, refreshData]);

  const handleDeleteSeeking = useCallback(async (id: string) => {
    if (!confirm(T.confirmDelete)) return;
    try {
      await residentApi.deleteSeeking(id);
      showToast(T.deleteListing + ' ✓');
      await refreshData();
    } catch (e: any) { showToast(e.message || 'Error'); }
  }, [showToast, T, refreshData]);

  const markAllRead = useCallback(async () => {
    try {
      await residentApi.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  }, [CU.id]);

  const matchesSearch = useCallback((text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.trim().toLowerCase());
  }, [searchQuery]);

  const filteredSharing = sharing.filter(c => {
    if (archivedIds.has(c.id)) return false;
    if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
    if (typeFilter !== 'all' && c.parkingType !== typeFilter) return false;
    if (searchQuery.trim() && !matchesSearch(`${c.residentName} ${c.spaceCode} ${c.note} ${c.stage}`)) return false;
    return true;
  });
  const filteredSeeking = seeking.filter(c => {
    if (archivedIds.has(c.id)) return false;
    if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
    if (searchQuery.trim() && !matchesSearch(`${c.residentName} ${c.note} ${c.stage}`)) return false;
    return true;
  });

  const daysLabel = (n: number) => n === 1 ? T.day : T.days;

  const activeStages = useMemo(() => {
    const s = new Set<Stage>();
    sharing.forEach(e => s.add(e.stage));
    seeking.forEach(e => s.add(e.stage));
    return STAGES.filter(st => s.has(st));
  }, [sharing, seeking]);

  return (
    <div className="app-wrap">
      {toast && <div className="app-toast">{toast}</div>}

      {confirmationView && (
        <div className="app-overlay" onClick={() => setConfirmationView(null)}>
          <div className="confirm-card" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">✓</div>
            <h2 className="confirm-title">{T.spaceReserved}</h2>
            <div className="confirm-space">{confirmationView.spaceCode}</div>
            <div className="confirm-details">
              <div className="confirm-row"><span>{T.type}</span><strong>{parkingLabel(confirmationView.parkingType, lang)}</strong></div>
              <div className="confirm-row"><span>{T.stage}</span><strong>{T.stage} {confirmationView.stage}</strong></div>
              <div className="confirm-row"><span>{T.from}</span><strong>{formatDateTime(confirmationView.from, lang)}</strong></div>
              <div className="confirm-row"><span>{T.to}</span><strong>{formatDateTime(confirmationView.to, lang)}</strong></div>
              <div className="confirm-row"><span>{confirmationView.type === 'reserved' ? T.forPerson : T.fromPerson}</span><strong>{confirmationView.owner}</strong></div>
            </div>
            <p className="confirm-hint">{T.rememberRemote} {confirmationView.stage}</p>
            <button className="confirm-btn" onClick={() => { setConfirmationView(null); setScreen('home'); }}>{T.understand}</button>
          </div>
        </div>
      )}

      {vacateModal && (
        <div className="app-overlay" onClick={() => {}}>
          <div className="confirm-card vacate-card" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon vacate-icon">{vacateModal.role === 'borrower' ? '🚨' : '⚠️'}</div>
            <h2 className="confirm-title">{vacateModal.role === 'borrower' ? T.alertVacateNow : T.alertOwnerNotice}</h2>
            <div className="confirm-space">{vacateModal.spaceCode}</div>
            <div className="confirm-details">
              <div className="confirm-row"><span>{T.to}</span><strong>{formatDateTime(vacateModal.endTime, lang)}</strong></div>
              {vacateModal.borrowerPlate && <div className="confirm-row"><span>{T.plateNumberShort}</span><strong>{vacateModal.borrowerPlate}</strong></div>}
            </div>
            <p className="confirm-hint" style={{color: 'var(--red, #e74c3c)', fontWeight: 600}}>
              {vacateModal.role === 'borrower' ? T.alertConfirmVacatedDesc : T.alertOwnerVehicleStill}
            </p>
            <button className="confirm-btn" style={{background: 'var(--red, #e74c3c)'}} onClick={() => handleConfirmVacated(vacateModal.sharingId)}>
              {T.confirmVacatedBtn}
            </button>
            {vacateModal.role === 'owner' && (
              <button className="confirm-btn" style={{background: 'var(--orange, #f59e0b)', marginTop: '8px'}} onClick={() => { handleReportVehicle(vacateModal.sharingId); }}>
                🚨 {T.reportVehicle}
              </button>
            )}
            <button className="confirm-btn" style={{background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)', marginTop: '8px'}} onClick={() => setVacateModal(null)}>
              {T.back}
            </button>
          </div>
        </div>
      )}

      {proposalModal && (
        <div className="app-overlay" onClick={() => setProposalModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 className="modal-title">{T.proposeTitle}</h3>
            <p className="modal-sub">{T.proposeAutoSub} {CU.spaceCode} ({parkingShort(CU.parkingType, lang)})</p>
            <div className="modal-space-preview">
              <div className="msp-code">{CU.spaceCode}</div>
              <div className="msp-details"><span>{parkingLabel(CU.parkingType, lang)}</span><span>{T.stage} {CU.stage}</span></div>
            </div>
            <div className="modal-fields">
            </div>
            <div className="modal-private-note">{T.privateProposal}</div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setProposalModal(null)}>{T.cancel}</button>
              <button className="btn-primary btn-orange" onClick={() => handleOfferToSeeker(proposalModal)}>{T.proposeYourSpace} {CU.spaceCode}</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="edit-modal-overlay" onClick={() => setEditModal(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <h3>{T.editListingTitle}</h3>
            <div className="field-label">{T.dateFrom}</div>
            <div className="datetime-row">
              <input type="date" value={editFrom} onChange={e => setEditFrom(e.target.value)} />
              <input type="time" value={editFromTime} onChange={e => setEditFromTime(e.target.value)} style={{padding:'10px 12px',borderRadius:10,border:'1px solid var(--border)',fontSize:14,background:'var(--bg)',marginBottom:12}} />
            </div>
            <div className="field-label">{T.dateTo}</div>
            <div className="datetime-row">
              <input type="date" value={editTo} onChange={e => setEditTo(e.target.value)} />
              <input type="time" value={editToTime} onChange={e => setEditToTime(e.target.value)} style={{padding:'10px 12px',borderRadius:10,border:'1px solid var(--border)',fontSize:14,background:'var(--bg)',marginBottom:12}} />
            </div>
            <div className="edit-modal-btns">
              <button className="btn-secondary" onClick={() => setEditModal(null)}>{T.cancel}</button>
              <button className="btn-primary" onClick={handleEditSave}>{T.save}</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'home' && (
        <div className="screen">
          <div className="home-header">
            <div>
              <div className="home-greeting">{T.hello} {CU.firstName} 👋</div>
              <div className="home-sub">{T.residenceName} · {T.stage} {CU.stage}</div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button className="customize-btn" onClick={() => setShowCustomize(!showCustomize)} title={T.customizeView}>⚙️</button>
              <button className="notif-btn" onClick={() => { setScreen('notifications'); markAllRead(); }}>🔔{unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}</button>
            </div>
          </div>

          {showCustomize && (
            <div className="customize-panel">
              <div className="customize-title">{T.language}</div>
              <div className="settings-options" style={{marginBottom:12}}>
                <button className={`settings-opt ${lang === 'pl' ? 'settings-opt-active' : ''}`} onClick={() => setLang('pl')}>🇵🇱 PL</button>
                <button className={`settings-opt ${lang === 'en' ? 'settings-opt-active' : ''}`} onClick={() => setLang('en')}>🇬🇧 EN</button>
              </div>
              <div className="customize-title">{T.theme}</div>
              <div className="settings-options" style={{marginBottom:12}}>
                <button className={`settings-opt ${theme === 'light' ? 'settings-opt-active' : ''}`} onClick={() => setTheme('light')}>☀️ {T.themeLight}</button>
                <button className={`settings-opt ${theme === 'beige' ? 'settings-opt-active' : ''}`} onClick={() => setTheme('beige')}>🏖️ {T.themeBeige}</button>
                <button className={`settings-opt ${theme === 'dark' ? 'settings-opt-active' : ''}`} onClick={() => setTheme('dark')}>🌙 {T.themeDark}</button>
              </div>
              <div className="customize-title">{T.customizeView}</div>
              {homeWidgets.map(w => (
                <label key={w.id} className="customize-row">
                  <input type="checkbox" checked={w.enabled} onChange={() => toggleWidget(w.id)} />
                  <span>{w.label}</span>
                </label>
              ))}
            </div>
          )}

          {isWidgetOn('spaceCard') && (
            <div className="home-space-card">
              <div className="hsc-icon">{CU.parkingType === 'podziemne' ? '🅿️' : '🚗'}</div>
              <div className="hsc-info">
                <div className="hsc-label">{T.yourSpace}</div>
                <div className="hsc-code">{CU.spaceCode}</div>
                <div className="hsc-type">{parkingShort(CU.parkingType, lang)} · {T.stage} {CU.stage}{CU.plateNumber ? ` · ${CU.plateNumber}` : ''}</div>
              </div>
              <div className="hsc-status">● {T.available}</div>
            </div>
          )}
          {isWidgetOn('reservation') && myReservation && (
            <div className="home-reservation">
              <div className="hr-header"><span className="hr-icon">📋</span><span className="hr-title">{T.activeReservation}</span></div>
              <div className="hr-space">{myReservation.spaceCode}</div>
              <div className="hr-dates">{formatDateTime(myReservation.from, lang)} → {formatDateTime(myReservation.to, lang)}</div>
              <div className="hr-owner">{T.fromPerson}: {myReservation.owner} · {T.stage} {myReservation.stage} · {parkingShort(myReservation.parkingType, lang)}</div>
              {myReservation.otherUserId && <button className="ha-action ha-chat-btn" onClick={() => openChat(myReservation.otherUserId, myReservation.spaceCode, myReservation.id)}>💬 {T.messages}</button>}
            </div>
          )}
          {isWidgetOn('myAds') && mySeeking && (
            <div className="home-active-ad home-ad-seeking">
              <div className="ha-header"><span className="ha-icon">🔍</span><span className="ha-title">{T.seekingSpace}</span>{mySeeking.proposals.length > 0 && <span className="ha-badge">{mySeeking.proposals.length} {mySeeking.proposals.length === 1 ? T.proposals : T.proposalsPlural}</span>}</div>
              <div className="ha-body">{T.searchingFor} {formatDateTime(mySeeking.from, lang)} – {formatDateTime(mySeeking.to, lang)}</div>
              <button className="ha-action" onClick={() => { setScreen('board'); setBoardTab('seeking'); }}>{mySeeking.proposals.length > 0 ? T.seeProposals : T.seeListing}</button>
            </div>
          )}
          {isWidgetOn('myAds') && mySharing && mySharing.status === 'pending' && (
            <div className="home-active-ad home-ad-pending">
              <div className="ha-header"><span className="ha-icon">⏳</span><span className="ha-title">{T.reservationRequest}</span><span className="ha-badge ha-badge-alert">{T.actionRequired}</span></div>
              <div className="ha-body">{mySharing.requestedBy ? anonName(mySharing.requestedBy.userId, CU.id, mySharing.requestedBy.userName, T) : ''} {T.wantsToReserve} {mySharing.spaceCode}</div>
              <button className="ha-action" onClick={() => { setScreen('board'); setBoardTab('sharing'); }}>{T.acceptOrReject}</button>
            </div>
          )}
          {isWidgetOn('quickActions') && (<>
            <div className="home-section-title">{T.quickActions}</div>
            <div className="quick-actions">
              <button className="qa-btn" onClick={() => { setScreen('add'); setAddType('share'); }}><span className="qa-icon">🅿️</span><span className="qa-label">{T.shareSpace}</span></button>
              <button className="qa-btn" onClick={() => { setScreen('add'); setAddType('seek'); }}><span className="qa-icon">🔍</span><span className="qa-label">{T.seekSpace}</span></button>
              <button className="qa-btn" onClick={() => { setScreen('board'); setBoardTab('sharing'); }}><span className="qa-icon">📋</span><span className="qa-label">{T.board}</span></button>
              <button className="qa-btn" onClick={() => setScreen('notifications')}><span className="qa-icon">🔔</span><span className="qa-label">{T.notificationsLabel}</span></button>
            </div>
          </>)}
          {isWidgetOn('recent') && (<>
            <div className="home-section-title">{T.recentListings}</div>
            <div className="recent-list">
              {sharing.filter(s => s.status === 'available' && !archivedIds.has(s.id)).slice(0, 3).map(s => (
                <SwipeItem key={s.id} onSwipe={() => archiveItem(s.id)}>
                  <div className="recent-item" onClick={() => { setScreen('board'); setBoardTab('sharing'); }}>
                    <div className="ri-avatar">{anonAvatar(s.userId, CU.id, s.avatar)}</div>
                    <div className="ri-content"><div className="ri-title">{anonName(s.userId, CU.id, s.residentName, T)} {T.shares} {s.spaceCode}</div><div className="ri-sub">{formatDateTime(s.from, lang)} – {formatDateTime(s.to, lang)} · {parkingShort(s.parkingType, lang)} · {T.stage} {s.stage}</div></div>
                    <span className="ri-time">{timeAgo(s.postedAt, lang)}</span>
                  </div>
                </SwipeItem>
              ))}
              {seeking.filter(s => s.status === 'open' && !archivedIds.has(s.id)).slice(0, 2).map(s => (
                <SwipeItem key={s.id} onSwipe={() => archiveItem(s.id)}>
                  <div className="recent-item ri-seeking" onClick={() => { setScreen('board'); setBoardTab('seeking'); }}>
                    <div className="ri-avatar ri-avatar-seek">{anonAvatar(s.userId, CU.id, s.avatar)}</div>
                    <div className="ri-content"><div className="ri-title">{anonName(s.userId, CU.id, s.residentName, T)} {T.seeks}</div><div className="ri-sub">{formatDateTime(s.from, lang)} – {formatDateTime(s.to, lang)} · {T.stage} {s.stage}</div></div>
                    <span className="ri-time">{timeAgo(s.postedAt, lang)}</span>
                  </div>
                </SwipeItem>
              ))}
            </div>
          </>)}

          {lastArchived && (
            <div className="undo-bar">
              <span>{T.archived}</span>
              <button className="undo-btn" onClick={undoArchive}>{T.undo}</button>
            </div>
          )}
        </div>
      )}

      {screen === 'board' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('home')}>{T.back}</button><h1 className="topbar-title">{T.parkingBoard}</h1><div /></div>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder={T.searchPlaceholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button className={`filter-toggle ${showFilters ? 'filter-active' : ''}`} onClick={() => setShowFilters(!showFilters)}>⚙️</button>
          </div>
          {showFilters && (
            <div className="filter-panel">
              <div className="filter-row">
                <span className="filter-label">{T.filterType}:</span>
                <button className={`sc-chip ${typeFilter === 'all' ? 'sc-active' : ''}`} onClick={() => setTypeFilter('all')}>{T.filterAll}</button>
                <button className={`sc-chip ${typeFilter === 'podziemne' ? 'sc-active' : ''}`} onClick={() => setTypeFilter('podziemne')}>🅿️ {T.filterUnderground}</button>
                <button className={`sc-chip ${typeFilter === 'naziemne' ? 'sc-active' : ''}`} onClick={() => setTypeFilter('naziemne')}>🚗 {T.filterSurface}</button>
              </div>
            </div>
          )}
          <div className="board-tabs">
            <button className={`bt-tab ${boardTab === 'sharing' ? 'bt-active' : ''}`} onClick={() => setBoardTab('sharing')}>🅿️ {T.freeSpaces} <span className="bt-count">{filteredSharing.filter(s => s.status === 'available' || s.status === 'pending').length}</span></button>
            <button className={`bt-tab ${boardTab === 'seeking' ? 'bt-active' : ''}`} onClick={() => setBoardTab('seeking')}>🔍 {T.seekingSpaces} <span className="bt-count">{filteredSeeking.filter(s => s.status !== 'matched').length}</span></button>
          </div>
          <div className="stage-chips">{(['all' as StageFilter, ...activeStages]).map(s => (<button key={s} className={`sc-chip ${stageFilter === s ? 'sc-active' : ''}`} onClick={() => setStageFilter(s)}>{s === 'all' ? T.all : s}</button>))}</div>
          <div className="card-list">
            {boardTab === 'sharing' ? (filteredSharing.length > 0 ? filteredSharing.map(card => (
              <SwipeItem key={card.id} onSwipe={() => archiveItem(card.id)}>
                <SharingCard card={card} cu={CU} cuAvatar={avatar} cuName={name} onRequest={handleRequestSpace} onAccept={handleAcceptRequest} onReject={handleRejectRequest} onChat={openChat} onEdit={(id, from, to) => openEditModal(id, 'sharing', from, to)} onDelete={handleDeleteSharing} lang={lang} T={T} daysLabel={daysLabel} hasActiveReservation={sharing.some(s => s.requestedBy?.userId === CU.id && (s.status === 'pending' || s.status === 'confirmed'))} />
              </SwipeItem>
            )) : <div className="empty-msg">{T.noListings}</div>) : (filteredSeeking.length > 0 ? filteredSeeking.map(card => (
              <SwipeItem key={card.id} onSwipe={() => archiveItem(card.id)}>
                <SeekingCard card={card} cu={CU} onOpenProposal={setProposalModal} onAcceptProposal={handleAcceptProposal} onRejectProposal={handleRejectProposal} onEdit={(id, from, to) => openEditModal(id, 'seeking', from, to)} onDelete={handleDeleteSeeking} lang={lang} T={T} daysLabel={daysLabel} />
              </SwipeItem>
            )) : <div className="empty-msg">{T.noListings}</div>)}
          </div>
          {lastArchived && (
            <div className="undo-bar">
              <span>{T.archived}</span>
              <button className="undo-btn" onClick={undoArchive}>{T.undo}</button>
            </div>
          )}
          <button className="fab" onClick={() => { setScreen('add'); setAddType(boardTab === 'sharing' ? 'share' : 'seek'); }}>+</button>
        </div>
      )}

      {screen === 'add' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('home')}>{T.back}</button><h1 className="topbar-title">{T.newListing}</h1><div /></div>
          <div className="add-type-switch">
            <button className={`ats-btn ${addType === 'share' ? 'ats-active' : ''}`} onClick={() => setAddType('share')}>🅿️ {T.iShare}</button>
            <button className={`ats-btn ${addType === 'seek' ? 'ats-active ats-seek' : ''}`} onClick={() => setAddType('seek')}>🔍 {T.iSeek}</button>
          </div>
          <div className="add-form">
            {addType === 'share' && (
              <div className="add-space-preview"><div className="asp-label">{T.yourSpaceAuto}</div><div className="asp-code">{CU.spaceCode}</div><div className="asp-details">{parkingLabel(CU.parkingType, lang)} · {T.stage} {CU.stage}</div></div>
            )}
            <label className="field-label">{T.dateFrom}</label>
            <div className="datetime-row">
              <input className="field-input datetime-date" type="date" value={addFrom} onChange={e => setAddFrom(e.target.value)} />
              <input className="field-input datetime-time" type="time" value={addTimeFrom} onChange={e => setAddTimeFrom(e.target.value)} />
            </div>
            <label className="field-label">{T.dateTo}</label>
            <div className="datetime-row">
              <input className="field-input datetime-date" type="date" value={addTo} onChange={e => setAddTo(e.target.value)} min={addFrom} />
              <input className="field-input datetime-time" type="time" value={addTimeTo} onChange={e => setAddTimeTo(e.target.value)} />
            </div>
            <div className="add-info"><span>📍</span><span>{T.listingVisibleFor} {CU.stage}{addType === 'share' ? ` · ${parkingShort(CU.parkingType, lang)}` : ''}</span></div>
            <button className={`btn-primary btn-full ${addType === 'seek' ? 'btn-orange' : ''}`} onClick={handleAddListing}>{addType === 'share' ? `${T.publishShare} ${CU.spaceCode}` : T.publishSeek}</button>
          </div>
        </div>
      )}

      {screen === 'notifications' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('home')}>{T.back}</button><h1 className="topbar-title">{T.notificationsLabel}</h1><div /></div>
          <div style={{textAlign:'right',padding:'0 0 8px'}}><button className="topbar-action" onClick={markAllRead}>{T.markRead}</button></div>
          <div className="notif-list">
            {notifications.length === 0 ? <div className="empty-msg">{T.noNotifications}</div> : notifications.map(n => (
              <div key={n.id} className={`notif-item ${!n.read ? 'notif-unread' : ''}`} onClick={() => { if (n.relatedId) { setScreen('board'); setBoardTab(n.relatedId.startsWith('sh') ? 'sharing' : 'seeking'); } }}>
                <div className="ni-icon">{n.type === 'new_listing' ? '📋' : n.type === 'reservation_request' ? '📩' : n.type === 'reservation_accepted' ? '✅' : n.type === 'reservation_rejected' ? '❌' : n.type === 'proposal_received' ? '💡' : n.type === 'proposal_accepted' ? '🎉' : '🤝'}</div>
                <div className="ni-content"><div className="ni-title">{n.title}</div><div className="ni-body">{n.body}</div><div className="ni-time">{timeAgo(n.createdAt, lang)}</div></div>
                {!n.read && <span className="ni-dot" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === 'profile' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('home')}>{T.back}</button><h1 className="topbar-title">{T.profile}</h1><div /></div>
          <div className="profile-card">
            <div className="profile-avatar">{avatar}</div>
            <div className="profile-name">{name}</div>
            <div className="profile-stage">{T.stage} {CU.stage} · {CU.spaceCode} · {parkingShort(CU.parkingType, lang)}</div>
            <div className="profile-address">{CU.street} {CU.building}/{CU.apartment}, {CU.city}</div>
          </div>
          <div className="profile-details">
            <div className="pd-row"><span className="pd-label">{T.firstName}</span><span className="pd-val">{CU.firstName}</span></div>
            <div className="pd-row"><span className="pd-label">{T.lastName}</span><span className="pd-val">{CU.lastName}</span></div>
            <div className="pd-row"><span className="pd-label">{T.address}</span><span className="pd-val">{CU.street} {CU.building}/{CU.apartment}</span></div>
            <div className="pd-row"><span className="pd-label">{T.city}</span><span className="pd-val">{CU.city}</span></div>
            <div className="pd-row"><span className="pd-label">{T.space}</span><span className="pd-val">{CU.spaceCode}</span></div>
            <div className="pd-row"><span className="pd-label">{T.parkingType}</span><span className="pd-val">{parkingLabel(CU.parkingType, lang)}</span></div>
            <div className="pd-row"><span className="pd-label">{T.stage}</span><span className="pd-val">{T.stage} {CU.stage}</span></div>
            {CU.plateNumber && <div className="pd-row"><span className="pd-label">{T.plateNumber}</span><span className="pd-val">{CU.plateNumber}</span></div>}
          </div>
          <div className="profile-stats">
            <div className="ps-item"><div className="ps-val">{sharing.filter(s => s.userId === CU.id).length}</div><div className="ps-label">{T.shared}</div></div>
            <div className="ps-item"><div className="ps-val">{seeking.filter(s => s.userId === CU.id).length}</div><div className="ps-label">{T.searched}</div></div>
            <div className="ps-item"><div className="ps-val">{myReservation ? 1 : 0}</div><div className="ps-label">{T.reservations}</div></div>
          </div>
          <div className="gdpr-notice">
            <div className="gdpr-icon">🔒</div>
            <div className="gdpr-text"><strong>{T.securityNotice}</strong><br />{T.gdprInfo}</div>
          </div>
          <button className="btn-settings" onClick={() => setScreen('settings')}>⚙️ {T.settings}</button>
          <button className="btn-settings" onClick={() => setScreen('regulations')}>{T.regulationsBtn}</button>
          {CU.role === 'admin' && <Link href="/login" className="profile-admin-link">{T.adminPanel}</Link>}
          <button className="btn-logout" onClick={onLogout}>{T.logout}</button>
        </div>
      )}

      {screen === 'settings' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('profile')}>{T.back}</button><h1 className="topbar-title">{T.settings}</h1><div /></div>
          <div className="settings-section">
            <div className="settings-label">{T.theme}</div>
            <div className="settings-options">
              <button className={`settings-opt ${theme === 'light' ? 'settings-opt-active' : ''}`} onClick={() => setTheme('light')}>☀️ {T.themeLight}</button>
              <button className={`settings-opt ${theme === 'beige' ? 'settings-opt-active' : ''}`} onClick={() => setTheme('beige')}>🏖️ {T.themeBeige}</button>
              <button className={`settings-opt ${theme === 'dark' ? 'settings-opt-active' : ''}`} onClick={() => setTheme('dark')}>🌙 {T.themeDark}</button>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-label">{T.language}</div>
            <div className="settings-options">
              <button className={`settings-opt ${lang === 'pl' ? 'settings-opt-active' : ''}`} onClick={() => setLang('pl')}>🇵🇱 Polski</button>
              <button className={`settings-opt ${lang === 'en' ? 'settings-opt-active' : ''}`} onClick={() => setLang('en')}>🇬🇧 English</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'regulations' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('profile')}>{T.back}</button><h1 className="topbar-title">{T.regulationsTitle}</h1><div /></div>
          <div className="regulations-content">
            <div className="reg-header">
              <div className="reg-logo">🅿️</div>
              <h2 className="reg-main-title">IdeaPark</h2>
              <p className="reg-subtitle">{T.regulationsTitle}</p>
              <p className="reg-date">{T.regulationsLastUpdate}</p>
            </div>
            {([1,2,3,4,5,6,7,8,9,10] as const).map(n => (
              <div key={n} className="reg-section">
                <h3 className="reg-section-title">{(T as any)[`regSection${n}Title`]}</h3>
                <div className="reg-section-body">{((T as any)[`regSection${n}`] as string).split('\n').map((line: string, i: number) => <p key={i} className={line.startsWith('   ') ? 'reg-indent' : ''}>{line}</p>)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === 'messages' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('home')}>{T.back}</button><h1 className="topbar-title">{T.messages}</h1><div /></div>
          <div className="messages-list">
            {chats.length === 0 ? <div className="empty-msg">{T.noChats}</div> : chats.map(chat => {
              const otherName = chat.userA === CU.id ? (chat.userBName || '') : (chat.userAName || '');
              const lastMsg = chat.messages[chat.messages.length - 1];
              return (
                <div key={chat.id} className="msg-thread-item" onClick={() => { setActiveChatId(chat.id); setScreen('chat'); }}>
                  <div className="msg-avatar">{otherName ? otherName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2) : '👤'}</div>
                  <div className="msg-thread-content">
                    <div className="msg-thread-name">{otherName || T.anonymousResident} · {chat.spaceCode}</div>
                    <div className="msg-thread-preview">{lastMsg ? (lastMsg.fromUserId === CU.id ? `${T.you}: ` : '') + lastMsg.text.slice(0, 50) : T.reservationChat}</div>
                  </div>
                  {lastMsg && <span className="msg-thread-time">{timeAgo(lastMsg.createdAt, lang)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {screen === 'chat' && activeChatId && (() => {
        const chat = chats.find(c => c.id === activeChatId);
        if (!chat || (chat.userA !== CU.id && chat.userB !== CU.id)) return null;
        const otherChatName = chat.userA === CU.id ? (chat.userBName || '') : (chat.userAName || '');
        return (
          <div className="screen chat-screen">
            <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('messages')}>{T.back}</button><h1 className="topbar-title">{otherChatName || T.anonymousResident}</h1><div /></div>
            <div className="chat-info-bar">🔒 {T.securityNotice} · {T.messageAboutSpace} {chat.spaceCode}</div>
            <div className="chat-messages">
              {chat.messages.length === 0 && <div className="empty-msg chat-empty">{T.noMessages}</div>}
              {chat.messages.map(m => (
                <div key={m.id} className={`chat-bubble ${m.fromUserId === CU.id ? 'chat-mine' : 'chat-theirs'}`}>
                  <div className="chat-bubble-text">{m.text}</div>
                  <div className="chat-bubble-time">{timeAgo(m.createdAt, lang)}</div>
                </div>
              ))}
            </div>
            <div className="chat-input-bar">
              <input className="chat-input" placeholder={T.writeMessage} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(chat.id, chatInput); }} />
              <button className="chat-send-btn" onClick={() => sendChatMessage(chat.id, chatInput)} disabled={!chatInput.trim()}>{T.sendMessage}</button>
            </div>
          </div>
        );
      })()}

      {screen === 'archive' && (
        <div className="screen">
          <div className="screen-topbar"><button className="topbar-back" onClick={() => setScreen('profile')}>{T.back}</button><h1 className="topbar-title">{T.archive}</h1><div /></div>
          <div className="board-tabs" style={{marginBottom: 16}}>
            <button className={`bt-tab ${archiveTab === 'sharing' ? 'bt-active' : ''}`} onClick={() => setArchiveTab('sharing')}>🅿️ {T.archiveSharing}</button>
            <button className={`bt-tab ${archiveTab === 'seeking' ? 'bt-active' : ''}`} onClick={() => setArchiveTab('seeking')}>🔍 {T.archiveSeeking}</button>
          </div>
          {archiveLoading ? <div className="empty-msg">...</div> : archiveTab === 'sharing' ? (
            archiveData.sharing.length === 0 ? <div className="empty-msg">{T.noArchiveSharing}</div> :
            archiveData.sharing.map((s: any) => (
              <div key={s.id} className="archive-card">
                <div className="archive-header">
                  <span className="archive-space">{s.spaceCode}</span>
                  <span className={`archive-status ${s.status === 'completed' ? 'as-completed' : 'as-expired'}`}>
                    {s.status === 'completed' ? `✅ ${T.archiveCompleted}` : `⏰ ${T.archiveExpired}`}
                  </span>
                </div>
                <div className="archive-dates">{formatDateTime(s.dateFrom, lang)} → {formatDateTime(s.dateTo, lang)}</div>
                <div className="archive-details">
                  <span>{T.archiveRole}: <strong>{s.role === 'owner' ? T.archiveOwner : T.archiveBorrower}</strong></span>
                  <span>{T.stage} {s.stage} · {parkingShort(s.parkingType, lang)}</span>
                </div>
                {s.borrowerName && <div className="archive-person">{s.role === 'owner' ? T.archiveBorrower : T.archiveOwner}: {s.role === 'owner' ? s.borrowerName : s.ownerName}</div>}
                {s.vacatedAt && <div className="archive-vacated">✅ {T.vacatedConfirmed}: {formatDateTime(s.vacatedAt, lang)}</div>}
              </div>
            ))
          ) : (
            archiveData.seeking.length === 0 ? <div className="empty-msg">{T.noArchiveSeeking}</div> :
            archiveData.seeking.map((s: any) => (
              <div key={s.id} className="archive-card">
                <div className="archive-header">
                  <span className="archive-space">{T.stage} {s.stage}</span>
                  <span className={`archive-status ${s.status === 'matched' ? 'as-completed' : 'as-expired'}`}>
                    {s.status === 'matched' ? `✅ ${T.archiveMatched}` : `⏰ ${T.archiveNotMatched}`}
                  </span>
                </div>
                <div className="archive-dates">{formatDateTime(s.dateFrom, lang)} → {formatDateTime(s.dateTo, lang)}</div>
                {s.matchedSpaceCode && <div className="archive-person">{T.matched}: {s.matchedSpaceCode} ({parkingShort(s.matchedParkingType, lang)})</div>}
              </div>
            ))
          )}
        </div>
      )}

      <nav className="bottom-nav">
        <button className={`bn-btn ${screen === 'home' ? 'bn-active' : ''}`} onClick={() => setScreen('home')}><span className="bn-icon">🏠</span><span className="bn-label">{T.home}</span></button>
        <button className={`bn-btn ${screen === 'board' ? 'bn-active' : ''}`} onClick={() => setScreen('board')}><span className="bn-icon">🅿️</span><span className="bn-label">{T.boardNav}</span></button>
        <button className={`bn-btn bn-add ${screen === 'add' ? 'bn-active' : ''}`} onClick={() => setScreen('add')}><span className="bn-icon-add">+</span></button>
        <button className={`bn-btn ${screen === 'archive' ? 'bn-active' : ''}`} onClick={() => { setScreen('archive'); loadArchive(); }}><span className="bn-icon">📁</span><span className="bn-label">{T.archiveNav}</span></button>
        <button className={`bn-btn ${screen === 'messages' || screen === 'chat' ? 'bn-active' : ''}`} onClick={() => setScreen('messages')}><span className="bn-icon">💬</span><span className="bn-label">{T.messagesNav}</span>{unreadMsgCount > 0 && <span className="bn-badge">{unreadMsgCount}</span>}</button>
        <button className={`bn-btn ${screen === 'profile' || screen === 'notifications' || screen === 'settings' ? 'bn-active' : ''}`} onClick={() => setScreen('profile')}><span className="bn-icon">👤</span><span className="bn-label">{T.profileNav}</span>{unreadCount > 0 && <span className="bn-badge">{unreadCount}</span>}</button>
      </nav>
    </div>
  );
}

function SharingCard({ card, cu, cuAvatar, cuName, onRequest, onAccept, onReject, onChat, onEdit, onDelete, lang, T, daysLabel, hasActiveReservation }: {
  card: SharingEntry; cu: ResidentUser; cuAvatar: string; cuName: string;
  onRequest: (id: string) => void; onAccept: (id: string) => void; onReject: (id: string) => void;
  onChat?: (otherUserId: string, spaceCode: string, reservationId: string) => void;
  onEdit?: (id: string, from: string, to: string) => void;
  onDelete?: (id: string) => void;
  lang: Lang; T: Translations; daysLabel: (n: number) => string; hasActiveReservation?: boolean;
}) {
  const days = daysBetween(card.from, card.to);
  const isOwner = card.userId === cu.id;
  const isRequester = card.requestedBy?.userId === cu.id;
  const sameStage = card.stage === cu.stage;
  const displayName = anonName(card.userId, cu.id, card.residentName, T);
  const displayAvatar = anonAvatar(card.userId, cu.id, card.avatar);
  const canEdit = isOwner && card.status === 'available';

  return (
    <div className={`listing-card ${card.status === 'confirmed' ? 'lc-done' : ''}`}>
      {card.status === 'pending' && isOwner && <div className="lc-alert">⚡ {T.someoneWantsYourSpace}</div>}
      <div className="lc-top">
        <div className="lc-avatar">{displayAvatar}</div>
        <div className="lc-meta"><div className="lc-name">{displayName}{isOwner && <span className="lc-you">{T.you}</span>}</div><div className="lc-time">{timeAgo(card.postedAt, lang)} · {T.stage} {card.stage}</div></div>
        <div className={`lc-stage stage-${card.stage}`}>{card.stage}</div>
      </div>
      <div className="lc-space-row"><span className="lc-space-code">{card.spaceCode}</span><span className="lc-days">{days} {daysLabel(days)}</span></div>
      <div className="lc-parking-type"><span className="lc-pt-icon">{card.parkingType === 'podziemne' ? '🅿️' : '🚗'}</span>{parkingShort(card.parkingType, lang)} · {T.stage} {card.stage}</div>
      <div className="lc-dates"><span>{formatDateTime(card.from, lang)}</span><span className="lc-arrow">→</span><span>{formatDateTime(card.to, lang)}</span></div>
      <div className="lc-actions">
        {card.status === 'available' && !isOwner && sameStage && !hasActiveReservation && <button className="btn-primary btn-full" onClick={() => onRequest(card.id)}>{T.reserveThisSpace}</button>}
        {card.status === 'available' && !isOwner && sameStage && hasActiveReservation && <div className="lc-info lc-info-pending">🔒 {T.alreadyReserved}</div>}
        {card.status === 'available' && !isOwner && !sameStage && <div className="lc-info lc-info-stage">🔑 {T.otherStage} {card.stage}</div>}
        {card.status === 'available' && isOwner && <div className="lc-info">⏳ {T.waitingForTakers}</div>}
        {canEdit && (
          <div className="lc-owner-actions">
            <button className="lc-btn-edit" onClick={() => onEdit?.(card.id, card.from, card.to)}>✏️ {T.editListing}</button>
            <button className="lc-btn-delete" onClick={() => onDelete?.(card.id)}>🗑 {T.deleteListing}</button>
          </div>
        )}
        {card.status === 'pending' && isOwner && card.requestedBy && (
          <div className="lc-request-box">
            <div className="lc-req-who"><div className="lc-mini-av">{anonAvatar(card.requestedBy.userId, cu.id, card.requestedBy.avatar)}</div><div><div className="lc-req-name">{anonName(card.requestedBy.userId, cu.id, card.requestedBy.userName, T)}</div><div className="lc-req-sub">{T.wantsYourSpace}</div></div></div>
            <div className="lc-btn-pair"><button className="btn-primary btn-sm" onClick={() => onAccept(card.id)}>✓ {T.accept}</button><button className="btn-secondary btn-sm" onClick={() => onReject(card.id)}>✗ {T.reject}</button></div>
          </div>
        )}
        {card.status === 'pending' && isRequester && <div className="lc-info lc-info-pending">⏳ {T.requestSent}</div>}
        {card.status === 'pending' && !isOwner && !isRequester && <div className="lc-info lc-info-pending">⏳ {T.someoneRequested}</div>}
        {card.status === 'confirmed' && (
          <div className="lc-confirmed-section">
            <div className="lc-info lc-info-confirmed">✓ {T.reserved}{isRequester ? ` — ${T.forYou}` : card.requestedBy ? ` · ${anonName(card.requestedBy.userId, cu.id, card.requestedBy.userName, T)}` : ''}</div>
            {card.status === 'confirmed' && (isOwner && card.borrowerPlate ? <div className="lc-plate">{T.plateNumberShort}: {card.borrowerPlate}</div> : isRequester && card.ownerPlate ? <div className="lc-plate">{T.plateNumberShort}: {card.ownerPlate}</div> : null)}
            {(isOwner || isRequester) && card.requestedBy && onChat && <button className="btn-chat-sm" onClick={() => onChat(isOwner ? card.requestedBy!.userId : card.userId, card.spaceCode, card.id)}>💬 {T.messages}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function SeekingCard({ card, cu, onOpenProposal, onAcceptProposal, onRejectProposal, onEdit, onDelete, lang, T, daysLabel }: {
  card: SeekingEntry; cu: ResidentUser;
  onOpenProposal: (id: string) => void; onAcceptProposal: (id: string, p: Proposal) => void; onRejectProposal: (id: string, pId: string) => void;
  onEdit?: (id: string, from: string, to: string) => void;
  onDelete?: (id: string) => void;
  lang: Lang; T: Translations; daysLabel: (n: number) => string;
}) {
  const days = daysBetween(card.from, card.to);
  const isOwner = card.userId === cu.id;
  const sameStage = card.stage === cu.stage;
  const hasMyProposal = card.proposals.some(p => p.fromUserId === cu.id);
  const displayName = anonName(card.userId, cu.id, card.residentName, T);
  const displayAvatar = anonAvatar(card.userId, cu.id, card.avatar);
  const canEdit = isOwner && card.status !== 'matched';

  return (
    <div className={`listing-card lc-seeking ${card.status === 'matched' ? 'lc-done' : ''}`}>
      {isOwner && card.proposals.length > 0 && card.status === 'has_proposal' && <div className="lc-alert lc-alert-proposal">💡 {card.proposals.length} {card.proposals.length === 1 ? T.proposals : T.proposalsPlural}!</div>}
      <div className="lc-top">
        <div className="lc-avatar lc-av-seek">{displayAvatar}</div>
        <div className="lc-meta"><div className="lc-name">{displayName}{isOwner && <span className="lc-you">{T.you}</span>}</div><div className="lc-time">{timeAgo(card.postedAt, lang)} · {T.stage} {card.stage}</div></div>
        <div className={`lc-stage stage-${card.stage}`}>{card.stage}</div>
      </div>
      <div className="lc-space-row"><span className="lc-seek-label">{T.seeksLabel}</span><span className="lc-days">{days} {daysLabel(days)}</span></div>
      <div className="lc-dates"><span>{formatDateTime(card.from, lang)}</span><span className="lc-arrow">→</span><span>{formatDateTime(card.to, lang)}</span></div>
      <div className="lc-actions">
        {card.status === 'open' && !isOwner && sameStage && <button className="btn-primary btn-orange btn-full" onClick={() => onOpenProposal(card.id)}>{T.proposeYourSpace} {cu.spaceCode}</button>}
        {card.status === 'open' && !isOwner && !sameStage && <div className="lc-info lc-info-stage">🔑 {T.otherStageNeeds} {card.stage}</div>}
        {card.status === 'open' && isOwner && <div className="lc-info">⏳ {T.waitingForProposals}</div>}
        {canEdit && (
          <div className="lc-owner-actions">
            <button className="lc-btn-edit" onClick={() => onEdit?.(card.id, card.from, card.to)}>✏️ {T.editListing}</button>
            <button className="lc-btn-delete" onClick={() => onDelete?.(card.id)}>🗑 {T.deleteListing}</button>
          </div>
        )}
        {card.status === 'has_proposal' && isOwner && card.proposals.map(p => (
          <div key={p.id} className="lc-proposal-card">
            <div className="lc-prop-header"><div className="lc-mini-av">{anonAvatar(p.fromUserId, cu.id, p.fromAvatar)}</div><div><div className="lc-req-name">{anonName(p.fromUserId, cu.id, p.fromUserName, T)}</div><div className="lc-req-sub">{T.proposes} <strong>{p.spaceCode}</strong> · {parkingShort(p.parkingType, lang)}</div></div><span className="lc-private-tag">🔒 {T.private}</span></div>
            {p.note && <p className="lc-prop-note">{p.note}</p>}
            <div className="lc-btn-pair"><button className="btn-primary btn-sm" onClick={() => onAcceptProposal(card.id, p)}>✓ {T.accept} {p.spaceCode}</button><button className="btn-secondary btn-sm" onClick={() => onRejectProposal(card.id, p.id)}>✗ {T.reject}</button></div>
          </div>
        ))}
        {card.status === 'has_proposal' && !isOwner && hasMyProposal && <div className="lc-info lc-info-pending">⏳ {T.proposalSent}</div>}
        {card.status === 'has_proposal' && !isOwner && !hasMyProposal && sameStage && <button className="btn-primary btn-orange btn-full" onClick={() => onOpenProposal(card.id)}>{T.proposeYourSpace} {cu.spaceCode}</button>}
        {card.status === 'has_proposal' && !isOwner && !hasMyProposal && !sameStage && <div className="lc-info lc-info-stage">🔑 {T.otherStageNeeds} {card.stage}</div>}
        {card.status === 'matched' && <div className="lc-info lc-info-confirmed">✓ {T.matched} — {card.matchedSpaceCode} ({card.matchedParkingType ? parkingShort(card.matchedParkingType, lang) : ''}) · {card.matchedOwner ? anonName(card.userId, cu.id, card.matchedOwner, T) : ''}</div>}
      </div>
    </div>
  );
}

function SwipeItem({ children, onSwipe }: { children: React.ReactNode; onSwipe: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    swiping.current = true;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping.current || !ref.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx > 0) { currentX.current = 0; ref.current.style.transform = ''; return; }
    currentX.current = dx;
    ref.current.style.transform = `translateX(${dx}px)`;
    ref.current.style.transition = 'none';
  };
  const handleTouchEnd = () => {
    swiping.current = false;
    if (!ref.current) return;
    if (currentX.current < -100) {
      ref.current.style.transition = 'transform .3s ease, opacity .3s ease';
      ref.current.style.transform = 'translateX(-120%)';
      ref.current.style.opacity = '0';
      setTimeout(onSwipe, 300);
    } else {
      ref.current.style.transition = 'transform .2s ease';
      ref.current.style.transform = '';
    }
  };

  return (
    <div className="swipe-container">
      <div className="swipe-behind">🗑️</div>
      <div ref={ref} className="swipe-content" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {children}
      </div>
    </div>
  );
}
