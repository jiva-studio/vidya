# Состояние отправки ответа
sync-state-notSent = Не отправлено
sync-state-notSent-hint = Сохранено на устройстве. Уйдёт, как только появится связь.
sync-state-sending = Отправляется
sync-state-sending-hint = Ответ идёт в школу.
sync-state-accepted = Принято
sync-state-accepted-hint = Школа получила ваш ответ.
sync-state-rejected = Не принято
sync-state-rejected-hint = Школа не приняла этот ответ.

# Почему школа отклонила ответ
sync-rejection-title = Школа не приняла этот ответ
sync-rejection-kept-on-device = Ваша работа сохранена на устройстве. Ничего не потеряно.
sync-rejection-readOnlyCollection = Такие записи нельзя отправлять из приложения.
sync-rejection-notYourEnrollment = Ответ адресован чужой записи на курс.
sync-rejection-enrollmentRevoked = Вы больше не записаны на этот курс.
sync-rejection-scopeRevoked = Школа сняла с вас доступ, поэтому ответ не был отправлен.
sync-rejection-unknownLessonVersion = Школа не знает версию урока, по которой написан ответ.
sync-rejection-alreadyAccepted = Ответ уже принят, заменить его новым нельзя.
sync-rejection-payloadTooLarge = Ответ слишком длинный, чтобы его отправить.
sync-rejection-malformed = Школа не смогла прочитать этот ответ.

# Ответ, версия урока которого ещё не приехала
sync-missing-lesson-version-title = Урок ещё не приехал
sync-missing-lesson-version-text = Урок, к которому относится ответ, ещё идёт на устройство. Ваш ответ на месте и показан ниже.

# Первый запуск, устройство наполняется содержимым
sync-backfill-title = Готовим ваши курсы
sync-backfill-text = Они скачиваются, чтобы работать без связи.
sync-backfill-progress = { $done } из { $total }
sync-backfill-counting = Считаем, что нужно скачать

# Курс, с которого студента отчислили
sync-revoked-title = Вы больше не записаны
sync-revoked-text = Школа завершила вашу запись на курс «{ $course }».
sync-revoked-downloaded-stays = Всё уже скачанное остаётся доступным для чтения на устройстве.
sync-revoked-open-downloaded = Открыть скачанное

# Курс, с которого студент ушёл сам
sync-withdrawn-title = Вы больше не на этом курсе
sync-withdrawn-text = Вы ушли с курса «{ $course }».

# Содержимое урока, которого эта сборка не понимает
sync-outdated-app-title = Обновите приложение, чтобы открыть урок
sync-outdated-app-text = Урок сделан в более новой версии Vidya. Ничего не потеряно, приложение просто пока не умеет его отрисовать.
sync-outdated-app-update = Обновить приложение

# Связь
sync-offline-title = Работаем офлайн
sync-offline-text = Можно читать всё скачанное и писать ответы. Они уйдут, когда вернётся связь.
sync-online-syncing = Синхронизация…
sync-online-synced = Всё актуально

# Школа, которая перестала принимать этот вход
sync-sign-in-again-title = Нужно войти снова
sync-sign-in-again-text =
    { $schools ->
        [one] Школа перестала принимать этот вход. Пока вы не войдёте заново, новые уроки и курсы не приедут, а заявки не уйдут.
       *[other] { $schools } из ваших школ перестали принимать этот вход. Пока вы не войдёте заново, новые уроки и курсы оттуда не приедут, а заявки не уйдут.
    }
sync-sign-in-again-downloaded-stays = Всё уже скачанное открывается и читается как обычно.
sync-sign-in-again-action = Войти снова
