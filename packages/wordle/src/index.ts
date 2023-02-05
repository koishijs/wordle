import { WordleCore } from '@koishijs/wordle'
import { Context } from 'koishi'

export const name = 'koishi-plugin-wordle'

export class Wordle extends WordleCore {
  getTodayWord(): string {}
  validateInput(): WordleCore.Validation {}
}

export function apply(ctx: Context) {
  // TODO: call wordle
}
