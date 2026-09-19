# Тексты редактора урока. Владелец — T5.

editor-title = Редактор урока
editor-publish = Опубликовать
editor-new-revision = Новая версия
editor-retry = Повторить

version-title = Версия урока
version-subtitle = Опубликованную версию изменить нельзя.
version-back = Назад

editor-state-draft = Черновик
editor-state-published = Опубликовано

editor-no-versions = У этого урока нет ни одной версии.
editor-load-failed = Не удалось загрузить содержимое урока.
editor-save-failed = Не удалось сохранить черновик.
editor-publish-failed = Не удалось опубликовать версию.
editor-revision-failed = Не удалось начать новую версию.

# Письмо или чтение

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

editor-homework-placeholder = Нужна ли работа?
editor-homework-label = Домашняя работа
editor-homework-none = Не задаётся
editor-homework-auto = Задаётся, проверяется автоматически
editor-homework-teacher = Задаётся, проверяет преподаватель
editor-homework-note = Отдельного поля для задания нет — сформулируйте его в тексте секции

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
editor-text-hint = Markdown: # заголовок, **жирный**, *курсив*, - список, [ссылка](https://example.org), > цитата
editor-text-placeholder = Наберите текст урока здесь.

editor-source-placeholder = Выберите источник
editor-source-label = Источник
editor-source-hint = YouTube и Vimeo принимают ссылки только со своих сайтов
editor-source-url = Прямая ссылка
editor-source-youtube = YouTube
editor-source-vimeo = Vimeo
editor-source-upload = Загруженный файл
editor-url-label = Ссылка
editor-url-hint = Адрес по http или https
editor-poster-label = Обложка
editor-poster-hint = Ссылка на картинку — её видно до запуска видео

editor-quiz-question-label = Вопрос
editor-quiz-question-placeholder = О чём спрашиваете?
editor-quiz-answers-label = Варианты ответа
editor-quiz-answers-hint = Отметьте правильный вариант
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

# Файлы в медиа-блоке

editor-media-refused-image = В этот блок можно положить только изображение.
editor-media-refused-video = В этот блок можно положить только видео.
editor-media-refused-audio = В этот блок можно положить только аудио.
editor-media-uploading = Загрузка
editor-media-cancel = Отмена
editor-media-retry = Повторить
editor-media-uploaded = { $name } загружен
editor-media-replace = Заменить
editor-media-caption-label = Подпись
editor-media-caption-hint = Показывается под файлом. Необязательно.
editor-media-preview-alt = Загруженный файл
editor-media-unavailable = Пока недоступно. Загруженные здесь файлы живут только до перезагрузки страницы.

# Выбор файла

media-picker-title = Выберите файл
media-picker-close = Закрыть
media-picker-tab-upload = Загрузка
media-picker-tab-library = Библиотека
media-picker-tab-link = Ссылка
media-picker-drop-label = Перетащите файл сюда
media-picker-search = Поиск по названию
media-picker-empty-title = Здесь пока пусто
media-picker-empty-body = Загрузите файл или поищите по другому названию.
media-picker-failed-title = Не удалось прочитать библиотеку
media-picker-retry = Повторить
media-picker-link-label = Ссылка
media-picker-link-hint = YouTube, Vimeo или прямая ссылка на файл
media-picker-link-submit = Использовать ссылку

# Медиа, которое не удалось сохранить

media-upload-failed = Не удалось загрузить файл.
media-upload-cancelled = Загрузка остановлена.
media-unavailable = Файлы пока негде хранить.
editor-block-image = Изображение
editor-block-menu = Действия с блоком
editor-block-add-here = Добавить блок здесь
editor-block-search = Найти блок
editor-block-none = Блок с таким названием не найден
editor-section-menu = Действия с разделом
editor-move-up = Вверх
editor-move-down = Вниз
editor-duplicate = Дублировать
editor-delete = Удалить
# Вопрос
editor-quiz-explanation-label = Пояснение
editor-quiz-explanation-placeholder = Почему ответ именно такой? Покажем после ответа.
# Сохранение

editor-status-saving = Сохраняем…
editor-status-saved = Сохранено
editor-status-failed = Не сохранено
editor-save-retry = Сохранить ещё раз

# Незаполненные блоки

editor-faults-title = Эту версию пока нельзя опубликовать
editor-fault-block = Раздел { $section }, блок { $position } не заполнен.

editor-media-add-image = Добавить изображение
editor-media-add-video = Добавить видео
editor-media-add-audio = Добавить аудио
editor-media-drop-hint-image = PNG, JPG, GIF или SVG
editor-media-drop-hint-video = MP4, WebM или MOV
editor-media-drop-hint-audio = MP3, WAV или OGG
editor-media-browse = Выбрать файл
