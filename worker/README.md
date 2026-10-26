# Cloudflare Worker — Синхронизация Ежедневника

Воркер обеспечивает синхронизацию данных между телефоном и ПК через Cloudflare KV.

## 1. Предварительные требования

- Установленный Node.js и npm
- Cloudflare аккаунт (бесплатный тариф)
- Установленный Wrangler CLI:
  ```bash
  npm install -g wrangler
  ```
- Авторизация в Cloudflare:
  ```bash
  wrangler login
  ```

## 2. Создание KV Namespace

Создайте KV namespace для хранения состояния:

```bash
wrangler kv:namespace create STATE_KV
```

Команда выведет `id` созданного пространства имен. Скопируйте его и вставьте в `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "STATE_KV"
id = "<ВАШ_KV_NAMESPACE_ID>"
```

*(Опционально)* Для локальной разработки:
```bash
wrangler kv:namespace create STATE_KV --preview
```
и добавьте полученный id в поле `preview_id`.

## 3. Установка секретного ключа

Задайте секретный ключ авторизации `SYNC_SECRET` (произвольная надежная строка):

```bash
wrangler secret put SYNC_SECRET
```
*Введите ваш секрет при запросе в терминале.*

## 4. Деплой

Выполните деплой воркера:

```bash
wrangler deploy
```

После завершения Wrangler выведет URL опубликованного воркера, например:
`https://diary-sync.<ваш-поддомен>.workers.dev`

## 5. Подключение в приложении

1. Откройте «Ежедневник» на телефоне или ПК.
2. Перейдите в экран **«Настройки»** -> секция **«Синхронизация»**.
3. В поле **URL воркера** укажите: `https://diary-sync.<ваш-поддомен>.workers.dev/state`
4. В поле **Секретный ключ** укажите то же значение, что задали в `SYNC_SECRET`.
5. Нажмите **«Сохранить»**, затем **«Синхронизировать сейчас»**.
