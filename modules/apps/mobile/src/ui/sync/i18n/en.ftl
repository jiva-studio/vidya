# Submission state of an answer
sync-state-notSent = Not sent
sync-state-notSent-hint = Saved on this device. It goes out as soon as there is a connection.
sync-state-sending = Sending
sync-state-sending-hint = On its way to the school.
sync-state-accepted = Accepted
sync-state-accepted-hint = The school has your answer.
sync-state-rejected = Not accepted
sync-state-rejected-hint = The school did not take this answer.

# Why the school refused an answer
sync-rejection-title = The school did not accept this answer
sync-rejection-kept-on-device = Your work is saved on this device. Nothing has been lost.
sync-rejection-readOnlyCollection = This kind of record cannot be sent from the app.
sync-rejection-notYourEnrollment = The answer was addressed to an enrolment that is not yours.
sync-rejection-enrollmentRevoked = You are no longer enrolled on this course.
sync-rejection-scopeRevoked = The school took away your access, so this answer was never sent.
sync-rejection-unknownLessonVersion = The school does not know the lesson version this answer was written against.
sync-rejection-alreadyAccepted = An answer has already been accepted, so this one cannot replace it.
sync-rejection-underReview = A teacher has this work open, so it cannot be changed until they answer.
sync-rejection-courseNotOffered = The school is not taking students onto this course yet.
sync-rejection-payloadTooLarge = The answer is too long to be sent.
sync-rejection-malformed = The school could not read this answer.

# An answer whose lesson version has not arrived yet
sync-missing-lesson-version-title = The lesson has not arrived yet
sync-missing-lesson-version-text = The lesson this answer belongs to is still on its way to the device. Your answer is here and is shown below.

# First run, filling the device with content
sync-backfill-title = Getting your courses ready
sync-backfill-text = They are being downloaded so they work without a connection.
sync-backfill-progress = { $done } of { $total }
sync-backfill-counting = Working out what to download

# A course the student was withdrawn from
sync-revoked-title = You are no longer enrolled
sync-revoked-text = The school ended your enrolment on { $course }.
sync-revoked-downloaded-stays = Everything already downloaded stays readable on this device.
sync-revoked-open-downloaded = Open what is downloaded

# A course the student handed back themselves
sync-withdrawn-title = You are no longer on this course
sync-withdrawn-text = You left { $course }.

# Lesson content this build does not understand
sync-outdated-app-title = Update the app to open this lesson
sync-outdated-app-text = This lesson was made with a newer version of Vidya. Nothing is lost, the app simply cannot draw it yet.
sync-outdated-app-update = Update the app

# Connection
sync-offline-title = Working offline
sync-offline-text = You can read everything you have downloaded and write answers. They go out when the connection is back.
sync-online-syncing = Syncing…
sync-online-synced = Up to date

# A school that stopped accepting this sign-in
sync-sign-in-again-title = Sign in again
sync-sign-in-again-text =
    { $schools ->
        [one] This school stopped accepting your sign-in. Until you sign in again, new lessons and courses will not arrive and applications will not be sent.
       *[other] { $schools } of your schools stopped accepting your sign-in. Until you sign in again, new lessons and courses from them will not arrive and applications will not be sent.
    }
sync-sign-in-again-downloaded-stays = Everything already downloaded opens and reads as usual.
sync-sign-in-again-action = Sign in again
