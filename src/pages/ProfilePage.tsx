// FitGuide Web — профиль (порт ProfileActivity.java 1:1)
//
// Структура как в activity_profile.xml + ProfileActivity.java:
// 1. TopBar (стрелка назад + заголовок "Профиль" цветом D)
// 2. ScrollView → 3 карточки MaterialCardView + кнопка "Сохранить"
// Карточка 1: "Профиль" — имя, пол (чипы), возраст/рост/вес, активность (чипы),
//   цель (чипы мульти), стиль (чипы), уровень (чипы), %жира/тренировок в неделю
// Карточка 2: "О себе" — био (многострочное), страна/город
// Карточка 3: "Сохранённые профили" — список + кнопка "Очистить всё" (OutlinedButton)
// Кнопка "Сохранить" — filled, colorPrimary, 26dp radius, bold

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronLeft, Save, Trash2, MapPin } from 'lucide-react';
import { PageHeader, usePaletteVars } from '../components/ui';
import { useProfileStore, useCoachStore, useProgramsStore } from '../core/store';
import { GOALS, GOALS_ALL, GOAL_LABELS, GOAL_DESCRIPTIONS, recommendDays, recommendPerWeek, caloriesFor, proteinPerKg, fatsPerKg } from '../core/goals';
import { COMP_PHASE_ORDER, COMP_PHASE_LABELS, stageWeightKg, offseasonWeightKg } from '../core/seasonPlan';
import type { UserProfile } from '../data/types';
import { slotColor, contrastOn, withAlpha } from '../core/palette';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Сидячий', factor: 1.2 },
  { value: 'light', label: 'Лёгкий', factor: 1.375 },
  { value: 'moderate', label: 'Умеренный', factor: 1.55 },
  { value: 'high', label: 'Высокий', factor: 1.725 },
  { value: 'athlete', label: 'Спортсмен', factor: 1.9 },
];

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];

const STYLES = [
  { value: 'any', label: 'Любое' },
  { value: 'bb', label: 'Бодибилдинг' },
  { value: 'pl', label: 'Пауэрлифтинг' },
];

const PLACES = [
  { value: 'gym', label: 'Зал' },
  { value: 'home', label: 'Дом' },
];

const EQUIPMENT = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'cable', label: 'Блоки' },
  { id: 'smith', label: 'Смит' },
  { id: 'machine', label: 'Тренажёры' },
];

