// Rozpoznanie źródła filmu po domenie URL. Steruje wyborem mapera formatów
// i selektora pobierania. 'generic' = obsłuż dotychczasową (YouTube-ową) ścieżką,
// bo yt-dlp i tak ogarnia większość serwisów tym samym układem formatów.

export type VideoSource = 'youtube' | 'vimeo' | 'generic'

export function detectSource(url: string): VideoSource {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'generic'
  }
  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) return 'vimeo'
  if (host.endsWith('youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
    return 'youtube'
  }
  return 'generic'
}
