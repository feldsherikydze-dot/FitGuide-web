import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SplashPage } from './pages/SplashPage';
import { HubPage } from './pages/HubPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CoachPage } from './pages/CoachPage';
import { ProgramsPage, ProgramDetailPage } from './pages/ProgramsPage';
import { ProgramHubPage } from './pages/ProgramHubPage';
import { MyProgramsPage } from './pages/MyProgramsPage';
import { ProgramGeneratorPage } from './pages/ProgramGeneratorPage';
import { LegendsPage } from './pages/LegendsPage';
import { CustomProgramPage } from './pages/CustomProgramPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ProgressHubPage } from './pages/ProgressHubPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { DiaryPage } from './pages/DiaryPage';
import { NutritionHubPage } from './pages/NutritionHubPage';
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
        <Route path="/programs" element={<ProgramHubPage />} />
        <Route path="/programs/mine" element={<MyProgramsPage />} />
        <Route path="/programs/new" element={<ProgramGeneratorPage />} />
        <Route path="/programs/legends" element={<LegendsPage />} />
        <Route path="/programs/custom" element={<CustomProgramPage />} />
        <Route path="/programs/:id" element={<ProgramDetailPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/progress" element={<ProgressHubPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/nutrition" element={<NutritionHubPage />} />
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
  const { profile } = useProfileStore();
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

  return (
    <>
      <AppRoutes />
      {splashEnabled && !splashDone && (
        <SplashPage
          onStart={() => {
            setSplashDone(true);
            navigate(profile ? '/' : '/onboarding', { replace: true });
          }}
        />
      )}
    </>
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
