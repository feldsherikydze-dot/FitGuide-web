import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SplashPage } from './pages/SplashPage';
import { HubPage } from './pages/HubPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CoachPage } from './pages/CoachPage';
import { CoachOnboardingPage } from './pages/CoachOnboardingPage';
import { ProgramsPage, ProgramDetailPage } from './pages/ProgramsPage';
import { ProgramHubPage } from './pages/ProgramHubPage';
import { MyProgramsPage } from './pages/MyProgramsPage';
import { ProgramGeneratorPage } from './pages/ProgramGeneratorPage';
import { LegendsPage } from './pages/LegendsPage';
import { CustomProgramPage } from './pages/CustomProgramPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ProgressHubPage } from './pages/ProgressHubPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { MuscleGroupPage } from './pages/MuscleGroupPage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { DiaryPage } from './pages/DiaryPage';
import { NutritionHubPage } from './pages/NutritionHubPage';
import { SportPitDetailPage } from './pages/SportPitDetailPage';
import { KnowledgePage, KnowledgeDetailPage } from './pages/KnowledgePage';
import { SearchPage } from './pages/SearchPage';
import { TimerPage } from './pages/TimerPage';
import { MusicPage } from './pages/MusicPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { useProfileStore } from './core/store';
import { getJSON, KEYS } from './core/storage';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HubPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/coach/onboarding" element={<CoachOnboardingPage />} />
        <Route path="/programs" element={<ProgramHubPage />} />
        <Route path="/programs/mine" element={<MyProgramsPage />} />
        <Route path="/programs/new" element={<ProgramGeneratorPage />} />
        <Route path="/programs/legends" element={<LegendsPage />} />
        <Route path="/programs/custom" element={<CustomProgramPage />} />
        <Route path="/programs/:id" element={<ProgramDetailPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/progress" element={<ProgressHubPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/selection" element={<MuscleGroupPage />} />
        <Route path="/exercises/:groupId" element={<MuscleGroupPage />} />
        <Route path="/exercise/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/nutrition" element={<NutritionHubPage />} />
        <Route path="/sportpit/:key" element={<SportPitDetailPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/:number" element={<KnowledgeDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/timer" element={<TimerPage />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

/**
 * Стартовый экран показывается при каждом запуске приложения — как в Android
 * (SplashActivity → MainActivity). Нажатие «Старт» убирает его и открывает
 * главный экран; если профиля ещё нет — экран знакомства.
 */
function Shell() {
  const navigate = useNavigate();
  const [splashDone, setSplashDone] = useState(false);
  // Настройка «стартовый экран» — как в Android (splash_enabled).
  // Выключается в Настройках.
  const [splashEnabled, setSplashEnabled] = useState(
    () => getJSON<boolean>(KEYS.SPLASH_ENABLED, true)
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.SPLASH_ENABLED) {
        setSplashEnabled(e.newValue !== 'false');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Определяем начальный маршрут ДО рендера приложения
  const determineInitialRoute = () => {
    const onboardingDone = getJSON<boolean>('onboarding_done', false);
    const { profile } = useProfileStore.getState();
    const hasRequired = profile?.gender && profile?.age > 0 && profile?.heightCm > 0 && profile?.weightKg > 0;
    const fresh = !onboardingDone && !hasRequired;
    if (fresh) return '/onboarding';
    if (!splashEnabled) return '/settings';
    return '/';
  };

  // Если сплеш отключён или уже пройден — рендерим приложение сразу
  if (!splashEnabled || splashDone) {
    return <AppRoutes />;
  }

  // Иначе рендерим ТОЛЬКО SplashPage; после «Старт» переходим на нужный маршрут
  return (
    <SplashPage
      onDone={() => {
        navigate(determineInitialRoute(), { replace: true });
        setSplashDone(true);
      }}
    />
  );
}

function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

export default App;
