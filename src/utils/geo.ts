export interface Koordinat {
  latitude: number;
  longitude: number;
}

const RADIUS_BUMI_METER = 6_371_000;
const rad = (derajat: number) => (derajat * Math.PI) / 180;

/** Jarak dua koordinat dalam meter (rumus haversine). Dipakai Maps dan validasi presensi. */
export function jarakMeter(a: Koordinat, b: Koordinat): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIUS_BUMI_METER * Math.asin(Math.sqrt(h));
}

/** True bila titik berada di dalam radius (meter) dari pusat. */
export function dalamRadius(titik: Koordinat, pusat: Koordinat, radiusMeter: number): boolean {
  return jarakMeter(titik, pusat) <= radiusMeter;
}

export function formatJarak(meter: number): string {
  return meter < 1000 ? `${Math.round(meter)} m` : `${(meter / 1000).toFixed(1)} km`;
}