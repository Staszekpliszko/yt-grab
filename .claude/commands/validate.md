Faza VALIDATE projektu YT-GRAB. Przejdź checklistę, każdy punkt oznacz ✅/❌ z dowodem (output komendy lub wskazanie kodu):

1. `npm run typecheck` i `npm run build` przechodzą czysto.
2. `yt-dlp -J <testowy URL>` parsowany poprawnie — lista formatów zawiera wszystkie rozdzielczości z odpowiedzi (porównaj liczbę z surowym JSON).
3. Pobranie wideo+audio w MP4, MKV i WEBM — plik powstaje w wybranym folderze, ffprobe pokazuje poprawne strumienie, brak rekodowania tam gdzie plan przewiduje copy.
4. Pobranie audio w MP3, M4A, OPUS, WAV — ffprobe potwierdza kodek/kontener.
5. Dialog wyboru folderu działa, lastOutputDir przeżywa restart aplikacji.
6. Progress aktualizuje się płynnie, anulowanie zabija procesy i usuwa .part.
7. Błędne URL / film prywatny → komunikat PL, aplikacja nie wisi.
8. Brak wywołań node/fs/child_process w rendererze (grep po src/renderer).
9. Tytuł z polskimi znakami i znakami zakazanymi (`/ : ? "`) → poprawna nazwa pliku na Win i Mac.
10. Paczka electron-builder uruchamia się i znajduje binarki yt-dlp/ffmpeg z resources.

Na końcu: lista znalezionych problemów z priorytetami. Nie naprawiaj nic bez polecenia.
