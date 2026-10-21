import { useState } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SplashPage } from './pages/SplashPage';
import { HubPage } from './pages/HubPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CoachPage } from './pages/CoachPage';
import { ProgramsPage, ProgramDetailPage } from './pages/ProgramsPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ProgressPage } from './pages/ProgressPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { DiaryPage } from './pages/DiaryPage';
import { NutritionPage } from './pages/NutritionPage';
import { KnowledgePage, KnowledgeDetailPage } from './pages/KnowledgePage';
import { SearchPage } from './pages/SearchPage';
import { TimerPage } from './pages/TimerPage';
import { MusicPage } from './pages/MusicPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { useProfileStore } from './core/store';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HubPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/programs/:id" element={<ProgramDetailPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
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

  return (
    <>
      <AppRoutes />
      {!splashDone && (
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
