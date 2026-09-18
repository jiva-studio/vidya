# Тексты редактора урока. Владелец — T5.

editor-title = Редактор урока
editor-back = К урокам
editor-save = Сохранить черновик
editor-publish = Опубликовать
editor-new-revision = Новая версия
editor-unsaved = Есть несохранённые правки
editor-retry = Повторить

version-title = Версия урока
version-subtitle = Опубликованную версию изменить нельзя.
version-back = Назад

editor-state-draft = Черновик v{ $version }
editor-state-published = Опубликована v{ $version }

editor-no-versions = У этого урока нет ни одной версии.
editor-load-failed = Не удалось загрузить содержимое урока.
editor-save-failed = Не удалось сохранить черновик.
editor-publish-failed = Не удалось опубликовать версию.
editor-revision-failed = Не удалось начать новую версию.

# Письмо или чтение

editor-mode-label = Режим
editor-mode-write = Редактирование
editor-mode-read = Чтение

# Секции

editor-sections-label = Секции
editor-sections-empty-title = В уроке пока ничего нет
editor-sections-empty-body = Добавьте первую секцию ниже и начните писать.
editor-section-add = Добавить секцию
editor-section-untitled = Секция без названия
editor-section-up = Переместить секцию выше
editor-section-down = Переместить секцию ниже
editor-section-remove = Удалить секцию
editor-section-title-label = Название секции

editor-section-remove-title = Удалить секцию?
editor-section-remove-body = Уже сданные по этой секции работы потеряют привязку.
editor-section-remove-submit = Удалить секцию
editor-section-remove-cancel = Оставить

# Домашняя работа. Заданием служит сама секция: отдельного поля для текста
# задания в документе нет, поэтому спрашиваем, нужна ли работа и кто её проверит.

editor-homework-label = Домашняя работа
editor-homework-none = Не задаётся
editor-homework-auto = Задаётся, проверяется автоматически
editor-homework-teacher = Задаётся, проверяет преподаватель
editor-homework-note = Отдельного поля для задания нет — сформулируйте его в тексте секции.

# Блоки

editor-block-text = Текст
editor-block-video = Видео
editor-block-audio = Аудио
editor-block-quiz = Вопрос
editor-block-add = Добавить блок
editor-block-up = Переместить блок «{ $block }» выше
editor-block-down = Переместить блок «{ $block }» ниже
editor-block-remove = Удалить блок «{ $block }»
editor-blocks-empty-body = В этой секции ничего нет.

editor-block-unknown = Неизвестный блок
editor-block-unknown-title = Эта админка не умеет показывать блок «{ $type }».
editor-block-unknown-body = Здесь его не отредактировать, и пока он в уроке, урок не сохранить.

editor-text-label = Текст урока
editor-text-edit = Редактировать текст
editor-text-hint = Markdown: # заголовок, **жирный**, *курсив*, - список, [ссылка](https://example.org), > цитата.
editor-text-placeholder = Наберите текст урока здесь.

editor-source-label = Источник
editor-source-url = Прямая ссылка
editor-source-youtube = YouTube
editor-source-vimeo = Vimeo
editor-source-upload = Загруженный файл
editor-url-label = Ссылка
editor-url-hint = Адрес по http или https.
editor-poster-label = Обложка

editor-quiz-question-label = Вопрос
editor-quiz-question-placeholder = О чём спрашиваете?
editor-quiz-answers-label = Варианты ответа
editor-quiz-answers-hint = Отметьте правильный вариант.
editor-quiz-answer-label = Вариант { $number }
editor-quiz-answer-placeholder = Текст варианта
editor-quiz-answer-add = Добавить вариант
editor-quiz-answer-remove = Убрать вариант { $number }
editor-quiz-right-answer = Отметить вариант { $number } правильным

# Отклонённые ссылки

url-required = Укажите ссылку.
url-malformed = Не похоже на адрес. Например: https://example.org/video
url-scheme = Принимаются только ссылки http и https.
url-host = Встраивать можно только с YouTube или Vimeo.

# Содержимое, которое эта сборка не умеет редактировать

editor-problems-title = Этот урок нельзя сохранить
editor-problem-schema-version = Урок создан в более новой версии админки (схема { $detail }). Сохранение здесь его испортит.
editor-problem-unknown-block = В уроке есть блок, который эта версия админки не умеет показывать ({ $detail }). Сохранение его удалит.

# Чтение

editor-preview-title = Как читает студент
editor-preview-embed-title = Встроенное медиа
editor-preview-media-missing = Пока нет ссылки, которую можно воспроизвести.
editor-preview-quiz-empty = Вопрос ещё не задан.
editor-preview-quiz-right = правильный ответ
editor-preview-unknown = Неизвестный блок вида { $type }.

# Уход с несохранёнными правками

editor-unsaved-title = Уйти без сохранения?
editor-unsaved-body = Несохранённые правки будут потеряны.
editor-unsaved-leave = Уйти
editor-unsaved-stay = Остаться

# Публикация

publish-confirm-title = Опубликовать эту версию?
publish-confirm-body = Версию { $version } начнут читать студенты. Изменить её потом нельзя — только создать новую.
publish-confirm-submit = Опубликовать
publish-confirm-cancel = Отмена
