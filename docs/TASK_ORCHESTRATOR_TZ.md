# Техническое задание: Task Orchestrator (MVP)

## 1. Общее описание

**Task Orchestrator** — модуль системы Flutch OSS, отвечающий за управление, планирование и автоматический запуск задач. Задачи могут выполняться AI-агентом (через существующий граф-движок) или делегироваться человеку с оповещением через выбранный канал коммуникации.

**Цель MVP:** автоматизировать повторяющиеся рабочие процессы — от CRM-follow-up до напоминаний менеджерам — используя существующую инфраструктуру (NestJS, PostgreSQL, LangGraph, платформенные коннекторы).

---

## 2. Ключевые сценарии использования

### Сценарий 1: Автоматический follow-up
> Каждый день в 10:00 агент проверяет CRM на новые лиды без ответа и отправляет follow-up сообщение через Telegram.

### Сценарий 2: Напоминание менеджеру
> Через 2 часа после создания сделки в CRM — отправить менеджеру в Telegram напоминание «Позвони клиенту X».

### Сценарий 3: Периодический отчёт
> Каждую пятницу в 18:00 агент собирает статистику из CRM и отправляет сводку в Telegram-чат руководителю.

### Сценарий 4: Ручной запуск задачи
> Администратор через Admin UI создаёт задачу «Обзвонить 10 клиентов» и назначает на менеджера. Менеджер получает уведомление и отмечает задачу выполненной.

---

## 3. Модель данных

### 3.1 Сущность `Task`

```typescript
@Entity('tasks')
class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.ACTIVE })
  status: TaskStatus;

  // --- Триггер ---
  @Column({ type: 'jsonb' })
  trigger: TaskTrigger;

  // --- Ответственный ---
  @Column({ type: 'jsonb' })
  assignee: TaskAssignee;

  // --- Метаданные ---
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 3.2 Сущность `TaskExecution`

Каждый запуск задачи (экземпляр исполнения):

```typescript
@Entity('task_executions')
class TaskExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task)
  task: Task;

  @Column('uuid')
  taskId: string;

  @Column({ type: 'enum', enum: ExecutionStatus })
  status: ExecutionStatus;

  @Column({ type: 'text', nullable: true })
  result: string;          // Результат выполнения (текст ответа агента, или отметка человека)

  @Column({ type: 'text', nullable: true })
  error: string;           // Ошибка, если провалилось

  @Column({ type: 'timestamp' })
  triggeredAt: Date;       // Когда сработал триггер

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;       // Когда завершилось

  @CreateDateColumn()
  createdAt: Date;
}
```

### 3.3 Перечисления и типы

```typescript
enum TaskStatus {
  ACTIVE = 'active',         // Задача активна, триггер работает
  PAUSED = 'paused',         // Временно приостановлена
  COMPLETED = 'completed',   // Выполнена (для one-shot задач)
  ARCHIVED = 'archived',     // Убрана из активных
}

enum ExecutionStatus {
  PENDING = 'pending',           // Ожидает выполнения (человеком)
  IN_PROGRESS = 'in_progress',   // Агент работает / человек взял в работу
  DONE = 'done',                 // Успешно завершена
  FAILED = 'failed',             // Ошибка при выполнении
  EXPIRED = 'expired',           // Просрочена (для задач с дедлайном)
}

// --- Триггер ---
type TaskTrigger =
  | { type: 'cron'; schedule: string }                      // Cron-выражение: "0 10 * * *"
  | { type: 'event'; eventName: string; filter?: Record<string, any> }  // Внутреннее событие
  | { type: 'once'; executeAt: string }                     // ISO дата однократного запуска
  | { type: 'manual' };                                     // Только ручной запуск

// --- Ответственный ---
type TaskAssignee =
  | {
      type: 'agent';
      agentId: string;           // ID агента из agents.json / платформы
      input?: string;            // Текст, который будет отправлен агенту как HumanMessage
    }
  | {
      type: 'human';
      notification: NotificationTarget;
    };

// --- Канал уведомления ---
type NotificationTarget =
  | { channel: 'telegram'; chatId: string }
  | { channel: 'webhook'; url: string; method?: 'POST' | 'GET'; headers?: Record<string, string> }
  | { channel: 'internal' };   // Только отображение в Admin UI (без пуша)
