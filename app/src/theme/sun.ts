/**
 * 일출·일몰 계산 (NOAA 일출 방정식). 외부 요청이나 위치 권한 없이 이 기기 안에서 계산한다.
 * 기준 위치는 인천 동구 일대의 대략적인 좌표(소수 둘째 자리)이며, 개인 주소는 담지 않는다.
 */
export const LATITUDE = 37.48
export const LONGITUDE = 126.64

const RAD = Math.PI / 180
const J1970 = 2440587.5
const J2000 = 2451545
const DAY_MS = 86_400_000

export interface SunTimes {
  sunrise: Date
  sunset: Date
}

const toJulian = (ms: number) => ms / DAY_MS + J1970
const fromJulian = (jd: number) => new Date((jd - J1970) * DAY_MS)
const mod = (a: number, b: number) => ((a % b) + b) % b

/** 해당 "태양일 번호"(2000-01-01 기준)의 일출·일몰. 극지방처럼 해가 뜨지 않거나 지지 않으면 null */
function sunTimesForDay(n: number, lat: number, lon: number): SunTimes | null {
  const jStar = n - lon / 360 // 동경은 해가 UTC 정오보다 일찍 남중한다
  const M = mod(357.5291 + 0.98560028 * jStar, 360)
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD)
  const lambda = mod(M + C + 180 + 102.9372, 360)
  const transit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD)
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD)
  const cosDec = Math.sqrt(1 - sinDec * sinDec)
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec)
  if (cosH < -1 || cosH > 1) return null
  const h = Math.acos(cosH) / (2 * Math.PI) // 하루 중 해가 정오에서 떨어진 비율
  return { sunrise: fromJulian(transit - h), sunset: fromJulian(transit + h) }
}

/** 주어진 시각 근처의 일출·일몰을 날짜별로 돌려준다 (전날·당일·다음날) */
export function sunTimesAround(now: Date, lat = LATITUDE, lon = LONGITUDE): SunTimes[] {
  const n = Math.round(toJulian(now.getTime()) - J2000 + lon / 360)
  return [n - 1, n, n + 1].flatMap((d) => sunTimesForDay(d, lat, lon) ?? [])
}

/** 지금 해가 떠 있는가 (일출 ≤ 지금 < 일몰) */
export function isDaytime(now: Date, lat = LATITUDE, lon = LONGITUDE): boolean {
  return sunTimesAround(now, lat, lon).some((s) => s.sunrise <= now && now < s.sunset)
}

/** 지금이 속한 날의 일출·일몰 (표시용). 지금 시각을 포함하는 낮이나 가장 가까운 다음 낮을 고른다 */
export function nearestSunTimes(now: Date, lat = LATITUDE, lon = LONGITUDE): SunTimes | null {
  const list = sunTimesAround(now, lat, lon)
  return list.find((s) => now < s.sunset && s.sunset.getTime() - now.getTime() < DAY_MS) ?? list[0] ?? null
}
