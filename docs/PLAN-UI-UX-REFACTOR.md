# План UI/UX рефакторинга и стабилизации админки (Vidya Admin & @vidya/ui)

> **Цель:** Устранить визуальную нестабильность (Layout Shift, «прыжки» элементов при вводе и смене состояний), интегрировать неиспользуемые компоненты (`Avatar`, `Breadcrumbs`, `TableToolbar`, `Separator`), исправить дефекты в базовых контролах, привести дизайн-систему `@vidya/ui` и экраны `modules/apps/admin` в соответствие с Google Material Design 3 (M3) Enterprise Guidelines и Vue 3 UI Kit Best Practices.

---

## 1. Диагностика проблем и источники Layout Shift («почему всё скачет»)

| Компонент / Место | Файл / Код | Диагноз и визуальный дефект | Решение по Best Practice |
|---|---|---|---|
| **Инлайн-редактор текста уроков** | [`TextBlockEditor.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/features/edit-lesson-content/ui/TextBlockEditor.vue#L53-L80) | При клике на параграф Markdown-текст резко заменяется на `<Textarea :rows="8">` + подсказку `<p>`. При потере фокуса (`blur`) всё схлопывается обратно. Блок скачет по высоте на 200–300px, весь экран и скролл дергаются. | Внедрить `useTextareaAutosize` / `field-sizing: content` без фиксации `rows="8"`. Убрать схлопывание/разворачивание на каждый `blur` — контейнер сохраняет стабильные отступы и высоту. |
| **Тулбар редактора урока** | [`EditorToolbar.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/widgets/lesson-editor/ui/EditorToolbar.vue#L63-L97) | Бейдж `<Badge v-if="props.dirty">` смонтирован прямо перед табами и кнопками в общем flex. При первой же букве в редакторе бейдж появляется и толкает все кнопки вправо на 80px. При сохранении исчезает и кнопки прыгают влево. | Разделить тулбар на 3 фиксированные зоны (Start, Center, End). Бейджи статуса вынести в отдельный слот с зарезервированной шириной. |
| **Скелетон загрузки таблиц** | [`Table.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Table/Table.vue#L62-L65) | При `loading: true` рендерится карточка `div` с 1 строкой и 4 сплошными блоками. После загрузки карточка заменяется на `<table>` с колонками. Полная смена геометрии и прыжок страницы. | Скелетон должен рендерить настоящую `<table>` с `colgroup`, `thead` и `tbody`, где ячейки `td` содержат скелетон-полосы нужной ширины. |
| **Геометрия переключателя Switch** | [`Switch/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Switch/styles.ts#L3-L20) | Трек шириной 32px (`--space-6`), кругляшок 12px (`--space-3`), сдвиг `translate-x-[var(--space-2)]` = 8px. В активном состоянии кругляшок доезжает только до 20px, оставляя 10px пустоты справа. | Задать сдвиг `translate-x-[14px]` (или `translate-x-[calc(var(--space-6)-var(--space-3)-4px)]`). |
| **Смещение Checkbox** | [`Checkbox/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Checkbox/styles.ts#L3-L6) | Захардкожен `mt-[var(--space-1)]` (4px). При однострочном лейбле чекбокс висит ниже текста, при многострочном — сползает. | Использовать `items-center` для 1-строчных чекбоксов или `mt-[2px]` с фиксированным line-height. |
| **Сайдбар в AppShell** | [`AppShell/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/widgets/app-shell/ui/styles.ts#L8-L16) | Сайдбару в приложении не задан `h-screen sticky top-0 overflow-y-auto`. При прокрутке длинных списков или документов навигация уезжает вверх. | Зафиксировать сайдбар (`h-screen sticky top-0 overflow-y-auto`). |
| **Селектор школы** | [`SchoolSwitcher.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/widgets/school-switcher/ui/SchoolSwitcher.vue#L40) | Использован нативный HTML `<select>`, который выбивается визуально из дизайн-системы. | Перевести на компонент `<Select>` из `@vidya/ui`. |
| **Шрифты и моноширинный стек** | [`tokens.css`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/styles/tokens.css#L82-L84) | `--font-mono: var(--font-sans);` — моноширинный шрифт отключен. `--font-sans` ссылается на `Noto Sans`, который не подключен в `index.html`. | Добавить качественный стек системных шрифтов и полноценный моноширинный стек (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`). |
| **Спам TooltipProvider** | [`IconButton.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Button/IconButton.vue#L50) | Каждая кнопка внутри каждой строки таблицы создает свой экземпляр `<TooltipProvider>`. Тултипы мигают с отдельными задержками при движении мыши по строке. | Вынести глобальный `<TooltipProvider>` в корень `App.vue`. |
| **Табы в тулбарах** | [`Tabs/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Tabs/styles.ts#L3-L20) | `Tabs` имеет нижнюю границу во всю ширину `border-b border-[var(--color-border)]`. При вставке в шапку редактора линия висит посреди тулбара. | Добавить вариант `Tabs` — `variant="segmented"` (пилюля/переключатель в виде сплошного контейнера без висящей линии) для тулбаров. |
| **Клик по Breadcrumbs** | [`Breadcrumbs.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Breadcrumbs/Breadcrumbs.vue#L39) | Тег `<a :href="item.href" @click="onSelect(item.key)">` без `.prevent` вызывает перезагрузку страницы браузером. | Добавить `@click.prevent` или поддержку vue-router `to`. |

---

## 2. Аудит и интеграция неиспользуемых компонентов (@vidya/ui)

| Компонент | Текущее использование | Где и как использовать в админке для улучшения UI/UX |
|---|---|---|
| **`Avatar`** | `0 мест` (не используется) | 1. **Таблица пользователей ([`UsersTableRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/users/ui/UsersTableRow.vue)):** Аватар с инициалами студента/преподавателя рядом с именем.<br>2. **Карточка пользователя ([`UserCardPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/users/ui/UserCardPage.vue)):** Крупный аватар в шапке профиля.<br>3. **Очередь и проверка ДЗ ([`HomeworkQueueRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/homework-queue/ui/HomeworkQueueRow.vue), [`HomeworkWork.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/homework-review/ui/HomeworkWork.vue)):** Аватар автора работы.<br>4. **Список участников групп ([`GroupMemberRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/groups/ui/GroupMemberRow.vue)) и заявок ([`EnrollmentsTableRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/enrollments/ui/EnrollmentsTableRow.vue)).**<br>5. **Подвал сайдбара ([`AppShell.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/widgets/app-shell/ui/AppShell.vue)):** Аватар текущего залогиненного оператора. |
| **`Breadcrumbs`** | `0 мест` (не используется) | **На всех вложенных страницах (в слоте `#breadcrumbs` у `PageHeader`):**<br>1. *Курсы $\rightarrow$ Уроки $\rightarrow$ Редактор урока* ([`LessonEditorPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/lesson-editor/ui/LessonEditorPage.vue)).<br>2. *Группы $\rightarrow$ Состав группы* ([`GroupMembersPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/groups/ui/GroupMembersPage.vue)).<br>3. *Пользователи $\rightarrow$ Карточка пользователя* ([`UserCardPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/users/ui/UserCardPage.vue)).<br>4. *Очередь ДЗ $\rightarrow$ Проверка работы* ([`HomeworkReviewPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/homework-review/ui/HomeworkReviewPage.vue)). |
| **`TableToolbar`** | `0 мест` (не используется) | **Единый тулбар над таблицами:** Поиск с debounce, чипсы фильтрации и действия на страницах `UsersPage`, `EnrollmentsPage`, `LessonsPage`, `HomeworkQueuePage`. Устраняет разнобой стилей фильтрации. |
| **`Separator`** | `0 мест` (не используется) | Разделители между логическими блоками в формах редактирования школы, ролей, пользователя и в сайдбаре. |
| **`Card`** | `1 место` | Структурирование сводки на `DashboardPage`, блок задания в `HomeworkWork.vue`, блок информации в `UserFacts.vue`. |

---

## 3. Архитектура стандартов (Vue 3 + Tailwind 4 + Reka UI + Storybook)

### 3.1. Токены (3-уровневая система)
1. **Global Tokens:** базовые палитры (нейтральная, акцентная, статусные), шкала отступов 4px (4, 8, 12, 16, 24, 32, 48, 64px), радиусы, тени.
2. **Semantic Tokens:** смысловые роли (`--color-surface`, `--color-page`, `--color-primary`, `--color-danger-fg`).
3. **Component Tokens:** строгие высоты контролов (`--control-sm: 28px`, `--control-md: 32px`, `--control-lg: 36px`), высота строк таблицы (`--row-height: 44px`).

### 3.2. Требования к Storybook (Component-Driven)
Каждый компонент в Storybook обязан демонстрировать матрицу состояний:
* `Default` (базовое валидное состояние).
* `Hover / Focus / Active` (все интерактивные состояния).
* `Loading / Busy` (спиннер или скелетон без изменения внешних габаритов).
* `Disabled / Readonly` (чётко читаемые неактивные состояния).
* `Empty / Error` (для составных компонентов и страниц).

---

## 4. Детализированный план реализации (Пошаговые задачи)

### Фаза 1. Базовые примитивы и токены (`@vidya/ui`)
- [x] **1.1. Исправить шрифтовые токены и tabular-nums** в [`tokens.css`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/styles/tokens.css).
- [x] **1.2. Исправить геометрию Switch** в [`Switch/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Switch/styles.ts).
- [x] **1.3. Исправить выравнивание Checkbox** в [`Checkbox/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Checkbox/styles.ts) и [`Checkbox.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Checkbox/Checkbox.vue).
- [x] **1.4. Добавить сегментный вариант в Tabs** в [`Tabs/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Tabs/styles.ts) и [`Tabs.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Tabs/Tabs.vue).
- [x] **1.5. Переписать Skeleton-состояние Table** в [`Table.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Table/Table.vue).
- [x] **1.6. Починить клик в Breadcrumbs** в [`Breadcrumbs.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Breadcrumbs/Breadcrumbs.vue) (добавить `@click.prevent`).
- [x] **1.7. Оптимизировать TooltipProvider** в [`Tooltip.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/libs/ui/src/components/Tooltip/Tooltip.vue) (skipDelayDuration=300 для моментального отклика при ховере соседних иконок).

---

### Фаза 2. Интеграция компонентов в админку и фиксация каркаса
- [x] **2.1. Зафиксировать Sidebar в AppShell** в [`AppShell/styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/widgets/app-shell/ui/styles.ts).
- [x] **2.2. Внедрить Аватары (`Avatar`)**:
  - В строках таблицы пользователей ([`UsersTableRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/users/ui/UsersTableRow.vue)).
  - В карточке пользователя ([`UserCardPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/users/ui/UserCardPage.vue)).
  - В списке участников групп ([`GroupMemberRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/groups/ui/GroupMemberRow.vue)).
  - В очереди и ревью домашних работ ([`HomeworkQueueRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/homework-queue/ui/HomeworkQueueRow.vue), [`HomeworkWork.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/homework-review/ui/HomeworkWork.vue)).
  - В таблице заявок на зачисление ([`EnrollmentsTableRow.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/enrollments/ui/EnrollmentsTableRow.vue)).
- [x] **2.3. Внедрить Хлебные крошки (`Breadcrumbs`)**:
  - На странице уроков курса ([`LessonsPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/lessons/ui/LessonsPage.vue)).
  - В карточке пользователя ([`UserCardPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/users/ui/UserCardPage.vue)).
  - В составе группы ([`GroupMembersPage.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/pages/groups/ui/GroupMembersPage.vue)).

---

### Фаза 3. Стабилизация редактора уроков и форм
- [x] **3.1. Устранить скачки высоты в TextBlockEditor** в [`TextBlockEditor.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/features/edit-lesson-content/ui/TextBlockEditor.vue) (динамический расчет строк по контенту).
- [x] **3.2. Стабилизировать EditorToolbar** в [`EditorToolbar.vue`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/widgets/lesson-editor/ui/EditorToolbar.vue) (сегментный вариант табов `variant="segmented"`).
- [x] **3.3. Стабилизировать QuizBlockEditor & QuizAnswerRow** в [`styles.ts`](file:///home/akd/Projects/jiva-studio/vidya/source/vidya-admin/modules/apps/admin/src/features/edit-lesson-content/ui/styles.ts) (зарезервированная ширина 28px для слота кнопки удаления).

---

### Фаза 4. Storybook тесты и визуальная верификация
- [x] **4.1. Обновить stories для всех базовых компонентов `@vidya/ui`** (добавлен `Segmented` story для `Tabs`, проверены все состояния).
- [x] **4.2. Обновить и проверить stories для экранов админки**.
- [x] **4.3. Полный регрессионный прогон тестов**:
  - `npm test` во всех модулях: **100% passed** (53/53 test files, 376/376 tests в админке; 6/6 test files, 25/25 tests в ui-lib).
  - `npm run build-storybook`: **успешно**.
  - `npm run build`: **успешно**.
