export interface WizardGetSignInCodeByEmailEmits {
  complete: []
}

export interface WizardSignInWithCodeEmits {
  complete: [isRegistrationRequired: boolean]
  'go-back': []
}
