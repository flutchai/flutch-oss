# Сравнительный анализ: Flutch Sales Agent vs OpenClaw

## Краткая характеристика

| | **Flutch Sales Agent** | **OpenClaw** |
|---|---|---|
| **Назначение** | B2B AI-агент для продаж с CRM-интеграцией | Персональный AI-ассистент общего назначения |
| **Лицензия** | MIT | MIT |
| **Стек** | NestJS + LangGraph + TypeScript | Node.js + TypeScript (без фреймворка графов) |
| **Версия** | v0.6.0 | v2026.x (20k+ коммитов) |
| **Фокус** | Специализированный (sales/CRM) | Универсальный (personal assistant) |

---

## 1. Архитектура агента

| Аспект | Flutch | OpenClaw | Вердикт |
|--------|--------|----------|---------|
| **Граф выполнения** | LangGraph — DAG с узлами, условными переходами, состоянием | Последовательный цикл (до 20 итераций) без явного графа | **Flutch лучше** — граф позволяет строить сложные, предсказуемые workflow |
| **Типы графов** | 2 варианта (Simple, Sales) с разными pipeline | Один универсальный цикл agent-loop | **Flutch лучше** — мультиграфовый подход гибче для бизнес-логики |
| **State management** | LangGraph Annotation с типизированным состоянием + PostgreSQL checkpointer | Markdown-файлы + SQLite с vector embeddings | **Flutch лучше** — структурированное, персистентное, транзакционное |
| **Масштабируемость** | Multi-tenant (много агентов, пользователей, потоков) | Single-user (один пользователь, один агент) | **Flutch значительно лучше** |

---

## 2. Интеграции и платформы

| Аспект | Flutch | OpenClaw | Вердикт |
|--------|--------|----------|---------|
| **Мессенджеры** | Telegram, Widget (2 канала) | 20+ каналов (WhatsApp, Telegram, Slack, Discord, Signal, iMessage и др.) | **OpenClaw значительно лучше** |
| **CRM** | Twenty, Zoho — глубокая интеграция (lookup, write-back, field mapping) | Нет встроенного CRM | **Flutch значительно лучше** (для sales) |
| **Инструменты** | MCP-совместимые tools через runtime HTTP клиент | 700+ community skills через ClawHub + browser control + shell + cron | **OpenClaw лучше** по количеству, **Flutch лучше** по архитектуре (MCP стандарт) |
| **LLM провайдеры** | OpenAI + Anthropic | OpenAI + Anthropic + Google + DeepSeek + локальные (Ollama) | **OpenClaw лучше** |

---

## 3. Бизнес-функциональность

| Аспект | Flutch | OpenClaw | Вердикт |
|--------|--------|----------|---------|
| **CRM-интеграция** | Полная: lookup контактов, фильтрация полей, write-back | Отсутствует нативно (возможна через skills) | **Flutch** |
| **Sales workflow** | Встроенный: load_context → generate → exec_tools → save_context | Нет специализированного | **Flutch** |
| **Knowledge Base** | pgvector, CRUD для статей, векторный поиск | Markdown-файлы + SQLite vector | **Flutch лучше** — production-grade |
| **Админка** | Полная: dashboard, управление агентами, KB, пользователями, JWT-auth | CLI + Markdown конфиги | **Flutch лучше** |
| **Аналитика** | Dashboard (пользователи, разговоры, KB usage) + LangFuse трейсинг | Базовый usage tracking (токены/стоимость) | **Flutch лучше** |
| **Multi-agent** | Несколько агентов с разными конфигурациями | Один агент с session routing | **Flutch лучше** |

---

## 4. Зрелость и качество кода

