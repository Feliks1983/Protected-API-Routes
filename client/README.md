Решение о праве собственности / IDOR
Во избежание утечки информации о существовании ресурса:

В случае, если пользователь пытается получить доступ к задаче другого пользователя, следует вернуть код ошибки 404 (рекомендуется), а не 403.

0) Запустите сервер
npm install
npm run dev
1) Войдите в систему как обычный пользователь (получите токен доступа).
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"user@example.com","password":"Password123!"}'
Ожидал:

200
тело содержит accessToken+refreshToken
2) Попробуйте использовать защищенные задачи без токена (должно не сработать).
curl -i http://localhost:3000/api/protected/todos
Ожидал:

401
3) Создайте задачу (требуется подтвержденный адрес электронной почты)
curl -i -X POST http://localhost:3000/api/protected/todos \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Buy milk","priority":"low"}'
Ожидал:

Если адрес электронной почты не подтвержден → 403сEMAIL_NOT_VERIFIED
Если подтверждено → 201с созданным списком дел
4) Составьте список дел.
curl -s "http://localhost:3000/api/protected/todos?page=1&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
Ожидал:

200только ваши дела
5) Проверка права собственности (IDOR) — попытка обновить чужой список задач
curl -i -X PUT http://localhost:3000/api/protected/todos/<SOMEONE_ELSE_TODO_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text":"hacked"}'
Ожидал:

404(рекомендуется избегать утечки информации о существовании)
6) Необходимо получить доступ к административной панели от имени пользователя (должно завершиться ошибкой).
curl -i http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
Ожидал:

403
7) Войдите в систему как администратор и просмотрите список пользователей.
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"admin@example.com","password":"Admin123!"}'
Затем:

curl -s "http://localhost:3000/api/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"
Ожидал:

200
В выходных данных отсутствуют конфиденциальные поля.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Lint all JavaScript/TypeScript files

npx eslint .

# Fix auto-fixable issues

npx eslint --fix .

# Lint specific file

npx eslint src/index.js

npm install --save-dev --save-exact prettier

# Format all files

npx prettier --write .

# Check formatting without making changes

npx prettier --check .

# Format specific file

npx prettier --write src/index.js

Во избежание конфликтов между ESLint и Prettier настройте надлежащую интеграцию:
npm install --save-dev eslint-config-prettier eslint-plugin-prettier

npm install --save-dev husky lint-staged
npx lint-staged
