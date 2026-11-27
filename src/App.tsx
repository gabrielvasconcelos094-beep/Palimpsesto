import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { BarChart3, BookOpen, Compass, Map as MapIcon, Sun } from 'lucide-react';
import { closeTopOverlay } from './app/overlays';
import { canGoBack, goBack, navigate, useRoute } from './app/router';
import { store, useStoreState } from './app/store';
import { useApplyTheme } from './app/theme';
import { dismissToast, useToast } from './app/toast';
import { AssessmentPage, SafetyPlanPage } from './features/care/Care';
import { AppointmentPage } from './features/care/Appointments';
import { MedicationPage } from './features/care/Medications';
import { exitApp, onAppPause, onAppResume, onBackButton } from './platform/lifecycle';
import { clearExportCache, setPrivacyScreen } from './platform/native';
import { syncWidgets, widgetAppearanceKey, Widgets } from './platform/widgets';
import { onReminderTap, remindersKey, syncAllReminders } from './platform/reminders';
import { routeForWidgetAction } from './app/widgetActions';
import { Today } from './features/today/Today';
import { Journal } from './features/journal/Journal';
import { ExperienceEditor } from './features/journal/ExperienceEditor';
import { EventPage } from './features/journal/EventEditor';
import { MapHome, QuestionPage, SectionPage } from './features/map/MapPages';
import { DiscoveryPage } from './features/map/Discoveries';
import { GuideHome } from './features/guide/GuideHome';
import { ItemPage } from './features/guide/Repertoire';
import { SituationPage } from './features/guide/Situations';
import { LetterPage } from './features/guide/Letters';
import { AboutPage, EmotionsPage, IndicatorsPage, ScalePage, SettingsHome } from './features/settings/Settings';
import { LockScreen, PrivacyPage } from './features/settings/Privacy';
import { Onboarding } from './features/onboarding/Onboarding';
import { Dialog } from './ui/components';

/**
 * Telas pesadas e menos usadas são carregadas sob demanda (gráficos e estatísticas da
 * Trajetória, temas, dados/importação, busca, perfis de emoção): o pacote inicial fica
 * menor e o app abre mais rápido em aparelhos modestos.
 */
function lazyNamed<M extends Record<string, unknown>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}
const loadTrajectory = () => import('./features/trajectory/Trajectory');
const Trajectory = lazyNamed(loadTrajectory, 'Trajectory');
const TrajectoryCategory = lazyNamed(() => import('./features/trajectory/categories'), 'TrajectoryCategory');
const loadEmotionGuide = () => import('./features/guide/EmotionGuide');
const EmotionProfilePage = lazyNamed(loadEmotionGuide, 'EmotionProfilePage');
const EmotionsListPage = lazyNamed(loadEmotionGuide, 'EmotionsListPage');
const SearchPage = lazyNamed(() => import('./features/search/SearchPage'), 'SearchPage');
const loadThemes = () => import('./features/settings/Themes');
const ThemesPage = lazyNamed(loadThemes, 'ThemesPage');
const ThemeEditorPage = lazyNamed(loadThemes, 'ThemeEditorPage');
const DataPage = lazyNamed(() => import('./features/settings/DataPage'), 'DataPage');

const TABS = [
  { path: '/', label: 'Hoje', icon: Sun },
  { path: '/diario', label: 'Diário', icon: BookOpen },
  { path: '/mapa', label: 'Mapa', icon: MapIcon },
  { path: '/guia', label: 'Guia', icon: Compass },
  { path: '/trajetoria', label: 'Trajetória', icon: BarChart3 },
];

