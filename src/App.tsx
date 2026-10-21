import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CoachPage } from './pages/CoachPage';
import { ProgramsPage, ProgramDetailPage } from './pages/ProgramsPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ProgressPage } from './pages/ProgressPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { DiaryPage } from './pages/DiaryPage';
import { NutritionPage } from './pages/NutritionPage';
import { KnowledgePage, KnowledgeDetailPage } from './pages/KnowledgePage';
import { TimerPage } from './pages/TimerPage';
import { MusicPage } from './pages/MusicPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { useUIStore } from './core/store';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<CoachPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="programs/:id" element={<ProgramDetailPage />} />
        <Route path="workout" element={<WorkoutPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="exercises" element={<ExercisesPage />} />
        <Route path="assessment" element={<AssessmentPage />} />
        <Route path="diary" element={<DiaryPage />} />
        <Route path="nutrition" element={<NutritionPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="knowledge/:number" element={<KnowledgeDetailPage />} />
        <Route path="timer" element={<TimerPage />} />
        <Route path="music" element={<MusicPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  const { theme } = useUIStore();

  // Apply theme on mount
  const root = document.documentElement;
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  }

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}

export default App;