```

---

## 4. Архитектура модуля

### 4.1 Структура файлов

```
src/modules/orchestrator/
├── orchestrator.module.ts            # NestJS модуль
├── orchestrator.service.ts           # Основной сервис (CRUD задач)
├── scheduler.service.ts              # Cron-планировщик
├── dispatcher.service.ts             # Роутинг: агент vs человек
├── notifier.service.ts               # Отправка уведомлений
├── event-bus.service.ts              # Внутренняя шина событий
├── entities/
│   ├── task.entity.ts
│   └── task-execution.entity.ts
├── dto/
│   ├── create-task.dto.ts
│   ├── update-task.dto.ts
│   └── task-response.dto.ts
├── orchestrator.controller.ts        # Admin API для задач
└── orchestrator.constants.ts         # Константы, лимиты
```

### 4.2 Компонентная схема

```
                    Admin API / External Event
                           │
                           ▼
                  ┌──────────────────┐
                  │  Orchestrator    │
                  │  Service         │
                  │  (CRUD, lifecycle│
                  │   management)    │
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │  Scheduler   │ │ EventBus │ │  One-shot     │
     │  Service     │ │ Service  │ │  Timer        │
     │  (cron jobs) │ │ (events) │ │  (setTimeout) │
     └──────┬───────┘ └────┬─────┘ └──────┬───────┘
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                  ┌──────────────────┐
                  │  Dispatcher      │
                  │  Service         │
                  └────────┬─────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
       ┌──────────────┐      ┌──────────────┐
       │ Agent Runner  │      │  Notifier    │
       │ (graph invoke)│      │  Service     │
       └──────────────┘      └──────┬───────┘
                                    │
                          ┌─────────┼─────────┐
                          ▼         ▼         ▼
                      Telegram   Webhook   Internal
```

---

## 5. Описание компонентов

### 5.1 OrchestratorService

**Ответственность:** CRUD-операции над задачами, управление жизненным циклом.

```typescript
interface IOrchestratorService {
  // CRUD
  createTask(dto: CreateTaskDto): Promise<Task>;
  updateTask(id: string, dto: UpdateTaskDto): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTask(id: string): Promise<Task>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;

  // Управление статусом
  pauseTask(id: string): Promise<Task>;
  resumeTask(id: string): Promise<Task>;
  archiveTask(id: string): Promise<Task>;

  // Ручной запуск
  triggerTask(id: string): Promise<TaskExecution>;

