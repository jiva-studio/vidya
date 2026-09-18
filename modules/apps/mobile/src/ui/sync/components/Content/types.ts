export interface UnsupportedSchemaNoticeProps {
  /** The shape number carried by the stored lesson content. */
  contentSchemaVersion: number

  /** The highest shape number this build of the app can draw. */
  supportedSchemaVersion: number
}

export interface UnsupportedSchemaNoticeEmits {
  'update-app': []
}

export interface LessonContentGateProps {
  contentSchemaVersion: number

  /** Defaults to the version this build was compiled against. */
  supportedSchemaVersion?: number
}

export interface LessonContentGateEmits {
  'update-app': []
}
