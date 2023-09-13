import { Command, Context, Plugin, Session } from 'koishi'

export interface WordleVariation<MoreUnitResult extends string> extends Omit<Plugin.Object, 'apply'> {
  command: string | Command
  possibleUnitResults?: readonly MoreUnitResult[]
  init?: (command: Command, ctx: Context) => void
  // Game logic and lifecycle
  onGameStart?: (session: Session, ctx: Context) => void
  onGameEnd?: (session: Session, ctx: Context) => void
  handleInput?: (input: string, session: Session, ctx: Context) => Wordle.UnitResult<MoreUnitResult>[]
}

export namespace Wordle {
  export enum GameState {
    NotStarted = 'not-started',
    Started = 'started',
    Ended = 'ended',
  }

  export type UnitResultType = 'correct' | 'bad-position' | 'incorrect'

  export interface UnitResult<MoreUnitResult extends string> {
    type: UnitResultType | MoreUnitResult
  }
}

export function defineVariation<MoreUnitResult extends string>(variation: WordleVariation<MoreUnitResult>): Plugin {
  let command: Command
  const sessionState = new Map<string, Wordle.GameState>()

  return {
    ...variation,
    apply(ctx) {
      // define locales
      ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
      ctx.i18n.define('zh', require('./locales/zh-CN'))

      command = typeof variation.command === 'string' ? ctx.command(variation.command) : variation.command
      variation.init?.(command, ctx)

      command.action(async ({ session }, word) => {
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if ((!state || state === Wordle.GameState.NotStarted) && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state === Wordle.GameState.Started) {
          if (word) {
            variation.handleInput?.(word, session, ctx)
          } else {
            return session?.text('wordle.messages.started', [command.name])
          }
        } else {
          // start a new game
          sessionState.set(`${session.guildId}.${session.channelId}`, Wordle.GameState.Started)
          variation.onGameStart?.(session, ctx)
        }
      })
    },
  }
}