  // Выполнение
  listExecutions(taskId: string, filter?: ExecutionFilter): Promise<TaskExecution[]>;
  markExecutionDone(executionId: string, result?: string): Promise<TaskExecution>;
}
```

**При создании задачи:**
1. Валидация DTO
2. Сохранение в БД
3. Если триггер = `cron` → регистрация в SchedulerService
4. Если триггер = `once` → регистрация таймера
5. Если триггер = `event` → подписка в EventBusService

**При удалении/паузе:**
1. Остановка cron-задания / отписка от события / отмена таймера
2. Обновление статуса в БД

### 5.2 SchedulerService

**Ответственность:** Управление cron-задачами.

**Реализация:** Использовать `@nestjs/schedule` (на базе `cron` npm-пакета) — уже совместим с NestJS DI.

```typescript
interface ISchedulerService {
  register(taskId: string, cronExpression: string, callback: () => void): void;
  unregister(taskId: string): void;
  isRegistered(taskId: string): boolean;
}
```

**Детали реализации:**
- Хранит Map<taskId, CronJob> в памяти
- При старте приложения (`onModuleInit`) загружает все ACTIVE задачи с trigger.type = 'cron' из БД и регистрирует
- Cron-выражения валидируются при создании задачи (5/6-символьные, стандартный формат)
- Таймзона: настраивается через env `ORCHESTRATOR_TIMEZONE`, по умолчанию `UTC`

**Лимиты (MVP):**
- Максимум 100 одновременных cron-задач
- Минимальный интервал: 1 минута (защита от `* * * * *` по ошибке)

### 5.3 EventBusService

**Ответственность:** Внутренняя шина событий для триггеров типа `event`.

**Реализация:** Использовать NestJS `EventEmitter2` (`@nestjs/event-emitter`).

```typescript
interface IEventBusService {
  subscribe(eventName: string, taskId: string, handler: () => void): void;
  unsubscribe(eventName: string, taskId: string): void;
  emit(eventName: string, payload?: Record<string, any>): void;
}
```

**Предопределённые события (MVP):**
- `crm.lead.created` — новый лид в CRM
- `crm.deal.updated` — обновление сделки
- `conversation.completed` — завершение диалога с агентом
- Кастомные события через API: `POST /orchestrator/events/:eventName`

**Важно:** В MVP шина работает in-process. Для распределённых сценариев в будущем можно заменить на Redis Pub/Sub или BullMQ — интерфейс останется тем же.

### 5.4 DispatcherService

**Ответственность:** Определяет, кому направить задачу, и запускает выполнение.

```typescript
interface IDispatcherService {
  dispatch(task: Task): Promise<TaskExecution>;
}
```

**Логика:**
1. Создать запись `TaskExecution` со статусом `IN_PROGRESS` (агент) или `PENDING` (человек)
2. Если `assignee.type === 'agent'`:
   - Получить конфиг агента через `AgentConfigService.getConfig(agentId)`
   - Вызвать граф через `EngineService` (существующий)
   - Передать `assignee.input` как HumanMessage
   - Thread ID: `orchestrator:{taskId}:{executionId}` (отдельный от пользовательских диалогов)
   - Записать результат в `execution.result`
   - Обновить статус: `DONE` или `FAILED`
3. Если `assignee.type === 'human'`:
   - Вызвать `NotifierService.notify(task, execution)`
   - Оставить статус `PENDING` — человек завершает вручную

### 5.5 NotifierService

**Ответственность:** Отправка уведомлений через настроенный канал.

```typescript
interface INotifierService {
  notify(task: Task, execution: TaskExecution): Promise<void>;
}
```

**Каналы (MVP):**

#### Telegram
- Использовать существующий `TelegramApiClient` из `platform-connector/telegram/`
- Для отправки нужен `chatId` (из `assignee.notification`)
- Нужен `botToken` — брать из конфига первого агента с Telegram-платформой, либо отдельный env `ORCHESTRATOR_TELEGRAM_BOT_TOKEN`
- Формат сообщения:
  ```
  📋 Новая задача: {task.title}

  {task.description}

  Для отметки о выполнении: /done_{execution.id_short}
  ```

#### Webhook
- HTTP-запрос на указанный URL
- Body:
  ```json
  {
    "event": "task.triggered",
    "task": { "id": "...", "title": "...", "description": "..." },
    "execution": { "id": "...", "triggeredAt": "..." },
    "callbackUrl": "https://{host}/orchestrator/executions/{id}/done"
  }
  ```
- Timeout: 10 секунд
- Retry: 1 повтор через 30 секунд при ошибке

#### Internal
- Никакого пуша — задача отображается только в Admin UI
- Администратор видит её в списке ожидающих выполнения

---

## 6. API Endpoints

### 6.1 Задачи (Admin-protected)

```
POST   /orchestrator/tasks                 # Создать задачу
GET    /orchestrator/tasks                 # Список задач (с фильтрацией)
GET    /orchestrator/tasks/:id             # Получить задачу
PATCH  /orchestrator/tasks/:id             # Обновить задачу
DELETE /orchestrator/tasks/:id             # Удалить задачу

