# Тексты раздела «lesson-editor». Владелец — T5.

editor-title = Редактор урока
editor-subtitle = Слева секции, справа их блоки, ниже — вид студента
editor-back = К урокам
editor-save = Сохранить черновик
editor-publish = Опубликовать
editor-new-revision = Новая редакция
editor-unsaved = Есть несохранённые правки
editor-retry = Повторить

version-title = Версия, по которой отвечали
version-subtitle = Опубликованная версия ровно в том виде, в каком её читал студент. Здесь ничего не редактируется.
version-back = Назад

editor-state-draft = Черновик v{ $version }
editor-state-published = Опубликована v{ $version }

editor-no-versions = У этого урока нет ни одной версии.
editor-load-failed = Не удалось загрузить содержимое урока.
editor-save-failed = Не удалось сохранить черновик.
editor-publish-failed = Не удалось опубликовать версию.
editor-revision-failed = Не удалось начать новую редакцию.

# Секции

editor-sections-label = Секции
editor-sections-empty-title = В уроке нет секций
editor-sections-empty-body = Секция содержит блоки, которые читает студент, и именно к ней привязана домашняя работа.
editor-sections-empty-action = Добавить первую секцию
editor-section-add = Добавить секцию
editor-section-new = Новая секция
editor-section-untitled = Секция без названия
editor-section-up = Переместить секцию выше
editor-section-down = Переместить секцию ниже
editor-section-remove = Удалить
editor-section-title-label = Название секции
editor-no-section-title = Секция не выбрана
editor-no-section-body = Добавьте секцию, чтобы начать писать урок.

editor-section-remove-title = Удалить секцию?
editor-section-remove-body = Домашние работы сдаются к секции. Сервер сегодня этого не запрещает, поэтому уже сданные по ней ответы после сохранения черновика могут остаться ни на что не указывающими.
editor-section-remove-submit = Удалить секцию
editor-section-remove-cancel = Оставить

editor-assessment-label = Домашняя работа
editor-assessment-hint = Просит ли секция работу и кто её проверяет.
editor-assessment-none = Не требуется
editor-assessment-auto = Проверяется автоматически
editor-assessment-teacher = Проверяет преподаватель

# Блоки

editor-block-text = Текст
editor-block-video = Видео
editor-block-audio = Аудио
editor-block-quiz = Вопрос
editor-block-add-text = Добавить текст
editor-block-add-video = Добавить видео
editor-block-add-audio = Добавить аудио
editor-block-add-quiz = Добавить вопрос
editor-block-up = Переместить блок выше
editor-block-down = Переместить блок ниже
editor-block-remove = Удалить блок
editor-blocks-empty-title = В секции нет блоков
editor-blocks-empty-body = Добавьте блок текста, видео, аудио или вопрос.
editor-blocks-empty-action = Добавить текстовый блок

editor-text-label = Текст
editor-text-hint = Markdown: # заголовок, **жирный**, *курсив*, - список, [ссылка](https://example.org), > цитата.
editor-text-placeholder = Наберите текст урока здесь.

editor-source-label = Источник
editor-source-url = Прямая ссылка
editor-source-youtube = YouTube
editor-source-vimeo = Vimeo
editor-source-upload = Загруженный файл
editor-url-label = Ссылка
editor-url-hint = Адрес по http или https. Загрузки файлов пока нет.
editor-poster-label = Обложка
editor-poster-hint = Необязательный кадр, который виден до запуска видео.

editor-quiz-question-label = Вопрос
editor-quiz-answers-label = Варианты ответа
editor-quiz-answers-hint = Отметьте правильный. При удалении варианта отметка переезжает вместе с ним.
editor-quiz-answer-label = Вариант { $number }
editor-quiz-answer-add = Добавить вариант
editor-quiz-answer-remove = Убрать
editor-quiz-right-answer = Правильный ответ

# Отклонённые ссылки

url-required = Нужна ссылка.
url-malformed = Браузер не сможет открыть такой адрес.
url-scheme = Принимаются только ссылки http и https.
url-host = Встраивать можно только с YouTube или Vimeo.

# Содержимое, которое эта сборка не умеет редактировать

editor-problems-title = Этот урок нельзя сохранить
editor-problem-schema-version = Он написан более новой версией админки (схема { $detail }). Сохранение здесь переписало бы его по правилам, которых эта сборка не знает.
editor-problem-unknown-block = В нём есть блок неизвестного вида ({ $detail }). Сохранение здесь его потеряет.

# Предпросмотр

editor-preview-title = Предпросмотр
editor-preview-body = Тот же рендеринг, что и в приложении студента.
editor-preview-embed-title = Встроенное медиа
editor-preview-media-missing = Пока нет ссылки, которую можно воспроизвести.
editor-preview-quiz-empty = Вопрос ещё не задан.
editor-preview-quiz-right = правильный ответ
editor-preview-unknown = Неизвестный блок вида { $type }.

# Уход с несохранёнными правками

editor-unsaved-title = Уйти без сохранения?
editor-unsaved-body = Правки на этом экране больше нигде не существуют. Уход сейчас их потеряет.
editor-unsaved-leave = Уйти и потерять
editor-unsaved-stay = Остаться

# Публикация

publish-confirm-title = Опубликовать эту версию?
publish-confirm-body = Версия { $version } станет тем, что читают студенты, и будет заморожена: дальнейшие правки требуют новой редакции.
publish-confirm-submit = Опубликовать
publish-confirm-cancel = Отмена
