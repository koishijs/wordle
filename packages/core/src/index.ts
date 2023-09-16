import { Command, Context, Plugin, Session } from 'koishi'

export interface WordleVariation<WordType = string, MoreUnitResult extends string = string>
  extends Omit<Plugin.Object, 'apply'> {
  command: string | Command
  possibleUnitResults?: readonly MoreUnitResult[]
  init?: (command: Command, ctx: Context) => void
  getCurrentWord: (session: Session, ctx: Context) => Promise<WordType>
  // Game logic and lifecycle
  onGameStart?: (session: Session, ctx: Context) => Promise<void>
  onGameEnd?: (session: Session, ctx: Context) => Promise<void>
  handleInput?: (input: string, session: Session, ctx: Context) => Wordle.UnitResult<MoreUnitResult>[]
}

export namespace Wordle {
  export enum GameState {
    NotStarted = 'not-started',
    Started = 'started',
    Ended = 'ended',
  }

  export interface WordleState<WordType = string> {
    state: GameState
    currentWord: WordType
    guessedWords?: WordType[]
    guessedCount?: number
  }

  export type UnitResultType = 'correct' | 'bad-position' | 'incorrect'

  export interface UnitResult<MoreUnitResult extends string> {
    type: UnitResultType | MoreUnitResult
  }
}

export function defineVariation<WordType = string, MoreUnitResult extends string = string>(
  variation: WordleVariation<WordType, MoreUnitResult>,
): Plugin.Constructor {
  let command: Command
  const sessionState = new Map<string, Wordle.WordleState<WordType>>()

  return class {
    constructor(ctx: Context) {
      // define locales
      ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
      ctx.i18n.define('zh', require('./locales/zh-CN'))

      command = typeof variation.command === 'string' ? ctx.command(variation.command) : variation.command
      variation.init?.(command, ctx)

      command.action(async ({ session }, word) => {
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if ((!state || state.state === Wordle.GameState.NotStarted) && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state.state === Wordle.GameState.Started) {
          if (word) {
            variation.handleInput?.(word, session, ctx)
          } else {
            return session?.text('wordle.messages.started', [command.name])
          }
        } else {
          // start a new game
          variation.onGameStart?.(session, ctx)
          const currentWord = await variation.getCurrentWord(session, ctx)
          sessionState.set(`${session.guildId}.${session.channelId}`, { state: Wordle.GameState.Started, currentWord })
        }
      })
    }
  }
}