POST   /orchestrator/tasks/:id/trigger     # Ручной запуск
POST   /orchestrator/tasks/:id/pause       # Приостановить
POST   /orchestrator/tasks/:id/resume      # Возобновить
POST   /orchestrator/tasks/:id/archive     # Архивировать
```

### 6.2 Исполнения

```
GET    /orchestrator/tasks/:id/executions            # История запусков задачи
GET    /orchestrator/executions/:executionId          # Детали запуска
POST   /orchestrator/executions/:executionId/done     # Отметить выполненной
```

### 6.3 События

```
POST   /orchestrator/events/:eventName               # Вызвать событие (для внешних интеграций)
```

### 6.4 Примеры запросов

**Создание cron-задачи с агентом:**
```json
POST /orchestrator/tasks
{
  "title": "Утренний follow-up лидов",
  "description": "Проверить CRM на лиды без ответа и отправить follow-up",
  "trigger": {
    "type": "cron",
    "schedule": "0 10 * * 1-5"
  },
  "assignee": {
    "type": "agent",
    "agentId": "sales-agent-1",
    "input": "Проверь CRM на лиды без ответа за последние 24 часа и отправь каждому follow-up сообщение."
  }
}
```

**Создание задачи для человека с Telegram-уведомлением:**
```json
POST /orchestrator/tasks
{
  "title": "Позвонить клиенту Иванов",
  "description": "Обсудить условия контракта на Q2",
  "trigger": {
    "type": "once",
    "executeAt": "2026-03-20T14:00:00Z"
  },
  "assignee": {
    "type": "human",
    "notification": {
      "channel": "telegram",
      "chatId": "123456789"
    }
  }
}
```

**Отметить выполненной:**
```json
POST /orchestrator/executions/abc-123/done
{
  "result": "Позвонил, договорились на встречу в среду"
}
```

---

## 7. Интеграция с существующей системой

### 7.1 Зависимости от существующих модулей

| Модуль | Что используется | Как |
|--------|-----------------|-----|
| `EngineModule` | `EngineService` для запуска графа | Dispatcher вызывает `stream()` / `invoke()` |
| `ConfigModule` | `AgentConfigService` для получения конфига агента | Dispatcher получает graphSettings |
| `CheckpointerModule` | `CheckpointerService` для state management | Через EngineService (уже интегрирован) |
| `PlatformConnectorModule` | `TelegramApiClient` для отправки уведомлений | Notifier использует для Telegram |
| `DatabaseModule` | TypeORM, PostgreSQL connection | Хранение Task и TaskExecution |
| `AdminModule` | `AdminAuthGuard` для защиты API | Все endpoints за авторизацией |

### 7.2 Регистрация модуля

```typescript
// app.module.ts
@Module({
  imports: [
    // ... существующие модули
    OrchestratorModule,
  ],
})
export class AppModule {}
```

### 7.3 Миграция БД

Создать миграцию: `{timestamp}-AddOrchestratorTables.ts`

Таблицы:
- `tasks` — основная таблица задач
- `task_executions` — история запусков

Индексы:
- `tasks(status)` — фильтрация активных задач при старте
- `task_executions(taskId, triggeredAt)` — история по задаче
- `task_executions(status)` — фильтрация pending для UI

---

## 8. Обработка ошибок и граничные случаи

### 8.1 Падение приложения
- При рестарте `SchedulerService.onModuleInit()` восстанавливает все ACTIVE cron-задачи
- Задачи типа `once`, чей `executeAt` прошёл — помечаются как `EXPIRED` или запускаются немедленно (настраивается: env `ORCHESTRATOR_CATCH_UP_MISSED=true|false`)

### 8.2 Ошибка агента
- Если граф вернул ошибку → execution.status = `FAILED`, execution.error = текст ошибки
- Задача остаётся ACTIVE — следующий триггер сработает штатно

### 8.3 Timeout агента
- Максимальное время выполнения агента: 5 минут (env `ORCHESTRATOR_AGENT_TIMEOUT_MS=300000`)
- По timeout → execution.status = `FAILED`, execution.error = 'Execution timed out'

### 8.4 Ошибка уведомления
- Если Telegram API вернул ошибку → логировать, execution остаётся `PENDING`
- Retry 1 раз через 30 секунд
- Задача не помечается FAILED — человек может увидеть её в UI

### 8.5 Concurrent execution
- Для cron-задач: не запускать новый execution, если предыдущий ещё IN_PROGRESS
- Логировать skip: `Task {id} skipped: previous execution still in progress`

---

## 9. Конфигурация

### Переменные окружения

```env
# Orchestrator
ORCHESTRATOR_ENABLED=true                     # Включить/выключить модуль
ORCHESTRATOR_TIMEZONE=Europe/Moscow           # Таймзона для cron (default: UTC)
ORCHESTRATOR_MAX_CRON_TASKS=100               # Лимит cron-задач
ORCHESTRATOR_AGENT_TIMEOUT_MS=300000          # Timeout выполнения агента (5 мин)
ORCHESTRATOR_CATCH_UP_MISSED=false            # Запускать пропущенные one-shot задачи
ORCHESTRATOR_TELEGRAM_BOT_TOKEN=              # Токен бота для уведомлений (если отдельный)
```

---

## 10. Admin UI (фронтенд)

### 10.1 Страницы

**Список задач** (`/admin/tasks`)
- Таблица: Title | Trigger | Assignee | Status | Last Run | Actions
- Фильтры: по статусу, типу триггера, типу ответственного
- Actions: Pause/Resume, Trigger Now, Edit, Delete

**Создание/редактирование задачи** (`/admin/tasks/new`, `/admin/tasks/:id/edit`)
- Форма с полями из DTO
- Cron-helper: показ «следующие 5 запусков» при вводе cron-выражения
- Выбор агента из списка (dropdown из AgentConfigService)
- Выбор канала уведомления

**История запусков** (`/admin/tasks/:id/executions`)
- Таблица: Triggered At | Status | Duration | Result/Error
- Действие: отметить PENDING как выполненную

**Pending задачи** (`/admin/tasks/pending`)
- Список всех execution со статусом PENDING (ожидают действия человека)
- Quick action: «Выполнено» с полем для комментария

### 10.2 API для фронтенда

Все endpoint'ы из раздела 6, защищённые `AdminAuthGuard`.

---

## 11. Нефункциональные требования

| Параметр | Требование |
|----------|-----------|
| **Потребление RAM** | +30-50 МБ к текущему процессу (без учёта запущенных агентов) |
| **CPU в idle** | ~0% (event loop + таймеры) |
| **Latency создания задачи** | < 100ms |
| **Latency dispatch** | < 500ms (без учёта выполнения агента) |
| **Max concurrent cron jobs** | 100 |
| **Персистентность** | Все данные в PostgreSQL, восстановление после рестарта |
| **Масштабирование** | MVP: single-process. В будущем — BullMQ + Redis для distributed |

---

## 12. Ограничения MVP

1. **Single-process** — оркестратор работает в том же процессе, что и движок. Нет распределённой очереди.
2. **In-memory cron** — cron-задачи хранятся в памяти (Map), восстанавливаются из БД при рестарте.
3. **Нет retry-политики для агентов** — при ошибке execution = FAILED, без автоматического повтора.
4. **Нет цепочек задач** — задачи независимы, нет DAG/workflow (это следующая итерация).
5. **Нет приоритетов** — все задачи равноправны.
6. **Уведомления: Telegram + Webhook + Internal** — email и другие каналы в будущем.
7. **Нет rate limiting** на API событий — предполагается доверенная среда.

---

## 13. План реализации

### Фаза 1: Ядро (2 дня)
- [ ] Модель данных: entities, миграция
- [ ] OrchestratorService: CRUD задач
- [ ] OrchestratorController: REST API
- [ ] Unit-тесты CRUD

### Фаза 2: Триггеры (1.5 дня)
- [ ] SchedulerService: cron-задачи с `@nestjs/schedule`
- [ ] One-shot таймеры (setTimeout с персистентностью)
- [ ] EventBusService: подписка на события
- [ ] Восстановление задач при старте приложения
- [ ] Unit-тесты триггеров

### Фаза 3: Исполнение (1.5 дня)
- [ ] DispatcherService: роутинг agent/human
- [ ] Интеграция с EngineService (запуск графа)
- [ ] TaskExecution: создание, обновление статусов
- [ ] Timeout и обработка ошибок
- [ ] Unit-тесты dispatch

### Фаза 4: Уведомления (1 день)
- [ ] NotifierService: Telegram
- [ ] NotifierService: Webhook
- [ ] Retry-логика для уведомлений
- [ ] Unit-тесты нотификаций

### Фаза 5: Admin UI (2 дня)
- [ ] Страница списка задач
- [ ] Форма создания/редактирования
- [ ] Страница истории запусков
- [ ] Страница pending задач

### Фаза 6: Интеграционные тесты и документация (1 день)
- [ ] E2E тесты полного цикла (create → trigger → dispatch → notify)
- [ ] API-документация (Swagger-декораторы)

**Итого: ~9 рабочих дней на MVP**

---

## 14. Будущие итерации (вне MVP)

- **Цепочки задач (DAG)** — задача A → при завершении запустить задачу B
- **BullMQ** — замена in-memory scheduler на Redis-based для горизонтального масштабирования
- **Email-уведомления** — канал email через SMTP
- **Retry-политики** — автоматический повтор с exponential backoff
- **Приоритеты** — очередь с приоритетами для агентных задач
- **Шаблоны задач** — предустановленные шаблоны (follow-up, отчёт, напоминание)
- **Webhooks на статус** — callback при изменении статуса execution
- **Dashboard** — графики: задачи/день, success rate, avg duration
