// FitGuide Web — погода (порт WeatherClient.java)
// open-meteo: без ключей, бесплатно. Геокодирование города + текущая погода.

import { useEffect, useState } from 'react';

export interface Weather {
  loading: boolean;
  temp: number | null;
  emoji: string;
  code: number;
  city: string;
  error: string | null;
}

const EMPTY: Weather = { loading: true, temp: null, emoji: '·', code: 0, city: '', error: null };

/** Код погоды WMO → эмодзи (как в Android-версии). */
export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫';
  if (code <= 55) return '🌧';
  if (code <= 57) return '🌧';
  if (code <= 65) return '🌧';
  if (code <= 67) return '🌧';
  if (code <= 77) return '🌨';
  if (code <= 82) return '🌦';
  if (code <= 86) return '🌨';
  return '🌧';
}

export function useWeather(cityName: string): Weather {
  const [weather, setWeather] = useState<Weather>(EMPTY);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!cityName?.trim()) {
        if (alive) setWeather({ ...EMPTY, loading: false, city: '' });
        return;
      }
      try {
        // 1) геокодирование
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=ru&format=json`
        );
        const geo = await geoRes.json();
        const place = geo?.results?.[0];
        if (!place) {
          if (alive) setWeather({ ...EMPTY, loading: false, city: cityName, error: 'Город не найден' });
          return;
        }

        // 2) погода
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&current=temperature_2m,weather_code&timezone=auto`
        );
        const wx = await wxRes.json();
        const code = wx?.current?.weather_code ?? 0;
        const temp = wx?.current?.temperature_2m ?? null;

        if (alive) {
          setWeather({
            loading: false,
            temp,
            code,
            emoji: weatherEmoji(code),
            city: place.name ?? cityName,
            error: null,
          });
        }
      } catch (e) {
        if (alive) setWeather({ ...EMPTY, loading: false, city: cityName, error: String(e) });
      }
    }

    load();
    return () => { alive = false; };
  }, [cityName]);

  return weather;
}
