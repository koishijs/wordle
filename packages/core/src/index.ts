export abstract class WordleCore {
  abstract getTodayWord(): string
  abstract validateInput(input: string): WordleCore.Validation
}

export namespace WordleCore {
  export type BaseColor = 'none' | 'wrong-place' | 'correct'
  export interface Validation<Color = WordleCore.BaseColor> {
    isValid: boolean
    color: Color[]
  }
}
