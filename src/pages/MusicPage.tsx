// FitGuide Web — страница музыки

import { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music, Radio, Headphones, Heart, Plus, Search, Shuffle, Repeat, Mic, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '../core/store';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  source: 'local' | 'radio' | 'online';
  url?: string;
  artwork?: string;
  liked?: boolean;
}

const RADIO_STATIONS = [
  { id: 'radio1', name: 'Energy FM', genre: 'Electronic / Dance', url: 'https://stream.energyfm.ru/energy_128.mp3' },
  { id: 'radio2', name: 'Rock FM', genre: 'Rock / Metal', url: 'https://stream.rockfm.ru/rock_128.mp3' },
  { id: 'radio3', name: 'Hip-Hop FM', genre: 'Hip-Hop / Rap', url: 'https://stream.hiphop.ru/hiphop_128.mp3' },
  { id: 'radio4', name: 'Workout Mix', genre: 'Motivation / Fitness', url: 'https://stream.workoutmix.com/workout_128.mp3' },
] as const;

const MOCK_LOCAL_TRACKS: Track[] = [
  { id: '1', title: 'Power Up', artist: 'FitBeats', duration: 180, source: 'local', artwork: 'https://picsum.photos/seed/power/300', liked: true },
  { id: '2', title: 'Iron Will', artist: 'GymSound', duration: 210, source: 'local', artwork: 'https://picsum.photos/seed/iron/300' },
  { id: '3', title: 'Beast Mode', artist: 'LiftMusic', duration: 195, source: 'local', artwork: 'https://picsum.photos/seed/beast/300', liked: true },
  { id: '4', title: 'No Pain No Gain', artist: 'WorkoutWave', duration: 240, source: 'local', artwork: 'https://picsum.photos/seed/pain/300' },
];

