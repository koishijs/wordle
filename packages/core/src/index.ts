import { Command, Context, Plugin, Session } from 'koishi'

export interface WordleVariation<WordType extends any[] = string[], MoreUnitResult = WordType[number]>
  extends Omit<Plugin.Object, 'apply'> {
  command: string | Command
  possibleUnitResults?: readonly MoreUnitResult[]
  init?: (command: Command, ctx: Context) => void
  getCurrentWord: (session: Session, ctx: Context) => Promise<WordType>
  validWords?: WordType[]
  validateWord?: (word: WordType[], session: Session, ctx: Context) => Promise<boolean>
  // Game logic and lifecycle
  onGameStart?: (session: Session, ctx: Context) => Promise<void>
  onGameEnd?: (session: Session, ctx: Context) => Promise<void>
  handleInput?: <WordType extends any[] = string[]>(
    input: string,
    state: Wordle.WordleState<WordType>,
    session: Session,
    ctx: Context,
  ) => Promise<Wordle.VarificatedResult<MoreUnitResult>>
}

export namespace Wordle {
  export enum GameState {
    NotStarted = 'not-started',
    Started = 'started',
    Ended = 'ended',
  }

  export interface WordleState<WordType extends any[] = string[]> {
    state: GameState
    currentWord: WordType
    guessedWords?: WordType[]
    guessedCount?: number
  }

  export type UnitResultType = 'correct' | 'bad-position' | 'incorrect'

  export interface UnitResult<MoreUnitResult, WordType extends any[] = string[]> {
    type: UnitResultType | MoreUnitResult
    char: WordType[number]
  }

  export interface VarificatedResult<MoreUnitResult = string> {
    unitResults: UnitResult<MoreUnitResult>[]
    type: 'invalid' | 'bad-length' | UnitResultType
  }
}

export function defineVariation<WordType extends any[] = string[], MoreUnitResult = string>(
  variation: WordleVariation<WordType, MoreUnitResult>,
): Plugin.Constructor {
  let command: Command
  const sessionState = new Map<string, Wordle.WordleState<WordType>>()

  const handleInput =
    variation.handleInput ??
    async function (input, state: Wordle.WordleState<WordType>, session, ctx) {
      const unitResults: Wordle.UnitResult<MoreUnitResult>[] = []
      if (input.length !== state.currentWord.length) {
        return { unitResults, type: 'bad-length' }
      }
      // check if word is in the word list
      if (variation.validWords) {
        if (!variation.validWords.some((word) => word.join('') === input)) {
          return { unitResults, type: 'invalid' }
        }
      }
      if (variation.validateWord) {
        if (!(await variation.validateWord(input.split('') as unknown as WordType[], session, ctx))) {
          return { unitResults, type: 'invalid' }
        }
      }

      const currentWord = [...state.currentWord]
      const guessedWords = state.guessedWords ?? []
      const guessedCount = state.guessedCount ?? 0
      for (let i = 0; i < input.length; i++) {
        const char = input[i]
        if (char === currentWord[i]) {
          unitResults.push({ type: 'correct', char })
          currentWord[i] = ''
        } else if (currentWord.some(char => char === input[i])) {
          unitResults.push({ type: 'bad-position', char })
        } else {
          unitResults.push({ type: 'incorrect', char })
        }
      }
      if (unitResults.every((result) => result.type === 'correct')) {
        // game ended
        sessionState.set(`${session.guildId}.${session.channelId}`, {
          state: Wordle.GameState.Ended,
          currentWord: state.currentWord,
          guessedWords: [...guessedWords, input as unknown as WordType],
          guessedCount: guessedCount + 1,
        })
        variation.onGameEnd?.(session, ctx)
        return { unitResults, type: 'correct' }
      } else {
        sessionState.set(`${session.guildId}.${session.channelId}`, {
          state: Wordle.GameState.Started,
          currentWord: state.currentWord,
          guessedWords: [...guessedWords, input as unknown as WordType],
          guessedCount: guessedCount + 1,
        })
        return { unitResults, type: 'incorrect' }
      }
    }

  return class {
    _variation = variation
    // re-export koishi fields
    name = variation.name
    static Config = variation.Config
    static schema = variation.schema
    static using = variation.using
    static reusable = variation.reusable
    static reactive = variation.reactive

    constructor(ctx: Context) {
      // define locales
      ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
      ctx.i18n.define('zh', require('./locales/zh-CN'))

      command = typeof variation.command === 'string' ? ctx.command(variation.command) : variation.command
      variation.init?.(command, ctx)

      command.action(async ({ session }, word) => {
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if ((!state || state?.state === Wordle.GameState.NotStarted) && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state?.state === Wordle.GameState.Started) {
          if (word) {
            const result = await handleInput(word, state, session, ctx)
            switch (result.type) {
              case 'bad-length':
                return session?.text('wordle.messages.bad-length')
              case 'invalid':
                return session?.text('wordle.messages.invalid')
              case 'correct':
                return session?.text('wordle.messages.correct')
              case 'incorrect':
                return this.formatTable(result.unitResults, state.guessedWords ?? [])
            }
          } else {
            return session?.text('wordle.messages.started', [command.name])
          }
        } else {
          // start a new game
          variation.onGameStart?.(session, ctx)
          const currentWord = await this.getCurrentWord(session, ctx)
          sessionState.set(`${session.guildId}.${session.channelId}`, { state: Wordle.GameState.Started, currentWord })
        }
      })
    }

    getCurrentWord(session: Session, ctx: Context) {
      return variation.getCurrentWord(session, ctx)
    }

    formatTable(word: Wordle.UnitResult<any>[], guessedWords: any[]): string {
      const lines: string[] = []
      let line: string = ''
      word.forEach((unit) => {
        switch (unit.type) {
          case 'correct':
            line += (`[${unit.char}]`)
            break
          case 'bad-position':
            line += (`(${unit.char})`)
            break
          case 'incorrect':
            line += (` ${unit.char} `)
            break
        }
      })

      lines.push(line)

      return lines.join('\n')
    }
  }
}