function Screen() {
  const { parts } = useRoute();
  const [a, b] = parts;
  switch (a) {
    case undefined:
      return <Today />;
    case 'diario':
      if (b === 'experiencia') return <ExperienceEditor />;
      if (b === 'acontecimento') return <EventPage />;
      return <Journal />;
    case 'mapa':
      if (b === 'ficha') return <SectionPage />;
      if (b === 'pergunta') return <QuestionPage />;
      if (b === 'descoberta') return <DiscoveryPage />;
      return <MapHome />;
    case 'guia':
      if (b === 'item') return <ItemPage />;
      if (b === 'situacao') return <SituationPage />;
      if (b === 'carta') return <LetterPage />;
      if (b === 'questionario') return <AssessmentPage />;
      if (b === 'plano') return <SafetyPlanPage />;
      if (b === 'consulta') return <AppointmentPage />;
      if (b === 'remedio') return <MedicationPage />;
      if (b === 'emocoes') return <EmotionsListPage />;
      if (b === 'emocao') return <EmotionProfilePage />;
      return <GuideHome />;
    case 'busca':
      return <SearchPage />;
    case 'trajetoria':
      return b ? <TrajectoryCategory /> : <Trajectory />;
    case 'ajustes':
      if (b === 'temas') return <ThemesPage />;
      if (b === 'tema') return <ThemeEditorPage />;
      if (b === 'escala') return <ScalePage />;
      if (b === 'emocoes') return <EmotionsPage />;
      if (b === 'indicadores') return <IndicatorsPage />;
      if (b === 'dados') return <DataPage />;
      if (b === 'privacidade') return <PrivacyPage />;
      if (b === 'sobre') return <AboutPage />;
      return <SettingsHome />;
    default:
      return <Today />;
  }
}