export function MusicPage() {
  const { theme } = useUIStore();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [showQueue, setShowQueue] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'radio' | 'online'>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    setAudioRef(audio);
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Load track
  useEffect(() => {
    if (!audioRef || !currentTrack) return;
    audioRef.src = currentTrack.url || '';
    audioRef.load();
    if (isPlaying) audioRef.play().catch(() => setIsPlaying(false));
    setProgress(0);
  }, [currentTrack, audioRef]);

  // Progress update
  useEffect(() => {
    if (!audioRef) return;
    const updateProgress = () => {
      if (audioRef.duration) {
        setProgress(audioRef.currentTime / audioRef.duration);
      }
    };
    audioRef.addEventListener('timeupdate', updateProgress);
    audioRef.addEventListener('ended', () => {
      if (repeat) {
        audioRef.currentTime = 0;
        audioRef.play();
      } else {
        setIsPlaying(false);
        // Auto next
      }
    });
    return () => audioRef.removeEventListener('timeupdate', updateProgress);
  }, [audioRef, repeat]);

  const togglePlay = () => {
    if (!audioRef || !currentTrack) return;
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const nextTrack = () => {
    // Simple next logic
  };

  const prevTrack = () => {
    // Simple prev logic
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const filteredLocal = MOCK_LOCAL_TRACKS.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Музыка</h1>
          <p className="text-slate-500 dark:text-slate-400">Твои треки, радио и тренировочные подборки</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-1 flex">
        {[
          { id: 'local', label: 'Моя музыка', icon: Music },
          { id: 'radio', label: 'Радио', icon: Radio },
          { id: 'online', label: 'Онлайн', icon: Headphones },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
              activeTab === tab.id ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
        {activeTab === 'local' && (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-dark-border flex items-center gap-3">
              <input
                type="text"
                placeholder="Поиск в моей музыке..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
              />
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border" title="Перемешать">
                <Shuffle className={clsx('w-5 h-5', shuffle && 'text-primary-600')} />
              </button>
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border" title="Повтор">
                <Repeat className={clsx('w-5 h-5', repeat && 'text-primary-600')} />
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-dark-border">
              {filteredLocal.map(track => (
                <button
                  key={track.id}
                  onClick={() => playTrack(track)}
                  className={clsx(
                    'w-full p-4 flex items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-dark-border/50 transition-colors',
                    currentTrack?.id === track.id && 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                  )}
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-dark-border flex items-center justify-center flex-shrink-0 relative">
                    {track.artwork && (
                      <img src={track.artwork} alt="" className="w-full h-full rounded-lg object-cover" />
                    )}
                    {currentTrack?.id === track.id && isPlaying && (
                      <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                        <Pause className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {currentTrack?.id !== track.id && (
                      <Play className="w-6 h-6 text-slate-400 absolute inset-0 flex items-center justify-center" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900 dark:text-white truncate">{track.title}</h4>
                      {track.liked && <Heart className="w-4 h-4 text-red-500 fill-current" />}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{track.artist}</p>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 font-mono w-20 text-right">
                    {formatTime(track.duration)}
                  </div>
                </button>
              ))}
              {filteredLocal.length === 0 && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Музыка не найдена. Добавь файлы через настройки.</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'radio' && (
          <div className="divide-y divide-slate-200 dark:divide-dark-border">
            {RADIO_STATIONS.map(station => {
              const track: Track = {
                id: station.id,
                title: station.name,
                artist: station.genre,
                duration: 0,
                source: 'radio',
                url: station.url,
              };
              return (
                <button
                  key={station.id}
                  onClick={() => playTrack(track)}
                  className={clsx(
                    'w-full p-4 flex items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-dark-border/50 transition-colors',
                    currentTrack?.id === station.id && 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                  )}
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 dark:text-white truncate">{station.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{station.genre}</p>
                  </div>
                  {currentTrack?.id === station.id ? (
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      <span className="text-xs">LIVE</span>
                    </div>
                  ) : (
                    <Play className="w-8 h-8 text-slate-300 dark:text-slate-600 hover:text-primary-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'online' && (
          <div className="p-8 text-center">
            <Mic className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Онлайн-поиск</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Интеграция с YouTube Music, SoundCloud, VK Music требует API ключей.
              Настрой их в разделе «Настройки» → «Музыка».
            </p>
            <div className="flex items-center justify-center gap-3">
              <input
                type="text"
                placeholder="Поиск треков..."
                className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white w-64"
              />
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Search className="w-4 h-4 inline mr-1" />
                Найти
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Now Playing Bar */}
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-dark-card border-t border-slate-200 dark:border-dark-border shadow-xl">
          <div className="max-w-4xl mx-auto p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-dark-border flex items-center justify-center flex-shrink-0 relative">
                  {currentTrack.artwork && (
                    <img src={currentTrack.artwork} alt="" className="w-full h-full rounded-lg object-cover" />
                  )}
                  {currentTrack.source === 'radio' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                      <Radio className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-slate-900 dark:text-white truncate">{currentTrack.title}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="flex items-center gap-4">
                  <button onClick={prevTrack} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50" disabled={!currentTrack}>
                    <SkipBack className="w-6 h-6" />
                  </button>
                  <button onClick={togglePlay} className="p-3 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-50" disabled={!currentTrack}>
                    <SkipForward className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono w-10 text-right">{formatTime(currentTrack.source === 'radio' ? 0 : audioRef?.currentTime || 0)}</span>
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-dark-border rounded-full cursor-pointer relative" onClick={e => {
                    if (!audioRef || !audioRef.duration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    audioRef.currentTime = percent * audioRef.duration;
                  }}>
                    <div
                      className="h-full bg-primary-600 rounded-full transition-all duration-100"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono w-10">{currentTrack.source === 'radio' ? 'LIVE' : formatTime(currentTrack.duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                <button onClick={() => setShuffle(!shuffle)} className={clsx('p-2 rounded-lg', shuffle ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border')}>
                  <Shuffle className="w-5 h-5" />
                </button>
                <button onClick={() => setRepeat(!repeat)} className={clsx('p-2 rounded-lg', repeat ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border')}>
                  <Repeat className="w-5 h-5" />
                </button>
                <button onClick={() => setVolume(volume > 0 ? 0 : 0.7)} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  {volume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={e => { const v = parseFloat(e.target.value); setVolume(v); if (audioRef) audioRef.volume = v; }}
                  className="w-24 h-2 accent-primary-600"
                />
                <button onClick={() => setShowQueue(!showQueue)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <Music className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}