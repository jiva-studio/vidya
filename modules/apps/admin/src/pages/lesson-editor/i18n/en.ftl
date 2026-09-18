# Texts for the lesson editor. Owned by T5.

editor-title = Lesson editor
editor-subtitle = Sections on the left, their blocks on the right, the student's view below
editor-back = Back to lessons
editor-save = Save draft
editor-publish = Publish
editor-new-revision = New revision
editor-unsaved = Unsaved changes
editor-retry = Try again

editor-state-draft = Draft v{ $version }
editor-state-published = Published v{ $version }

editor-no-versions = This lesson has no versions to open.
editor-load-failed = The lesson content could not be loaded.
editor-save-failed = The draft could not be saved.
editor-publish-failed = The version could not be published.
editor-revision-failed = A new revision could not be started.

# Sections

editor-sections-label = Sections
editor-sections-empty-title = This lesson has no sections
editor-sections-empty-body = A section holds the blocks a student reads, and is what homework is attached to.
editor-sections-empty-action = Add the first section
editor-section-add = Add section
editor-section-new = New section
editor-section-untitled = Untitled section
editor-section-up = Move section up
editor-section-down = Move section down
editor-section-remove = Delete
editor-section-title-label = Section title
editor-no-section-title = No section selected
editor-no-section-body = Add a section to start writing this lesson.

editor-section-remove-title = Delete this section?
editor-section-remove-body = Homework is submitted against a section. The server does not refuse this today, so answers already given for this section may be left pointing at nothing once the draft is saved.
editor-section-remove-submit = Delete section
editor-section-remove-cancel = Keep it

editor-assessment-label = Homework
editor-assessment-hint = Whether this section asks for work, and who marks it.
editor-assessment-none = None
editor-assessment-auto = Marked automatically
editor-assessment-teacher = Marked by a teacher

# Blocks

editor-block-text = Text
editor-block-video = Video
editor-block-audio = Audio
editor-block-quiz = Quiz
editor-block-add-text = Add text
editor-block-add-video = Add video
editor-block-add-audio = Add audio
editor-block-add-quiz = Add quiz
editor-block-up = Move block up
editor-block-down = Move block down
editor-block-remove = Delete block
editor-blocks-empty-title = This section is empty
editor-blocks-empty-body = Add a block of text, video, audio or a quiz.
editor-blocks-empty-action = Add a text block

editor-text-label = Text
editor-text-hint = Markdown: # heading, **bold**, *italic*, - list, [link](https://example.org), > quote.
editor-text-placeholder = Write the lesson text here.

editor-source-label = Source
editor-source-url = Direct link
editor-source-youtube = YouTube
editor-source-vimeo = Vimeo
editor-source-upload = Uploaded file
editor-url-label = Link
editor-url-hint = An http or https address. There is no file upload yet.
editor-poster-label = Poster image
editor-poster-hint = Optional still shown before the video plays.

editor-quiz-question-label = Question
editor-quiz-answers-label = Answers
editor-quiz-answers-hint = Mark the right one. Deleting an answer moves the mark with it.
editor-quiz-answer-label = Answer { $number }
editor-quiz-answer-add = Add answer
editor-quiz-answer-remove = Remove
editor-quiz-right-answer = The right answer

# Links that were refused

url-required = A link is required.
url-malformed = This is not an address the browser can open.
url-scheme = Only http and https links are accepted.
url-host = An embed may only come from YouTube or Vimeo.

# Content this build cannot author

editor-problems-title = This lesson cannot be saved
editor-problem-schema-version = It was written by a newer version of the admin (schema { $detail }). Saving here would rewrite it with rules this build does not know.
editor-problem-unknown-block = It contains a block of an unknown kind ({ $detail }). Saving here would drop it.

# Preview

editor-preview-title = Preview
editor-preview-body = The same rendering the student's app uses.
editor-preview-embed-title = Embedded media
editor-preview-media-missing = No playable link yet.
editor-preview-quiz-empty = No question yet.
editor-preview-quiz-right = right answer
editor-preview-unknown = Unknown block of kind { $type }.

# Leaving with unsaved work

editor-unsaved-title = Leave without saving?
editor-unsaved-body = The edits on this screen exist nowhere else. Leaving now loses them.
editor-unsaved-leave = Leave and lose them
editor-unsaved-stay = Stay here

# Publishing

publish-confirm-title = Publish this version?
publish-confirm-body = Version { $version } becomes what students read, and is frozen: further edits need a new revision.
publish-confirm-submit = Publish
publish-confirm-cancel = Cancel