| Аспект | Flutch | OpenClaw | Вердикт |
|--------|--------|----------|---------|
| **Возраст проекта** | Молодой (v0.6.0) | Зрелый (20k+ коммитов, 3 ветки стабильности) | **OpenClaw** |
| **Тесты** | 41 spec-файл, unit + e2e + frontend (89% coverage) | Vitest, stable/beta/dev ветки, `openclaw doctor` | **Паритет** |
| **Error handling** | Try-catch во всех узлах графа, graceful fallback | Serialized execution, rate limiting | **Паритет** |
| **Безопасность** | NestJS guards, JWT auth, валидация DTO | Скандалы с безопасностью: 21k+ открытых инстансов, 26% skills с уязвимостями, supply chain атака | **Flutch лучше** |
| **Документация** | README, TESTING.md, CHANGELOG, API decorators | Обширная wiki, AGENTS.md, SOUL.md, community docs | **OpenClaw лучше** по объёму |

---

## 5. Deployment и инфраструктура

| Аспект | Flutch | OpenClaw | Вердикт |
|--------|--------|----------|---------|
| **Режим** | Docker Compose, standalone или connected (к платформе) | Локальный daemon (launchd/systemd), Docker, 1-Click Deploy | **Паритет** |
| **БД** | PostgreSQL 16 + pgvector | Файлы (Markdown) + SQLite | **Flutch лучше** — production-grade |
| **Мониторинг** | LangFuse + Prometheus + Promtail/Loki | Базовый cost tracking | **Flutch лучше** |
| **Конфигурация** | JSON-схемы, .env, agents.json или Platform API | Markdown файлы (AGENTS.md, SOUL.md, TOOLS.md) | **Flutch** — более структурировано; **OpenClaw** — проще для non-dev |

---

## Итоговая оценка

| Критерий | Flutch | OpenClaw |
|----------|--------|----------|
| Архитектура агента | ★★★★★ | ★★★☆☆ |
| Бизнес-специализация (Sales/CRM) | ★★★★★ | ★☆☆☆☆ |
| Экосистема интеграций | ★★☆☆☆ | ★★★★★ |
| Зрелость проекта | ★★★☆☆ | ★★★★★ |
| Безопасность | ★★★★☆ | ★★☆☆☆ |
| Production-readiness (multi-tenant) | ★★★★★ | ★★☆☆☆ |
| Простота развёртывания | ★★★☆☆ | ★★★★★ |
| Community / Adoption | ★☆☆☆☆ | ★★★★★ |

---

## Ключевые выводы

### Flutch сильнее в:

- **Структурированные бизнес-workflow** — граф с LangGraph vs простой цикл
- **CRM-интеграция** — ключевое конкурентное преимущество, у OpenClaw этого нет
- **Multi-tenant архитектура** — Flutch обслуживает много агентов/пользователей, OpenClaw — один
- **Production-grade инфраструктура** — PostgreSQL, checkpointing, LangFuse, админка
- **Безопасность** — OpenClaw имел серьёзные инциденты

### OpenClaw сильнее в:

- **Экосистема** — 20+ мессенджеров, 700+ skills, огромное community
- **Простота для конечного пользователя** — Markdown-конфиги, curl-установка
- **Универсальность** — personal assistant для любых задач (файлы, браузер, cron, email)
- **Зрелость** — 20k коммитов, 3 ветки стабильности, масса документации

### Главный вывод

Это **разные продукты для разных задач**. Flutch — это специализированный B2B sales engine с графовой архитектурой, CRM и multi-tenancy. OpenClaw — универсальный personal AI assistant с огромной экосистемой каналов. Архитектура Flutch (LangGraph + NestJS + PostgreSQL) объективно более зрелая для enterprise/B2B, а OpenClaw выигрывает за счёт community, количества интеграций и простоты использования для индивидуальных пользователей.

---

## Источники

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw — Personal AI Assistant](https://openclaw.ai/)
- [What Is OpenClaw? - MindStudio](https://www.mindstudio.ai/blog/what-is-openclaw-ai-agent)
- [What is OpenClaw? - DigitalOcean](https://www.digitalocean.com/resources/articles/what-is-openclaw)
- [OpenClaw — Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
