# Texts for the lesson editor. Owned by T5.

editor-title = Lesson editor
editor-publish = Publish
editor-new-revision = New version
editor-retry = Try again

version-title = Lesson version
version-subtitle = A published version cannot be edited.
version-back = Back

editor-state-draft = Draft
editor-state-published = Published

editor-no-versions = This lesson has no versions to open.
editor-load-failed = The lesson content could not be loaded.
editor-save-failed = The draft could not be saved.
editor-publish-failed = The version could not be published.
editor-revision-failed = A new version could not be started.

# Writing or reading

# Sections

editor-sections-label = Sections
editor-sections-empty-title = This lesson is empty
editor-sections-empty-body = Add the first section below and start writing.
editor-section-add = Add section
editor-section-untitled = Untitled section
editor-section-up = Move this section up
editor-section-down = Move this section down
editor-section-remove = Delete this section
editor-section-title-label = Section title

editor-section-remove-title = Delete this section?
editor-section-remove-body = Homework already handed in for this section will point at nothing.
editor-section-remove-submit = Delete section
editor-section-remove-cancel = Keep it

# Homework. The section itself is the assignment: nothing in the document holds
# a task text, so the wording asks whether work is expected and who marks it.

editor-homework-placeholder = Is work asked for?
editor-homework-label = Homework
editor-homework-none = Not asked for
editor-homework-auto = Asked for, marked automatically
editor-homework-teacher = Asked for, a teacher marks it
editor-homework-note = There is no separate assignment field — write what you ask for in the section text

# Blocks

editor-block-text = Text
editor-block-video = Video
editor-block-audio = Audio
editor-block-quiz = Quiz
editor-block-add = Add block
editor-block-up = Move the { $block } block up
editor-block-down = Move the { $block } block down
editor-block-remove = Delete the { $block } block
editor-blocks-empty-body = This section is empty.

editor-block-unknown = Unknown block
editor-block-unknown-title = This admin cannot show a "{ $type }" block.
editor-block-unknown-body = It cannot be edited here, and while it is in the lesson, the lesson cannot be saved.

editor-text-label = Lesson text
editor-text-edit = Edit this text
editor-text-hint = Markdown: # heading, **bold**, *italic*, - list, [link](https://example.org), > quote
editor-text-placeholder = Write the lesson text here.

editor-source-placeholder = Choose a source
editor-source-label = Source
editor-source-hint = YouTube and Vimeo accept links from their own sites only
editor-source-url = Direct link
editor-source-youtube = YouTube
editor-source-vimeo = Vimeo
editor-source-upload = Uploaded file
editor-url-label = Link
editor-url-hint = An http or https address
editor-poster-label = Poster image
editor-poster-hint = A link to an image — it shows before the video plays

editor-quiz-question-label = Question
editor-quiz-question-placeholder = What are you asking?
editor-quiz-answers-label = Answers
editor-quiz-answers-hint = Mark the right answer
editor-quiz-answer-label = Answer { $number }
editor-quiz-answer-placeholder = Answer text
editor-quiz-answer-add = Add answer
editor-quiz-answer-remove = Remove answer { $number }
editor-quiz-right-answer = Mark answer { $number } as correct

# Links that were refused

url-required = Enter a link.
url-malformed = This is not an address. For example: https://example.org/video
url-scheme = Only http and https links are accepted.
url-host = An embed may only come from YouTube or Vimeo.

# Content this build cannot author

editor-problems-title = This lesson cannot be saved
editor-problem-schema-version = The lesson was made in a newer version of the admin (schema { $detail }). Saving here would damage it.
editor-problem-unknown-block = The lesson has a block this version of the admin cannot show ({ $detail }). Saving would delete it.

# Reading

editor-preview-title = As the student reads it
editor-preview-embed-title = Embedded media
editor-preview-media-missing = No playable link yet.
editor-preview-quiz-empty = No question yet.
editor-preview-quiz-right = right answer
editor-preview-unknown = Unknown block of kind { $type }.

# Leaving with unsaved work

editor-unsaved-title = Leave without saving?
editor-unsaved-body = Unsaved changes will be lost.
editor-unsaved-leave = Leave
editor-unsaved-stay = Stay here

# Publishing

publish-confirm-title = Publish this version?
publish-confirm-body = Students start reading version { $version }. It cannot be changed afterwards — only a new version can.
publish-confirm-submit = Publish
publish-confirm-cancel = Cancel

# Files in a media block

editor-media-refused-image = Only image files can go in this block.
editor-media-refused-video = Only video files can go in this block.
editor-media-refused-audio = Only audio files can go in this block.
editor-media-uploading = Uploading
editor-media-cancel = Cancel
editor-media-retry = Try again
editor-media-uploaded = { $name } uploaded
editor-media-replace = Replace
editor-media-caption-label = Caption
editor-media-caption-hint = Shown under the file. Optional.
editor-media-preview-alt = Uploaded file
editor-media-unavailable = Not available yet. Files uploaded here live only until the page is reloaded.

# Choosing a file

media-picker-title = Choose a file
media-picker-close = Close
media-picker-tab-upload = Upload
media-picker-tab-library = Library
media-picker-tab-link = Link
media-picker-drop-label = Drop a file here
media-picker-search = Search by name
media-picker-empty-title = Nothing here yet
media-picker-empty-body = Upload a file, or search for another name.
media-picker-failed-title = The library could not be read
media-picker-retry = Try again
media-picker-link-label = Link
media-picker-link-hint = YouTube, Vimeo, or a direct link to a file
media-picker-link-submit = Use this link

# Media that could not be stored

media-upload-failed = The file could not be uploaded.
media-upload-cancelled = The upload was stopped.
media-unavailable = Files cannot be stored yet.
editor-block-image = Image
editor-block-menu = Block options
editor-block-add-here = Add a block here
editor-block-search = Search for a block
editor-block-none = No block of that name
editor-section-menu = Section options
editor-move-up = Move up
editor-move-down = Move down
editor-duplicate = Duplicate
editor-delete = Delete
# Quiz
editor-quiz-explanation-label = Explanation
editor-quiz-explanation-placeholder = Why is that the answer? Shown after answering.
# Saving

editor-status-saving = Saving…
editor-status-saved = Saved
editor-status-failed = Not saved
editor-save-retry = Try saving again

# Unfinished blocks

editor-faults-title = This version cannot be published yet
editor-fault-block = Section { $section }, block { $position } is unfinished.

editor-media-add-image = Add an image
editor-media-add-video = Add a video
editor-media-add-audio = Add audio
editor-media-drop-hint-image = PNG, JPG, GIF or SVG
editor-media-drop-hint-video = MP4, WebM or MOV
editor-media-drop-hint-audio = MP3, WAV or OGG
editor-media-browse = Choose a file
