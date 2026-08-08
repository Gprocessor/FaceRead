export function getDeviceInfo(): Record<string, unknown> {
  if (typeof navigator === 'undefined') return {};
  return { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language, screen: { width: window.screen.width, height: window.screen.height }, viewport: { width: window.innerWidth, height: window.innerHeight }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, timestamp: new Date().toISOString() };
}
export async function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => { navigator.geolocation.getCurrentPosition((p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => resolve(null), { timeout: 5000, maximumAge: 60000 }); });
}
