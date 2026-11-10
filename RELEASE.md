# Цикл релиза Home Panel

Репо: этот репозиторий (`origin main`, github.com/Leg1onary/home_panel).
Живая панель: аддон HA, порт 8090; HA на том же хосте.

## Порядок
1. **Версия ровно в 3 файлах**: `home_panel/config.json`, `development/addon/home-panel/manifest.json`, `development/package.json`.
   `home_panel/package.json` пишет `build.mjs` — руками не трогать.
2. **Сборка**: `cd development && node build.mjs` → финал `Ready: dist (preview), release (local server, launcher, SQLite), home_panel (add-on).`
3. **Тесты** (~60 с): `node tests/run.mjs`. Контракт — финальная строка `All N test suites passed.`
   (N в файле `tests/run.mjs`; сейчас 36). Если запуск прерывается на ~23 PASS — это убитый
   таймаутом процесс, перезапустить отвязанно, откат кода не нужен.
4. **Кириллица**: `python C:\Users\ssholokhov\scan2.py` → `total: 0`.
   Правка русскоязычных файлов — только editor/python-utf8 (PowerShell-записи вызывали
   двойную кодировку — см. историю).
5. **Commit + push**: `git add -A`, сообщение `<версия>: <что сделано>`, `git push origin main`,
   проверить `git status -sb` (синхронизирован).
6. **Отчёт юзеру**: версия, хеш коммита, тесты N/N, шаги «Репозитории → Обновить → Обновить аддон → Ctrl+F5».
7. **Контроль живой сборки**: отдаваемый `sw.js` должен содержать `VERSION=<новая>`
   (ловушка: HA пишет «обновилось», а контейнер ещё на старой сборке).

## Хронология архитектуры
- **3.0** (5 волн): фронт на Preact — `src/preact/{energy,digest,weather,quick,facts,room}-widget.js`,
  шины с replay (`notify/sub`), `updateRegion` early-return, диспетчер `pointerup` не тронут.
  app.js 1669 → 1563 строк; вынесены `src/shopping.js`, `src/alarm.js`, `src/weather-sheet.js`.
- **3.1.0**: ONVIF-детектор движения двора (`server/yard-onvif.js`: WS-Security digest, PullMessages,
  Renew, самоперезапуск); jpeg-диффер остался fallback. Креды — в preferences профиля
  (`yard_onvif_user/pass/host`), пароль наружу не отдаётся. Диагностика: `GET /api/panel/yard-onvif`.
  Включение: `PUT /api/panel/preferences` с `X-Panel-Proof` (нужен ПОЛНЫЙ профиль v3 —
  взять из `GET /api/panel/profile/export`, добавить ключи, отправить).
- **3.1.1**: WebRTC-гладкость — `jitterBufferTarget` 120 мс + телеметрия `getStats`
  (джиттер/потери/RTT/дроп кадров) в статусе под видео.
- **3.1.2**: выравнивание ряда фактов после миграции — `display:contents` для
  `#facts-slot`, `#weather-slot`, `.yard-slot`, `.facts-widget-root`, `.weather-widget-root`.

## Стенды QA (`development/.qa/`)
- `qa_facts_layout.mjs` — выравнивание ряда фактов по bounding-box.
- `qa_weather_probe.mjs` — встроенный fake-HA (inline, порт 9999) + чип погоды.
- `fake-onvif-qa.mjs` — фейковый ONVIF SOAP-сервер (порт 8081).
