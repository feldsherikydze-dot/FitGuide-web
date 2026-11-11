"use strict";
// FitGuide Web — типы данных (порт с Android-версии)
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMP_PHASE = exports.MOV = exports.GENDER = exports.LEVEL = exports.PLACE = exports.STYLE = exports.ACTIVITY = exports.GOAL = void 0;
// --- Цели (Goals.java) ---
exports.GOAL = {
    LOSE: 'lose',
    MAINTAIN: 'maintain',
    GAIN: 'gain', // старый ключ → нормализуется в MASS
    STRENGTH: 'strength',
    MASS: 'mass',
    CUT: 'cut',
    ENDURANCE: 'endurance',
    RECOMP: 'recomp',
};
exports.ACTIVITY = {
    SEDENTARY: 'sedentary',
    LIGHT: 'light',
    MODERATE: 'moderate',
    HIGH: 'high',
    ATHLETE: 'athlete',
};
exports.STYLE = { ANY: 'any', BB: 'bb', PL: 'pl' };
exports.PLACE = { GYM: 'gym', HOME: 'home' };
exports.LEVEL = { BEGINNER: 'beginner', INTERMEDIATE: 'intermediate', ADVANCED: 'advanced' };
exports.GENDER = { MALE: 'male', FEMALE: 'female' };
/** Ключевые движения калибровки (AssessmentFormulas.MOV_*) */
exports.MOV = {
    SQUAT: 0,
    BENCH: 1,
    DEAD: 2,
    OHP: 3,
    ROW: 4,
    PULLUP: 5,
    LEGPRESS: 6,
    HIP: 7,
    COUNT: 8,
};
// --- Сезонный план ---
exports.COMP_PHASE = {
    OFFSEASON: 'offseason',
    BUILD: 'build',
    CUT: 'cut',
    PEAK: 'peak',
    DAY: 'day',
    RECOVERY: 'recovery',
};
