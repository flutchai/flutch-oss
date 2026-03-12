# Руководство по тестированию — Flutch OSS

## Содержание

1. [Подготовка окружения](#1-подготовка-окружения)
2. [Запуск сервиса](#2-запуск-сервиса)
3. [Проверка работоспособности](#3-проверка-работоспособности)
4. [Engine — POST /agent/generate](#4-engine--post-agentgenerate)
5. [Engine — POST /agent/stream (SSE)](#5-engine--post-agentstream-sse)
6. [Widget Connector](#6-widget-connector)
7. [Telegram Connector](#7-telegram-connector)
8. [Сквозные сценарии](#8-сквозные-сценарии)
9. [База данных — проверка персистентности](#9-база-данных--проверка-персистентности)
10. [Юнит тесты](#10-юнит-тесты)
11. [Частые проблемы](#11-частые-проблемы)

---

## 1. Подготовка окружения

### 1.1 Создать `.env`

```bash
cp .env.example .env
```

Заполнить обязательные поля:

```dotenv
# Хотя бы один из двух ключей обязателен
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# PostgreSQL (если запускаем локально без Docker)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=flutch
POSTGRES_PASSWORD=flutch
POSTGRES_DB=flutch_oss

CONFIG_MODE=local
```

### 1.2 Проверить `agents.json`

```json
{
  "roofing-agent": {
    "graphType": "flutch.agent",
    "graphSettings": {
      "model": "gpt-4o-mini",
      "systemPrompt": "You are a roofing expert assistant."
    },
    "platforms": {
      "telegram": { "botToken": "YOUR_TELEGRAM_BOT_TOKEN" },
      "widget":   { "widgetKey": "wk_roofing_abc123" }
    }
  }
}
```

---

## 2. Запуск сервиса

### Вариант A — только PostgreSQL в Docker, сервис локально (рекомендован для разработки)

```bash
# Поднять только postgres
docker compose up postgres -d

# Установить зависимости (если не установлены)
yarn install

# Запустить сервис в режиме разработки
yarn start:dev
```

Сервис доступен на `http://localhost:3000`.

### Вариант B — полный Docker Compose стек

```bash
docker compose up -d
```

Сервисы:
- Engine: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Ragflow: `http://localhost:9380`
- Prometheus: `http://localhost:9090`

---

## 3. Проверка работоспособности

### Health check

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ: `200 OK`

### Логи при старте

В консоли должны появиться строки:
```
[AgentConfigService] Config mode: local
[AgentConfigService] Loaded 1 agent(s) from agents.json
[CheckpointerService] PostgreSQL checkpointer initialized
```

Если видим ошибку подключения к PostgreSQL — см. [раздел 11](#11-частые-проблемы).

---

## 4. Engine — POST /agent/generate

Синхронный запрос: ждём полный ответ.

### Базовый запрос

```bash
curl -X POST http://localhost:3000/agent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "roofing-agent",
    "userId":  "test-user-1",
    "input":   "Сколько стоит металлочерепица за квадратный метр?"
  }'
```

Ожидаемый ответ (JSON):
```json
{
  "requestId": "uuid-...",
  "text": "Металлочерепица стоит...",
  "metadata": {}
}
```

### Проверить сохранение контекста (thread memory)

Отправить два последовательных запроса с одним `userId` и проверить что второй ответ учитывает первый:

```bash
# Запрос 1
curl -X POST http://localhost:3000/agent/generate \
  -H "Content-Type: application/json" \
  -d '{"agentId":"roofing-agent","userId":"mem-test-1","input":"Меня зовут Иван"}'

# Запрос 2 — агент должен помнить имя
curl -X POST http://localhost:3000/agent/generate \
  -H "Content-Type: application/json" \
  -d '{"agentId":"roofing-agent","userId":"mem-test-1","input":"Как меня зовут?"}'
```

Ожидается: в ответе на второй запрос упоминается "Иван".

### Ошибочные сценарии

```bash
# Несуществующий агент → 404
curl -X POST http://localhost:3000/agent/generate \
  -H "Content-Type: application/json" \
  -d '{"agentId":"unknown-agent","userId":"u1","input":"test"}'

# Пустой input → 400 (валидация)
curl -X POST http://localhost:3000/agent/generate \
  -H "Content-Type: application/json" \
  -d '{"agentId":"roofing-agent","userId":"u1","input":""}'
```

---

## 5. Engine — POST /agent/stream (SSE)

Стримминг ответа по частям.

### Базовый запрос

```bash
curl -X POST http://localhost:3000/agent/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "agentId": "roofing-agent",
    "userId":  "test-user-2",
    "input":   "Расскажи про виды кровельных материалов"
  }'
```

Ожидаемый вывод — SSE поток:
```
event: partial
data: Существует

event: partial
data:  несколько видов...

event: final
data: {"requestId":"...","text":"Существует несколько видов...","metadata":{}}
```

**Что проверять:**
- Чанки приходят постепенно (не весь текст сразу)
- В конце есть `event: final` с полным текстом
- Соединение закрывается после `final`

---

## 6. Widget Connector

### 6.1 Инициализация сессии

```bash
curl -X POST http://localhost:3000/public/widget/init \
  -H "Content-Type: application/json" \
  -d '{
    "widgetKey":   "wk_roofing_abc123",
    "fingerprint": "test-browser-fingerprint-001"
  }'
```

Ожидаемый ответ:
```json
{
  "threadId":     "uuid-...",
  "sessionToken": "uuid-..."
}
```

**Что проверять:**
- `threadId` — валидный UUID
- `sessionToken` — валидный UUID
- Повторный запрос с тем же `fingerprint` возвращает **тот же** `threadId`

```bash
# Повторный вызов — должен вернуть тот же threadId
curl -X POST http://localhost:3000/public/widget/init \
  -H "Content-Type: application/json" \
  -d '{"widgetKey":"wk_roofing_abc123","fingerprint":"test-browser-fingerprint-001"}'
```

**Ошибочный сценарий — несуществующий widgetKey:**
```bash
curl -X POST http://localhost:3000/public/widget/init \
  -H "Content-Type: application/json" \
  -d '{"widgetKey":"wk_invalid","fingerprint":"fp-1"}'
# Ожидается: 404
```

### 6.2 Отправка сообщения (SSE стриминг)

```bash
# Получить threadId из предыдущего шага и подставить
THREAD_ID="<threadId из /init>"

curl -X POST http://localhost:3000/public/widget/message \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d "{
    \"widgetKey\": \"wk_roofing_abc123\",
    \"threadId\":  \"$THREAD_ID\",
    \"text\":      \"Сколько стоит кровля из металлочерепицы?\"
  }"
```

Ожидаемый поток:
```
event: partial
data: Кровля

event: partial
data:  из металлочерепицы стоит...

event: final
data: {"messageId":"uuid-...","text":"Кровля из металлочерепицы стоит..."}
```

**Что проверять:**
- Заголовки ответа: `Content-Type: text/event-stream`
- Чанки приходят по частям
- `event: final` всегда присутствует в конце

### 6.3 Тестирование через браузер (widget-demo)

1. Открыть `../widget-demo/index.html` в браузере
2. Убедиться что API URL: `http://localhost:3000`, Widget Key: `wk_roofing_abc123`
3. Нажать кнопку чата (правый нижний угол)
4. Дождаться лога `Session OK — threadId: ...`
5. Отправить сообщение
6. Наблюдать стриминг в чате и `Final received` в логе

**Что проверять в браузере:**
- Курсор `▋` мигает пока идёт стриминг
- Текст появляется постепенно
- После завершения курсор пропадает
- Повторное открытие страницы (F5) → тот же `threadId` (fingerprint из localStorage)

---

## 7. Telegram Connector

> Для тестирования нужен бот и ngrok (или другой туннель).

### 7.1 Настройка

1. Создать бота через `@BotFather`, получить токен
2. Прописать в `.env`:
   ```dotenv
   TELEGRAM_BOT_TOKEN_ROOFING_AGENT=7123456789:AAF...
   ```
3. Поднять туннель:
   ```bash
   ngrok http 3000
   ```
4. Зарегистрировать вебхук:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<ngrok-id>.ngrok.io/public/tg/webhook/roofing-agent"
   ```

### 7.2 Проверить вебхук

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Ожидается `"pending_update_count": 0` и отсутствие ошибок.

### 7.3 Ручное тестирование

Написать боту в Telegram. В логах сервиса должны появиться:
```
[TelegramConnectorService] Handling update from chat 123456 for agent "roofing-agent"
[TelegramConnectorService] Replied to chat 123456
```

### 7.4 Симуляция вебхука (без Telegram)

```bash
curl -X POST http://localhost:3000/public/tg/webhook/roofing-agent \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": { "id": 99999, "first_name": "Test", "is_bot": false },
      "chat": { "id": 99999, "type": "private" },
      "date": 1700000000,
      "text": "Сколько стоит кровля?"
    }
  }'
```

Ожидается: `200 OK` (тело пустое — Telegram так и должен получать).

**Проверить в логах** что агент ответил через Telegram API (или упал с ошибкой про токен если токен невалидный).

---

## 8. Сквозные сценарии

### Сценарий 1 — Один пользователь, два канала

Один пользователь общается через Widget и через прямой API. Треды должны быть **раздельными** (per platform).

```bash
# Инициализировать widget сессию
curl -X POST http://localhost:3000/public/widget/init \
  -d '{"widgetKey":"wk_roofing_abc123","fingerprint":"user-x-fp"}'
# Получаем threadId-1

# Прямой вызов engine с другим userId
curl -X POST http://localhost:3000/agent/generate \
  -d '{"agentId":"roofing-agent","userId":"user-x","input":"Привет"}'
# Это thread-2, независимый от widget
```

**Что проверять** (в БД):
```sql
SELECT id, platform, agent_id FROM threads WHERE agent_id = 'roofing-agent';
-- Должно быть как минимум 2 строки: platform=widget и platform=api (или без платформы)
```

### Сценарий 2 — Персистентность после перезапуска

```bash
# Запрос 1
curl -X POST http://localhost:3000/public/widget/init \
  -d '{"widgetKey":"wk_roofing_abc123","fingerprint":"persist-test"}'
# Запомнить threadId

# Перезапустить сервис
yarn start:dev

# Запрос 2 — тот же fingerprint → тот же threadId
curl -X POST http://localhost:3000/public/widget/init \
  -d '{"widgetKey":"wk_roofing_abc123","fingerprint":"persist-test"}'
```

**Ожидается:** `threadId` совпадает с первым запросом.

### Сценарий 3 — Память разговора (LangGraph checkpointer)

```bash
# Установить факт
curl -X POST http://localhost:3000/public/widget/message \
  -d "{\"widgetKey\":\"wk_roofing_abc123\",\"threadId\":\"$THREAD_ID\",\"text\":\"Мой дом 150 кв.м.\"}"

# Спросить про этот факт
curl -X POST http://localhost:3000/public/widget/message \
  -d "{\"widgetKey\":\"wk_roofing_abc123\",\"threadId\":\"$THREAD_ID\",\"text\":\"Сколько черепицы нужно на мой дом?\"}"
```

**Ожидается:** в ответе упоминается 150 кв.м. или рассчитывается исходя из этой площади.

---

## 9. База данных — проверка персистентности

Подключиться к PostgreSQL:

```bash
docker compose exec postgres psql -U flutch -d flutch_oss
# или
psql postgresql://flutch:flutch@localhost:5432/flutch_oss
```

### Полезные запросы

```sql
-- Все пользователи
SELECT id, created_at FROM users ORDER BY created_at DESC;

-- Идентификаторы по платформам
SELECT u.id, ui.platform, ui.external_id, ui.metadata
FROM user_identities ui JOIN users u ON u.id = ui.user_id;

-- Треды (один на пару агент+юзер+платформа)
SELECT id, agent_id, user_id, platform, created_at FROM threads;

-- Последние сообщения
SELECT t.agent_id, t.platform, m.direction, LEFT(m.content, 80), m.created_at
FROM messages m JOIN threads t ON t.id = m.thread_id
ORDER BY m.created_at DESC LIMIT 20;

-- Количество сообщений по тредам
SELECT t.id, t.platform, COUNT(m.id) as msg_count
FROM threads t LEFT JOIN messages m ON m.thread_id = t.id
GROUP BY t.id ORDER BY msg_count DESC;
```

**Что проверять:**
- После каждого сообщения через Widget в `messages` появляется пара INCOMING + OUTGOING
- `thread_id` в `messages` совпадает с тем, что вернул `/init`
- У одного `fingerprint` всегда один `user_identity`

---

## 10. Юнит тесты

### Запуск всех тестов

```bash
yarn test
```

### Запуск с покрытием

```bash
yarn test:cov
```

### Запуск конкретного модуля

```bash
# Widget
yarn test --testPathPattern="widget"

# Telegram
yarn test --testPathPattern="telegram"

# Engine
yarn test --testPathPattern="engine"

# Config
yarn test --testPathPattern="agent-config"
```

### Ожидаемые результаты

```
Test Suites: 15 passed, 15 total
Tests:       135 passed, 135 total
```

Если тест падает — это регрессия, нужно разбираться до мёрджа.

---

## 11. Частые проблемы

### Сервис не запускается — ошибка подключения к БД

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Решение:** убедиться что PostgreSQL запущен:
```bash
docker compose up postgres -d
docker compose ps
```

### `agents.json` не найден

```
[AgentConfigService] agents.json not found — no local agents configured
```

**Решение:** файл должен лежать в корне проекта (рядом с `package.json`).

### Widget init возвращает 404

```json
{"statusCode":404,"message":"No agent found for widgetKey \"wk_roofing_abc123\""}
```

**Решение:** проверить что в `agents.json` есть `platforms.widget.widgetKey: "wk_roofing_abc123"`.

### SSE стрим не приходит в браузере (CORS)

Widget demo открыт как `file://` — браузер может блокировать запросы к `localhost`.

**Решение:** поднять простой HTTP сервер:
```bash
cd ../widget-demo
npx serve .
# или
python3 -m http.server 8080
```

Открыть `http://localhost:8080` вместо `file://`.

### LangGraph не помнит контекст между запросами

**Причина:** checkpointer не инициализирован или `thread_id` разный в каждом запросе.

**Проверить:**
```bash
# Должна быть строка при старте
[CheckpointerService] PostgreSQL checkpointer initialized
```

В БД должна быть таблица `checkpoints`:
```sql
SELECT COUNT(*) FROM checkpoints;
```

Если таблицы нет — checkpointer не поднялся, проверить переменные PostgreSQL в `.env`.

### Telegram вебхук не получает сообщения

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Проверить поле `last_error_message`. Частые причины:
- ngrok URL устарел — нужно перерегистрировать вебхук
- Сервис недоступен извне (порт не проброшен)
- SSL ошибка (ngrok даёт валидный SSL, bare IP — нет)
