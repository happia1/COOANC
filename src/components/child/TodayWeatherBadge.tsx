'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'

/**
 * Open-Meteo 현재 날씨 응답에서, 화면에 필요한 값만 최소로 정의합니다.
 * - `weather_code`: 날씨 상태 코드(WMO 표준)
 * - `temperature_2m`: 현재 기온(섭씨)
 */
type OpenMeteoCurrent = {
  weather_code?: number
  temperature_2m?: number
}

type WeatherUi = {
  /** 화면에 보이는 날씨 아이콘(비개발자도 빠르게 인지할 수 있게 이모지 사용) */
  icon: string
  /** 화면에 보이는 짧은 날씨 설명 */
  label: string
}

/**
 * WMO 날씨 코드를 앱 UI용 아이콘/문구로 변환합니다.
 * 코드 표준: https://open-meteo.com/en/docs
 */
function mapWeatherCodeToUi(code: number | undefined): WeatherUi {
  if (code == null) return { icon: '❔', label: '확인중' }
  if (code === 0) return { icon: '☀️', label: '맑음' }
  if (code === 1 || code === 2) return { icon: '⛅', label: '구름 조금' }
  if (code === 3) return { icon: '☁️', label: '흐림' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' }
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: '🌦️', label: '이슬비' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: '🌧️', label: '비' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: '❄️', label: '눈' }
  if ([95, 96, 99].includes(code)) return { icon: '⛈️', label: '천둥번개' }
  return { icon: '🌤️', label: '변화무쌍' }
}

/**
 * 캐릭터 영역 우상단에 보이는 "오늘 날씨 배지"입니다.
 * - 배경은 디자인 자산(`weather.png`)을 그대로 사용합니다.
 * - 위에 현재 날씨 이모지와 기온을 겹쳐서 실제 날씨 데이터를 전달합니다.
 * - 현재는 서울 기준 좌표를 사용하며, 추후 아이 프로필 지역값으로 쉽게 교체할 수 있습니다.
 */
export default function TodayWeatherBadge() {
  /** API에서 받은 현재 날씨 원본 값 */
  const [current, setCurrent] = useState<OpenMeteoCurrent | null>(null)
  /** 네트워크 실패 시에도 UI가 깨지지 않도록 실패 상태를 분리 */
  const [failed, setFailed] = useState(false)
  /** weather.png 자산이 깨졌을 때를 대비한 보호 상태 */
  const [weatherImgOk, setWeatherImgOk] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadTodayWeather() {
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=weather_code,temperature_2m&timezone=Asia%2FSeoul',
          { cache: 'no-store' },
        )
        if (!response.ok) throw new Error(`weather api failed: ${response.status}`)
        const json = (await response.json()) as { current?: OpenMeteoCurrent }
        if (!cancelled) {
          setCurrent(json.current ?? null)
          setFailed(false)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    void loadTodayWeather()
    return () => {
      cancelled = true
    }
  }, [])

  /** 날씨 코드가 바뀔 때마다 화면용 아이콘/문구를 다시 계산합니다. */
  const weatherUi = useMemo(() => mapWeatherCodeToUi(current?.weather_code), [current?.weather_code])
  /** 기온 표시는 정수로 단순화해 아이가 읽기 쉽게 만듭니다. */
  const tempText =
    typeof current?.temperature_2m === 'number' ? `${Math.round(current.temperature_2m)}°` : '--°'

  return (
    <div className="pointer-events-none relative h-10 w-10 sm:h-11 sm:w-11" aria-label="오늘 날씨">
      {weatherImgOk ? (
        <Image
          src="/assets/img/common/ui/weather.png"
          alt=""
          fill
          sizes="44px"
          className="object-contain"
          onError={() => setWeatherImgOk(false)}
        />
      ) : (
        /** 자산 로드 실패 시에도 날씨 정보는 계속 보여줍니다. */
        <div className="h-full w-full rounded-full bg-white/80 shadow-sm" />
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] sm:text-[14px]" aria-hidden>
          {failed ? '⚠️' : weatherUi.icon}
        </span>
        <span className="mt-0.5 text-[9px] font-black text-slate-700">{failed ? '오류' : tempText}</span>
      </div>

      <span className="sr-only">
        {failed ? '날씨 정보를 불러오지 못했습니다' : `오늘 날씨 ${weatherUi.label}, 현재 기온 ${tempText}`}
      </span>
    </div>
  )
}

