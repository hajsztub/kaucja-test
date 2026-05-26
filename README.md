# Kaucjomat

Mobilna aplikacja do liczenia, zapisywania i planowania zwrotów opakowań w polskim systemie kaucyjnym.

## Start lokalnie

```bash
npm install
npm run start
```

## Konfiguracja przed publikacją

- Reklamy AdMob są skonfigurowane produkcyjnymi jednostkami w `App.tsx` i App ID w `app.json`.
- Do testowania reklam potrzebny jest development build albo build produkcyjny; zwykłe Expo Go nie zawiera natywnego modułu AdMob.
- Android Firebase Analytics jest skonfigurowany przez `google-services.json`, `@react-native-firebase/app` i `@react-native-firebase/analytics`; Gradle użyje ich przy prebuildzie/EAS buildzie.
- Dodaj produkcyjne klucze Google Maps dla iOS i Androida.
- Android Maps API key powinien mieć wpisy dla pakietu `com.apphill.kaucja` oraz SHA-1 certyfikatów debug/upload/Play App Signing.
- Przygotuj ikonę aplikacji, splash screen i grafiki do sklepów.
- Ustal docelowe źródło danych punktów zwrotu albo backend do crowdsourcingu statusów.
