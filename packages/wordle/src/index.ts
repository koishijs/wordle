import { defineVariation } from '@koishijs/wordle'

import wordlist from './data/wordlist.json'

export default defineVariation({
  name: 'koishi-plugin-wordle',
  command: 'wordle',
  locales: {
    'zh': require('./locales/zh-CN'),
    'zh-CN': require('./locales/zh-CN'),
  },
  validWords: wordlist.map((word: string) => word.split('')),
  init(command, ctx) {
    command.option('random', '-r')
  },
  async getCurrentWord({ options }, ctx) {
    if ((options as any).random) {
      return wordlist[Math.floor(Math.random() * wordlist.length)].split('')
    }
    // get today's wordle from New York Times
    const date = new Date().toISOString().slice(0, 10)
    const { solution } = await ctx.http.get<NYTimesWordleResponse>(`https://www.nytimes.com/svc/wordle/v2/${date}.json`)
    return solution.split('')
  },
})

export interface NYTimesWordleResponse {
  id: number
  solution: string
  print_date: string
  days_since_launch: number
  editor: string
}
