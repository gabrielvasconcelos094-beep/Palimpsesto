import { useEffect, useRef, useState } from 'react';
import { BarChart3, BookOpen, Compass, Map as MapIcon, Sun } from 'lucide-react';
import { closeTopOverlay } from './app/overlays';
import { canGoBack, goBack, navigate, useRoute } from './app/router';
import { store, useStoreState } from './app/store';
import { useApplyTheme } from './app/theme';
import { useToast } from './app/toast';
import { exitApp, onAppPause, onAppResume, onBackButton } from './platform/lifecycle';
import { setPrivacyScreen } from './platform/native';
import { Today } from './features/today/Today';
import { Journal } from './features/journal/Journal';
import { ExperienceEditor } from './features/journal/ExperienceEditor';
import { EventPage } from './features/journal/EventEditor';
import { SearchPage } from './features/search/SearchPage';
import { MapHome, QuestionPage, SectionPage } from './features/map/MapPages';
import { DiscoveryPage } from './features/map/Discoveries';
import { GuideHome } from './features/guide/GuideHome';
import { ItemPage } from './features/guide/Repertoire';
import { SituationPage } from './features/guide/Situations';
import { LetterPage } from './features/guide/Letters';
import { Trajectory } from './features/trajectory/Trajectory';
import { TrajectoryCategory } from './features/trajectory/categories';
import { AboutPage, EmotionsPage, IndicatorsPage, ScalePage, SettingsHome } from './features/settings/Settings';
import { ThemeEditorPage, ThemesPage } from './features/settings/Themes';
import { DataPage } from './features/settings/DataPage';
import { LockScreen, PrivacyPage } from './features/settings/Privacy';
import { Onboarding } from './features/onboarding/Onboarding';
import { Dialog } from './ui/components';

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
      <Screen key={screenKey} />
      <BottomNav />
      {message && (
        <div className="toast" role="status">
          {message}
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
