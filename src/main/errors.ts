// Mapowanie surowego stderr yt-dlp na czytelny komunikat po polsku.
// Wzorce dobrane z realnego outputu yt-dlp (analiza/pobieranie) + udokumentowanych
// komunikatów dla przypadków trudnych do wywołania lokalnie (prywatny/geo/hasło).
// Kolejność MA znaczenie — sprawdzamy od najbardziej szczegółowych.

/** Wyciąga pierwszą linię „ERROR:" i obcina techniczny ogon, do komunikatu fallback. */
function firstErrorDetail(stderr: string): string {
  const line = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^ERROR:/i.test(l))
  if (!line) return ''
  return line
    .replace(/^ERROR:\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/, '') // [youtube], [generic], [vimeo]…
    .replace(/\s*\(caused by .*$/i, '') // ogon "(caused by …)"
    .trim()
}

interface Rule {
  test: RegExp
  pl: string
}

const RULES: Rule[] = [
  // — prywatny / dostęp —
  { test: /private video|sign in if you'?ve been granted access/i, pl: 'Film jest prywatny — brak dostępu.' },
  { test: /members-only|join this channel|available to this channel'?s members/i, pl: 'Film dostępny tylko dla członków kanału (members-only).' },
  { test: /confirm your age|age-?restricted|inappropriate for some users/i, pl: 'Film z ograniczeniem wiekowym — wymaga zalogowania, pobranie niewspierane.' },
  { test: /confirm you'?re not a bot/i, pl: 'YouTube wymaga weryfikacji (nie-bot). Spróbuj później lub zaktualizuj yt-dlp.' },
  // — geo-blokada —
  { test: /not available in your country|available in your (country|location)|not made this video available in your country|geo[- ]?restrict|blocked it in your country/i, pl: 'Film niedostępny w Twoim regionie (geo-blokada).' },
  // — Vimeo: hasło / embed-only —
  { test: /password[- ]?protected|protected by a password|video[- ]?password|--video-password/i, pl: 'Film na Vimeo jest chroniony hasłem — pobieranie niewspierane.' },
  { test: /embed-only|cannot download embed-only/i, pl: 'Film Vimeo można odtwarzać tylko jako osadzony — pobieranie niewspierane.' },
  // — usunięty / nieistniejący —
  { test: /video unavailable|has been removed|removed by the user|account .* has been terminated|http error 404|could not be found|does not exist|no video formats found/i, pl: 'Film jest niedostępny lub został usunięty.' },
  // — błędny adres —
  { test: /is not a valid url|unsupported url/i, pl: 'To nie jest poprawny adres URL filmu.' },
  // — format niedostępny —
  { test: /requested format is not available/i, pl: 'Wybrana jakość/format jest niedostępny dla tego filmu.' },
  // — sieć / DNS (po 404, by nie złapać „Unable to download" z 404) —
  { test: /getaddrinfo failed|failed to resolve|temporary failure in name resolution|errno 11001|errno -3|network is unreachable|connection (timed out|refused|reset)|timed out|urlopen error|ssl: |certificate verify failed/i, pl: 'Brak połączenia z internetem lub serwer nie odpowiada. Sprawdź sieć i spróbuj ponownie.' }
]

export function mapErrorToPL(stderr: string): string {
  const s = stderr || ''
  for (const r of RULES) {
    if (r.test.test(s)) return r.pl
  }
  const detail = firstErrorDetail(s)
  return detail
    ? `Nie udało się przetworzyć filmu. Szczegóły: ${detail}`
    : 'Nie udało się przetworzyć filmu. Sprawdź adres URL i połączenie z internetem.'
}