const CATEGORIES = [
  { id: '60', label: 'До 60 кг' },
  { id: '70', label: 'До 70 кг' },
  { id: '80', label: 'До 80 кг' },
  { id: '90', label: 'До 90 кг' },
  { id: '100', label: 'До 100 кг' },
  { id: '110+', label: '110+ кг' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '', gender: 'male', age: 0, heightCm: 0, weightKg: 0,
  activityLevel: 'moderate', goal: GOALS.MASS, trainStyle: 'any',
  bodyFatPercent: 0, workoutsPerWeek: 0, bio: '', country: '', city: '',
  level: 'intermediate', equipment: [], place: 'gym',
};

function ChipFactoryStyle(checked: boolean) {
  const outline = slotColor('outline');
  const circle = slotColor('circleIcons');
  const labels = slotColor('labelsButtons');
  const labelsText = slotColor('labelsText');
  const onCircle = contrastOn(circle);
  const onLabels = contrastOn(labels);
  const onSurface = contrastOn('#FFFFFF'); // surface в светлой теме = white
  // Android ChipFactory: checked → bg=colorPrimary (C), text=white; unchecked → bg=surface, text=appTextHeader (D)
  // В вебе: checked → C + onCircle; unchecked → B (labelsButtons как surface в диалогах) + onLabels (D)
  return {
    background: checked ? circle : labels,
    color: checked ? onCircle : labelsText,
    borderColor: checked ? circle : outline,
  };
}

function InputFieldStyle(focused: boolean) {
  const outline = slotColor('outline');
  const surfaceVariant = '#EDF4EF'; // colorSurfaceVariant light
  const primary = '#3AA76D'; // colorPrimary
  return {
    background: surfaceVariant,
    borderColor: focused ? primary : outline,
    borderWidth: focused ? 2 : 1,
  };
}

export function ProfilePage() {
  const navigate = useNavigate();
  usePaletteVars();
  const { profile, setProfile, clearProfile } = useProfileStore();
  const coach = useCoachStore();
  const { programs, remove } = useProgramsStore();

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<UserProfile>(profile || DEFAULT_PROFILE);
  const [showDelete, setShowDelete] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [selectedGoalChips, setSelectedGoalChips] = useState<string[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<Array<{profile: UserProfile, index: number}>>([]);

  useEffect(() => {
    if (profile) {
      setForm(profile);
      // Инициализируем выбранные цели
      const goals = form.goal.split(',').filter(Boolean);
      setSelectedGoalChips(goals.length ? goals : [GOALS.MASS]);
    }
    // Загружаем сохранённые профили из localStorage (аналог ProfileStore.loadAll)
    loadSavedProfiles();
  }, [profile]);

  const loadSavedProfiles = () => {
    try {
      const raw = localStorage.getItem('fitguide_web_profile_history');
      if (raw) {
        const arr = JSON.parse(raw);
        setSavedProfiles(arr.map((p: UserProfile, i: number) => ({ profile: p, index: i })));
      }
    } catch { }
  };

  const saveProfileToHistory = (p: UserProfile) => {
    try {
      const raw = localStorage.getItem('fitguide_web_profile_history');
      const arr: UserProfile[] = raw ? JSON.parse(raw) : [];
      // Удаляем дубликат по имени
      const filtered = arr.filter(x => x.name !== p.name);
      const next = [p, ...filtered].slice(0, 10);
      localStorage.setItem('fitguide_web_profile_history', JSON.stringify(next));
      loadSavedProfiles();
    } catch { }
  };

  const removeProfileFromHistory = (index: number) => {
    try {
      const raw = localStorage.getItem('fitguide_web_profile_history');
      const arr: UserProfile[] = raw ? JSON.parse(raw) : [];
      arr.splice(index, 1);
      localStorage.setItem('fitguide_web_profile_history', JSON.stringify(arr));
      loadSavedProfiles();
    } catch { }
  };

  const clearProfileHistory = () => {
    localStorage.removeItem('fitguide_web_profile_history');
    loadSavedProfiles();
  };

  const setField = useCallback(<K extends keyof UserProfile>(k: K, v: UserProfile[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  const setNumberField = useCallback(<K extends keyof UserProfile>(k: K, v: string) => {
    const n = v === '' ? 0 : parseFloat(v.replace(',', '.'));
    setForm(f => ({ ...f, [k]: isNaN(n) ? 0 : n } as UserProfile));
  }, []);

  const toggleGoalChip = (goal: string) => {
    setSelectedGoalChips(prev => {
      const next = prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal];
      // Несовместимые цели (mass + cut) — оставляем ведущую
      const primary = next[0];
      const compatible = next.filter(g => g === primary || (GOALS[primary as keyof typeof GOALS] && GOALS[g as keyof typeof GOALS] !== undefined));
      // Простая проверка: mass и cut несовместимы
      if (next.includes(GOALS.MASS) && next.includes(GOALS.CUT)) {
        return [GOALS.MASS];
      }
      return next.length ? next : [GOALS.MASS];
    });
  };

  const loadSavedProfile = (p: UserProfile) => {
    setForm(p);
    const goals = p.goal.split(',').filter(Boolean);
    setSelectedGoalChips(goals.length ? goals : [GOALS.MASS]);
  };

  const bmr = form.age && form.heightCm && form.weightKg
    ? Math.round(10 * form.weightKg + 6.25 * form.heightCm - 5 * form.age + (form.gender === 'male' ? 5 : -161))
    : 0;
  const activityFactor = ACTIVITY_LEVELS.find(a => a.value === form.activityLevel)?.factor || 1.2;
  const tdee = bmr ? Math.round(bmr * activityFactor) : 0;
  const calories = caloriesFor(tdee, form.goal, form.gender);
  const protein = Math.round(form.weightKg * proteinPerKg(form.goal));
  const fats = Math.round(form.weightKg * fatsPerKg(form.goal));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));
  const bmi = form.heightCm && form.weightKg ? (form.weightKg / Math.pow(form.heightCm / 100, 2)).toFixed(1) : '—';

  const save = () => {
    const goalStr = selectedGoalChips.join(',') || GOALS.MASS;
    const toSave: UserProfile = { ...form, goal: goalStr };
    setProfile(toSave);
    saveProfileToHistory(toSave);
    setEdit(false);
  };

  const doDelete = () => {
    if (!confirm('Удалить профиль и все данные? Действие необратимо.')) return;
    clearProfile();
    coach.resetCoach();
    programs.forEach(p => remove(p.id));
    setShowDelete(false);
    navigate('/');
  };

  const outline = slotColor('outline');
  const labels = slotColor('labelsButtons');
  const circle = slotColor('circleIcons');
  const labelsText = slotColor('labelsText');
  const textMain = '#1B1E20';
  const textSecondary = '#6E767B';
  const warning = '#C0392B';
  const primary = '#3AA76D';

  const cardStyle = {
    background: labels,
    border: `1px solid ${outline}`,
    borderRadius: '18px',
  };

  const cardHeaderStyle = { color: textMain, fontWeight: 700, fontSize: '16px', fontFamily: 'Roboto, sans-serif' };
  const cardDescStyle = { color: textSecondary, fontSize: '13px', marginTop: '4px' };
  const labelStyle = { color: textSecondary, fontWeight: 700, fontSize: '13px' };
  const optionalStyle = { color: warning, fontWeight: 700, fontSize: '13px', marginLeft: '3px' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <PageHeader
        title="Профиль"
        onBack={() => navigate('/')}
      />

      <div className="max-w-2xl mx-auto space-y-5 w-full max-w-full pb-20 px-4">
        {/* Карточка 1: Профиль */}
        <div style={cardStyle} className="p-5">
          <div style={cardHeaderStyle}>Профиль</div>
          <div style={cardDescStyle}>Заполни анкету. Обязательные поля — для расчёта калорий и прогрессии.</div>
          <div style={{ ...cardDescStyle, marginTop: '10px', fontSize: '12px' }}>* — необязательные поля</div>

          {/* Имя */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', marginTop: '16px' }}>
            <label style={labelStyle}>Имя</label>
            <span style={optionalStyle}>*</span>
          </div>
          <input
            type="text"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="Как к тебе обращаться"
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            style={{
              width: '100%', marginTop: '6px', padding: '12px 16px',
              fontSize: '15px', color: textMain,
              background: InputFieldStyle(focusedField === 'name').background,
              border: `${InputFieldStyle(focusedField === 'name').borderWidth}px solid ${InputFieldStyle(focusedField === 'name').borderColor}`,
              borderRadius: '14px', outline: 'none',
            }}
          />

          {/* Пол — чипы singleSelection */}
          <label style={{ ...labelStyle, marginTop: '16px', display: 'block' }}>Пол</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {['male', 'female'].map(g => {
              const checked = form.gender === g;
              const s = ChipFactoryStyle(checked);
              return (
                <button
                  key={g}
                  onClick={() => setField('gender', g as 'male' | 'female')}
                  style={{
                    minHeight: '32px', padding: '0 12px', borderRadius: '8px',
                    border: `1px solid ${s.borderColor}`, background: s.background, color: s.color,
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {g === 'male' ? 'Мужской' : 'Женский'}
                </button>
              );
            })}
          </div>

          {/* Возраст / Рост / Вес — три колонки */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {[
              { key: 'age', label: 'Возраст', placeholder: '25' },
              { key: 'heightCm', label: 'Рост, см', placeholder: '180' },
              { key: 'weightKg', label: 'Вес, кг', placeholder: '80', step: '0.1' },
            ].map(f => (
              <div key={f.key} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type="number"
                  step={f.step}
                  value={form[f.key as keyof UserProfile] === 0 ? '' : form[f.key as keyof UserProfile]}
                  onChange={e => setNumberField(f.key as keyof UserProfile, e.target.value)}
                  placeholder={f.placeholder}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    marginTop: '6px', padding: '12px 16px', fontSize: '15px', color: textMain,
                    background: InputFieldStyle(focusedField === f.key).background,
                    border: `${InputFieldStyle(focusedField === f.key).borderWidth}px solid ${InputFieldStyle(focusedField === f.key).borderColor}`,
                    borderRadius: '14px', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Активность — чипы singleSelection */}
          <label style={{ ...labelStyle, marginTop: '16px', display: 'block' }}>Активность</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {ACTIVITY_LEVELS.map(a => {
              const checked = form.activityLevel === a.value;
              const s = ChipFactoryStyle(checked);
              return (
                <button
                  key={a.value}
                  onClick={() => setField('activityLevel', a.value as typeof a.value)}
                  style={{
                    minHeight: '32px', padding: '0 12px', borderRadius: '8px',
                    border: `1px solid ${s.borderColor}`, background: s.background, color: s.color,
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* Цель — чипы multiSelection */}
          <label style={{ ...labelStyle, marginTop: '16px', display: 'block' }}>Цель</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {GOALS_ALL.map(g => {
              const checked = selectedGoalChips.includes(g);
              const s = ChipFactoryStyle(checked);
              return (
                <button
                  key={g}
                  onClick={() => toggleGoalChip(g)}
                  style={{
                    minHeight: '32px', padding: '0 12px', borderRadius: '8px',
                    border: `1px solid ${s.borderColor}`, background: s.background, color: s.color,
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {GOAL_LABELS[g]}
                </button>
              );
            })}
          </div>

          {/* Стиль тренировок — чипы singleSelection */}
          <label style={{ ...labelStyle, marginTop: '16px', display: 'block' }}>Направление</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {STYLES.map(s => {
              const checked = form.trainStyle === s.value;
              const cs = ChipFactoryStyle(checked);
              return (
                <button
                  key={s.value}
                  onClick={() => setField('trainStyle', s.value as typeof s.value)}
                  style={{
                    minHeight: '32px', padding: '0 12px', borderRadius: '8px',
                    border: `1px solid ${cs.borderColor}`, background: cs.background, color: cs.color,
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Уровень — чипы singleSelection */}
          <label style={{ ...labelStyle, marginTop: '16px', display: 'block' }}>Уровень</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {LEVELS.map(l => {
              const checked = form.level === l.value;
              const cs = ChipFactoryStyle(checked);
              return (
                <button
                  key={l.value}
                  onClick={() => setField('level', l.value as typeof l.value)}
                  style={{
                    minHeight: '32px', padding: '0 12px', borderRadius: '8px',
                    border: `1px solid ${cs.borderColor}`, background: cs.background, color: cs.color,
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* % жира / тренировок в неделю — две колонки */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {[
              { key: 'bodyFatPercent', label: '% жира', placeholder: '18', step: '0.1' },
              { key: 'workoutsPerWeek', label: 'Тренировок в нед.', placeholder: '4' },
            ].map(f => (
              <div key={f.key} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
                  <label style={labelStyle}>{f.label}</label>
                  <span style={optionalStyle}>*</span>
                </div>
                <input
                  type="number"
                  step={f.step}
                  value={form[f.key as keyof UserProfile] === 0 ? '' : form[f.key as keyof UserProfile]}
                  onChange={e => setNumberField(f.key as keyof UserProfile, e.target.value)}
                  placeholder={f.placeholder}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    marginTop: '6px', padding: '12px 16px', fontSize: '15px', color: textMain,
                    background: InputFieldStyle(focusedField === f.key).background,
                    border: `${InputFieldStyle(focusedField === f.key).borderWidth}px solid ${InputFieldStyle(focusedField === f.key).borderColor}`,
                    borderRadius: '14px', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Карточка 2: О себе */}
        <div style={cardStyle} className="p-5 mt-4">
          <div style={cardHeaderStyle}>О себе</div>
          <div style={cardDescStyle}>Коротко о себе, страна и город — для статистики и поиска напарников.</div>

          {/* Био — многострочное */}
          <label style={{ ...labelStyle, marginTop: '16px', display: 'block' }}>О себе</label>
          <textarea
            value={form.bio}
            onChange={e => setField('bio', e.target.value)}
            placeholder="Расскажи о себе..."
            rows={3}
            onFocus={() => setFocusedField('bio')}
            onBlur={() => setFocusedField(null)}
            style={{
              width: '100%', marginTop: '6px', padding: '12px 16px', fontSize: '15px', color: textMain,
              fontFamily: 'inherit', resize: 'vertical',
              background: InputFieldStyle(focusedField === 'bio').background,
              border: `${InputFieldStyle(focusedField === 'bio').borderWidth}px solid ${InputFieldStyle(focusedField === 'bio').borderColor}`,
              borderRadius: '14px', outline: 'none',
            }}
          />

          {/* Страна / Город — две колонки */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {[
              { key: 'country', label: 'Страна', placeholder: 'Россия' },
              { key: 'city', label: 'Город', placeholder: 'Красноярск' },
            ].map(f => (
              <div key={f.key} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type="text"
                  value={form[f.key as keyof UserProfile]}
                  onChange={e => setField(f.key as keyof UserProfile, e.target.value)}
                  placeholder={f.placeholder}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    marginTop: '6px', padding: '12px 16px', fontSize: '15px', color: textMain,
                    background: InputFieldStyle(focusedField === f.key).background,
                    border: `${InputFieldStyle(focusedField === f.key).borderWidth}px solid ${InputFieldStyle(focusedField === f.key).borderColor}`,
                    borderRadius: '14px', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Карточка 3: Сохранённые профили */}
        <div style={cardStyle} className="p-5 mt-4">
          <div style={cardHeaderStyle}>Сохранённые профили</div>
          <div style={cardDescStyle}>Сохранённые анкеты. Выбери — загрузится в форму.</div>

          {savedProfiles.length === 0 ? (
            <div style={{ marginTop: '12px', textAlign: 'center', color: textSecondary, fontSize: '13px' }}>
              Сохранённых профилей нет.<br/>Нажми «Сохранить» — текущий профиль добавится в историю.
            </div>
          ) : (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedProfiles.map(({ profile: p, index }) => (
                <div
                  key={index}
                  onClick={() => loadSavedProfile(p)}
                  style={{
                    padding: '12px 16px', background: '#FFFFFF', border: `1px solid ${outline}`,
                    borderRadius: '12px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: textMain }}>
                      {p.name || 'Без имени'}
                    </div>
                    <div style={{ fontSize: '12px', color: textSecondary, marginTop: '2px' }}>
                      {p.gender === 'female' ? 'Женский' : p.gender === 'male' ? 'Мужской' : '—'}
                      {p.age > 0 ? `, ${p.age} лет` : ''}
                      {p.heightCm > 0 ? `, ${p.heightCm} см` : ''}
                      {p.weightKg > 0 ? `, ${p.weightKg} кг` : ''}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeProfileFromHistory(index); }}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'transparent', border: `1px solid ${outline}`,
                      color: textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Кнопка "Очистить всё" — OutlinedButton */}
          {savedProfiles.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Удалить все сохранённые профили?')) clearProfileHistory();
              }}
              style={{
                marginTop: '16px', width: '100%', height: '48px', borderRadius: '24px',
                background: 'transparent', border: `1px solid ${outline}`,
                color: warning, fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Очистить всё
            </button>
          )}
        </div>

        {/* Кнопка "Сохранить" — filled, colorPrimary, 26dp radius, bold */}
        <button
          onClick={save}
          disabled={edit === false}
          style={{
            marginTop: '8px', width: '100%', height: '52px', borderRadius: '26px',
            background: primary, color: '#FFFFFF', fontSize: '16px', fontWeight: 700,
            border: 'none', cursor: edit ? 'pointer' : 'not-allowed', opacity: edit ? 1 : 0.5,
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}