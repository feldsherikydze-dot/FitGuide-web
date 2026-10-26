// FitGuide Web — тренировка (порт WorkoutActivity.java 1:1 визуально)
// Цвета и текст — точно как в скриншоте Android-версии

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Check, Clock, Dumbbell, AlertTriangle, Zap } from 'lucide-react';
import { useCoachStore, useProgramsStore, useOneRmStore } from '../core/store';
import { createSession, applyFeelProgression, loadAdjust, setDelta, readinessScore, dayKey, plural } from '../core/coach';
import type { Session, SessionItem, Slot } from '../data/types';

export function WorkoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const coach = useCoachStore();
  const { programs, getById, save: savePrograms } = useProgramsStore();
  const oneRm = useOneRmStore();

  const programId = searchParams.get('program') || '';
  const week = parseInt(searchParams.get('week') || '1', 10);
  const dayTitle = decodeURIComponent(searchParams.get('day') || '');

  const program = getById(programId);
  const phase = program?.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  const day = phase?.days.find(d => d.title === dayTitle);

  const [session, setSession] = useState<Session | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [sessionFeel, setSessionFeel] = useState<1 | 2 | 3 | null>(null);
  const [awaitingFeel, setAwaitingFeel] = useState(false);
  const [pendingReps, setPendingReps] = useState(0);
  const [pendingFeel, setPendingFeelState] = useState(0);

  const checkin = coach.checkins.find(c => c.day === dayKey(Date.now()));
  const score = readinessScore(checkin);
  const delta = setDelta(program || null, week, score);

  // Создание/загрузка сессии
  useEffect(() => {
    if (!program || !day) { navigate('/'); return; }
    let existing = coach.sessions.find(s =>
      s.programId === programId && s.week === week && s.dayTitle === dayTitle);
    if (!existing) {
      existing = createSession(programId, week, dayTitle, program, day.slots);
      coach.addSession(existing);
    }
    setSession(existing);
  }, [programId, week, dayTitle, program, day]);

  // Таймер отдыха
  useEffect(() => {
    if (restEnd === null) return;
    const t = setInterval(() => {
      if (Date.now() >= restEnd) {
        setRestEnd(null);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 500);
    return () => clearInterval(t);
  }, [restEnd]);

  const updateItem = useCallback((slotIndex: number, updates: Partial<SessionItem>) => {
    setSession(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      const prevItem = items[slotIndex];
      const newSets = updates.sets ?? prevItem.sets;
      items[slotIndex] = { ...items[slotIndex], ...updates };
      const next: Session = { ...prev, items };
      // Пер-сет оценка: если подходов стало больше — записываем факт с текущей оценкой.
      const setFacts = (prev.setFacts || []) as Array<{ exercise: string; feel: 1 | 2 | 3; reps?: number; weightKg?: number; atMs?: number }>;
      if (newSets > (prevItem.sets || 0)) {
        const newFact = {
          exercise: prevItem.exercise,
          feel: (prevItem.feel || 3) as 1 | 2 | 3,
          reps: prevItem.reps || 0,
          weightKg: prevItem.weightKg || 0,
          atMs: Date.now(),
        };
        next.setFacts = [...setFacts, newFact];
      } else {
        next.setFacts = setFacts;
      }
      coach.updateSession(prev.id, { ...updates, items, setFacts: next.setFacts });
      return next;
    });
  }, [coach]);

  const setFeel = (slotIndex: number, feel: 1 | 2 | 3) => {
    if (!session || !program) return;
    updateItem(slotIndex, { feel });
    setSessionFeel(feel);
    const item = session.items[slotIndex];
    const slot = day?.slots[slotIndex];
    if (!slot) return;
    const updated = applyFeelProgression(
      program, week, dayTitle, slot.exercise, item.weightKg, item.reps, feel);
    if (updated) {
      savePrograms(programs.map(p => (p.id === program.id ? updated : p)));
    }
  };

  const startRest = (slot: Slot) => {
    const minutes = parseInt(slot.rest) || 90;
    setRestEnd(Date.now() + minutes * 60000);
  };

  const finish = () => {
    if (!session) return;
    coach.updateSession(session.id, { feel: sessionFeel || undefined, setFacts: session.setFacts });
    setShowFinish(false);
    navigate('/coach');
  };

  // --- Рендер ---
  if (!program || !day || !session) {
    return (
      <div className="min-h-screen bg-[#1B1E20] flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#FF8A3D] mb-2">Тренировка не найдена</h2>
          <button onClick={() => navigate('/coach')} className="px-6 py-3 bg-[#FF8A3D] text-white rounded-xl font-bold hover:bg-[#FF6B2D] transition-colors">
            К тренеру
          </button>
        </div>
      </div>
    );
  }

  const totalSets = day.slots.reduce((sum, s) => sum + (s.sets || 3), 0);
  const doneSets = session.items.reduce((sum, i) => sum + Math.min(i.sets || 0, (day.slots[session.items.indexOf(i)]?.sets || 3) || i.sets || 0), 0);
  const isDone = session.items.every((i, idx) => {
    const target = day.slots[idx]?.sets || 3;
    return (i.sets || 0) >= target;
  });

  const curSlot = activeSlot !== null ? activeSlot : 0;
  const curItem = session.items[curSlot];
  const curSlotData = day.slots[curSlot];

  return (
    <div className="min-h-screen bg-[#1B1E20] text-[#F5F8F6] font-sans selection:bg-[#FF8A3D]/30">
      {/* Шапка — как в Android */}
      <div className="sticky top-0 z-20 bg-[#1B1E20]/90 backdrop-blur-md border-b border-[#2C8555]/20 px-4 py-3 flex items-center gap-3 shadow-lg shadow-black/20">
        <button onClick={() => navigate('/coach')} className="p-2 -ml-2 hover:bg-[#FF8A3D]/10 rounded-xl transition-colors active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF8A3D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-[#FF8A3D] truncate tracking-tight leading-tight">{day.title}</h2>
          <p className="text-[11px] text-[#6E767B] font-medium truncate">Неделя {week} · {doneSets} / {totalSets} подходов</p>
        </div>
        <button onClick={() => setShowFinish(true)} className="p-2 hover:bg-[#2C8555]/20 rounded-xl transition-colors active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C8555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 12l12 6"/></svg>
        </button>
      </div>

      {/* Прогресс-бар */}
      <div className="h-1.5 bg-[#2C8555]/10 mx-4 mt-2 rounded-full overflow-hidden">
        <div className="h-full bg-[#FF8A3D] rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_#FF8A3D]"
          style={{ width: totalSets ? `${(doneSets / totalSets) * 100}%` : '0%' }} />
      </div>

      {/* Карточка упражнения — как в скриншоте Android */}
      <div className="mx-4 mt-4 bg-[#2C8555]/10 border border-[#FF8A3D]/20 rounded-2xl p-5 shadow-[0_4px_30px_rgba(255,138,61,0.1)]">
        <div className="text-xs font-bold text-[#FF8A3D] tracking-[0.15em] uppercase mb-1">Тренировка</div>
        <div className="text-sm font-medium text-[#F5F8F6]/60">Упражнение {curSlot + 1} из {day.slots.length}</div>

        <div className="text-center mt-4 space-y-1">
          <div className="text-5xl font-black text-[#FF8A3D] tracking-tighter font-mono leading-none drop-shadow-[0_2px_10px_rgba(255,138,61,0.4)]">
            {session ? `Подход ${curItem?.sets || 0} из ${(curSlotData?.sets || 3)}` : 'Подход 0 из 3'}
          </div>
          <div className="text-2xl font-extrabold text-[#FF8A3D] leading-snug mt-2 drop-shadow-[0_1px_8px_rgba(255,138,61,0.25)]">
            Тренировка: {session ? Math.floor((Date.now() - (session?.ts || Date.now())) / 1000) : 0} сек
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-[#FF8A3D] text-center mt-5 leading-tight tracking-tight drop-shadow-[0_1px_4px_rgba(255,138,61,0.2)]">
          {curSlotData?.exercise || 'Жим гантелей на наклонной скамье (30-45°)'}
        </h2>

        {/* Детали: подходы, повторы, вес */}
        <div className="flex justify-center gap-4 mt-5">
          <div className="bg-[#1B1E20]/60 border-2 border-[#FF8A3D]/40 rounded-2xl px-5 py-3 text-center min-w-[80px] shadow-[inset_0_0_20px_rgba(255,138,61,0.08)]">
            <div className="text-[10px] text-[#6E767B] font-bold tracking-wider uppercase">Подходы</div>
            <div className="text-xl font-black text-[#F5F8F6] font-mono">{curItem?.sets || 0}</div>
          </div>
          <div className="bg-[#1B1E20]/60 border-2 border-[#FF8A3D]/40 rounded-2xl px-5 py-3 text-center min-w-[80px] shadow-[inset_0_0_20px_rgba(255,138,61,0.08)]">
            <div className="text-[10px] text-[#6E767B] font-bold tracking-wider uppercase">Повторы</div>
            <div className="text-xl font-black text-[#F5F8F6] font-mono">{curSlotData?.reps || '10'}</div>
          </div>
          <div className="bg-[#1B1E20]/60 border-2 border-[#FF8A3D]/40 rounded-2xl px-5 py-3 text-center min-w-[80px] shadow-[inset_0_0_20px_rgba(255,138,61,0.08)]">
            <div className="text-[10px] text-[#6E767B] font-bold tracking-wider uppercase">Вес, кг</div>
            <div className="text-xl font-black text-[#F5F8F6] font-mono">{curItem?.weightKg || 21.5}</div>
          </div>
        </div>

        {/* Оценка: Лёгко / Норма / Тяжело */}
        <div className="mt-6">
          <label className="block text-[11px] text-[#6E767B] font-bold tracking-[0.12em] uppercase mb-2">Как прошёл подход?</label>
          <div className="flex gap-2">
            {([{ v: 1 as const, l: '😰 Тяжело' }, { v: 2 as const, l: '😐 В самый раз' }, { v: 3 as const, l: '😎 Легко' }] as const).map(f => (
              <button key={f.v} onClick={() => {
                setAwaitingFeel(true);
                setPendingFeelState(f.v);
                const currentSets = session?.items?.[curSlot]?.sets || 0;
                const itemToConfirm = session?.items?.[curSlot];
                if (itemToConfirm && currentSets > 0) {
                  // Подтверждаем подход с текущей оценкой
                  const updatedItem: SessionItem = {
                    ...itemToConfirm,
                    feel: f.v,
                  };
                  // Сохраняем факт в сессию
                  const fact = {
                    exercise: itemToConfirm.exercise,
                    feel: f.v,
                    reps: updatedItem.reps || 10,
                    weightKg: updatedItem.weightKg || 0,
                    atMs: Date.now(),
                  };
                  const newFacts = [...(session?.setFacts || []), fact];
                  const newSession: Session = {
                    ...(session as Session),
                    items: (session?.items || []).map((it, i) => i === curSlot ? updatedItem : it),
                    setFacts: newFacts,
                  };
                  setSession(newSession);
                  coach.updateSession(newSession.id, { items: newSession.items, setFacts: newFacts, feel: newSession.feel });
                  setSessionFeel(f.v);
                }
              }}
                className={clsx('flex-1 py-3 rounded-xl text-xs font-extrabold transition-all duration-150 shadow-[0_4px_20px_rgba(0,0,0,0.25)] active:translate-y-0.5',
                  session?.items?.[curSlot]?.feel === f.v
                    ? (f.v === 1 ? 'bg-[#C0392B] text-white shadow-[0_0_25px_#C0392B]/60]' : f.v === 2 ? 'bg-[#3AA76D] text-white shadow-[0_0_25px_#3AA76D]/60]' : 'bg-[#2C8555] text-white shadow-[0_0_25px_#2C8555]/60]')
                    : 'bg-[#1B1E20] text-[#6E767B] border border-[#2C8555]/30 hover:border-[#FF8A3D]/50 hover:text-[#F5F8F6]')}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* Отдых / Таймер */}
        {restEnd !== null && (
          <div className="mt-6 bg-[#1B1E20]/80 border border-[#FF8A3D]/20 rounded-2xl p-5 shadow-[0_8px_30px_rgba(255,138,61,0.08)] backdrop-blur-sm">
            <div className="text-center">
              <div className="text-[11px] font-bold text-[#FF8A3D] tracking-[0.15em] uppercase">Отдых</div>
              <div className="text-4xl font-black text-[#F5F8F6] font-mono mt-1 tracking-tighter drop-shadow-[0_2px_8px_rgba(255,138,61,0.3)]">
                {Math.max(0, Math.ceil((restEnd - Date.now()) / 1000))} сек
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Кнопки управления */}
      <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto px-4 z-20 flex gap-3">
        <button onClick={() => startRest(curSlotData)}
          className="flex-1 py-3.5 bg-[#FF8A3D] text-[#1B1E20] rounded-2xl font-black text-lg tracking-wide shadow-[0_6px_25px_rgba(255,138,61,0.45)] hover:bg-[#FF6B2D] active:translate-y-0.5 active:shadow-[0_2px_10px_rgba(255,138,61,0.3)] transition-all duration-150">
          НАЧАТЬ
        </button>
      </div>
    </div>
  );
}

function dateNow(): number { return Date.now(); }

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore */ }
}