function BottomNav() {
  const { parts } = useRoute();
  const current = '/' + (parts[0] ?? '');
  // A navegação só aparece nas telas principais; telas internas têm "voltar".
  if (parts.length > 1 || parts[0] === 'ajustes' || parts[0] === 'busca') return null;
  return (
    <nav className="nav" aria-label="Navegação principal">
      <div className="nav-inner">
        {TABS.map((t) => (
          <button key={t.path} aria-current={current === t.path ? 'page' : undefined} onClick={() => navigate(t.path, { replace: true })}>
            <t.icon size={21} strokeWidth={current === t.path ? 2 : 1.6} />
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * Chave da tela: muda a cada registro diferente, mas é mantida quando um
 * editor novo (/nova) passa a ter id (/<id>) — assim o editor não é remontado.
 */
function useScreenKey(route: ReturnType<typeof useRoute>) {
  const ref = useRef<{ path: string; key: string }>({ path: route.path, key: route.path });
  if (route.path !== ref.current.path) {
    const prevParts = ref.current.path.split('/').filter(Boolean);
    const wasNew = /^(nova|novo)$/.test(prevParts[prevParts.length - 1] ?? '');
    const sameKind = prevParts.slice(0, -1).join('/') === route.parts.slice(0, -1).join('/');
    ref.current = { path: route.path, key: route.replaced && wasNew && sameKind ? ref.current.key : route.path };
  }
  return ref.current.key;
}

export function App() {
  const st = useStoreState();
  useApplyTheme(st.data.preferences);
  const message = useToast();
  const route = useRoute();
  // null = ainda não decidido: segue a configuração (evita mostrar o conteúdo antes do PIN).
  const [lockedState, setLocked] = useState<boolean | null>(null);
  const locked = lockedState ?? st.device.lock.enabled;
  const screenKey = useScreenKey(route);
  const hiddenAt = useRef<number | null>(null);
  const lockRef = useRef(st.device.lock);
  lockRef.current = st.device.lock;

  // Bloqueio ao carregar (o estado do dispositivo chega depois do primeiro render).
  const lockedOnce = useRef(false);
  useEffect(() => {
    if (st.ready && !lockedOnce.current) {
      lockedOnce.current = true;
      setLocked((l) => l ?? st.device.lock.enabled);
      void setPrivacyScreen(st.device.privacyScreen);
    }
  }, [st.ready, st.device.lock.enabled, st.device.privacyScreen]);

  // Widgets: mantém a aparência (tema, estilo, símbolos, nomes) em dia no lado nativo.
  const prefs = st.data.preferences;
  const appearanceKey = widgetAppearanceKey(prefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  useEffect(() => {
    if (!st.ready) return;
    const t = setTimeout(() => void syncWidgets(prefsRef.current).catch(() => {}), 500);
    return () => clearTimeout(t);
  }, [st.ready, appearanceKey]);

  // Lembretes de consulta: abre a consulta ao tocar e mantém as notificações agendadas
  // iguais às consultas — ao abrir e sempre que elas mudarem por qualquer caminho
  // (apagar tudo, importar, restaurar, desfazer uma exclusão).
  const remindersOnce = useRef(false);
  useEffect(() => {
    if (!st.ready || remindersOnce.current) return;
    remindersOnce.current = true;
    // Arquivos exportados (backups, PDFs) de uma sessão anterior não ficam no cache.
    void clearExportCache();
    void onReminderTap((id) => navigate(`/guia/consulta/${id}`));
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const apptKey = remindersKey(st.data.appointments);
  const apptRef = useRef(st.data.appointments);
  apptRef.current = st.data.appointments;
  useEffect(() => {
    if (!st.ready) return;
    const t = setTimeout(() => void syncAllReminders(apptRef.current), 400);
    return () => clearTimeout(t);
  }, [st.ready, apptKey]);

  // Toques nos widgets: guarda a ação e só a executa com o app desbloqueado.
  const [widgetAction, setWidgetAction] = useState<string | null>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    Widgets.consumeLaunchAction().then((r) => r.action && setWidgetAction(r.action)).catch(() => {});
    Widgets.addListener('widgetAction', (e) => setWidgetAction(e.action)).then((h) => (off = () => void h.remove())).catch(() => {});
    return () => off?.();
  }, []);
  useEffect(() => {
    if (!widgetAction || !st.ready || locked || !st.device.onboardingDone) return;
    const to = routeForWidgetAction(widgetAction);
    setWidgetAction(null);
    if (to) navigate(to);
  }, [widgetAction, st.ready, locked, st.device.onboardingDone]);

  // Grava pendências ao sair; bloqueia de novo após o tempo configurado.
  useEffect(() => {
    const offPause = onAppPause(() => {
      void store.flush();
      hiddenAt.current = Date.now();
    });
    const offResume = onAppResume(() => {
      const l = lockRef.current;
      if (l.enabled && hiddenAt.current !== null && Date.now() - hiddenAt.current >= l.timeoutSec * 1000) setLocked(true);
      hiddenAt.current = null;
    });
    const offBack = onBackButton(() => {
      if (closeTopOverlay()) return;
      if (canGoBack()) return goBack();
      if (route.path !== '/') return navigate('/', { replace: true });
      exitApp();
    });
    return () => {
      offPause();
      offResume();
      offBack();
    };
  }, [route.path]);

  if (!st.ready) return <div className="lock" aria-busy="true" />;
  if (locked && st.device.lock.enabled) return <LockScreen onUnlock={() => setLocked(false)} />;
  if (!st.device.onboardingDone) return <Onboarding />;

  return (
    <div className="app">
      <Suspense fallback={null}>
        <Screen key={screenKey} />
      </Suspense>
      <BottomNav />
      {message && (
        <div className="toast" role="status">
          <span>{message.text}</span>
          {message.action && (
            <button
              className="toast-action"
              onClick={() => {
                message.action!.run();
                dismissToast();
              }}
            >
              {message.action.label}
            </button>
          )}
        </div>
      )}
      <Dialog
        open={!!st.recoveryNotice}
        onClose={() => store.clearRecoveryNotice()}
        title="Recuperação de dados"
        actions={
          <button className="btn primary" onClick={() => store.clearRecoveryNotice()}>
            Entendi
          </button>
        }
      >
        {st.recoveryNotice}
      </Dialog>
    </div>
  );
}
