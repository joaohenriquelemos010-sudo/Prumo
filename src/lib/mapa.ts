/**
 * Deep links for directions. No API key needed, and on a phone (including a
 * future Capacitor app) these open the native Google Maps / Waze apps directly.
 */

export function googleMapsUrl(lat: number, lng: number, nome?: string): string {
  const destino = `${lat},${lng}`
  const q = nome ? `&destination_place_id=&query=${encodeURIComponent(nome)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}${q}`
}

export function wazeUrl(lat: number, lng: number): string {
  return `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
}

/** Best-effort browser geolocation with a graceful timeout/fallback. */
export function obterLocalizacao(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  })
}
