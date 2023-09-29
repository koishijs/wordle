import { defineVariation } from '@koishijs/wordle'

import wordlist from './data/wordlist.json'

function getRandomWord() {
  return wordlist[Math.floor(Math.random() * wordlist.length)]
}

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
  async getCurrentWord({ options, session }, ctx) {
    if ((options as any).random) {
      return getRandomWord().split('')
    }
    // get today's wordle from New York Times
    const date = new Date().toISOString().slice(0, 10)
    try {
      const { solution } = await ctx.http.get<NYTimesWordleResponse>(
        `https://www.nytimes.com/svc/wordle/v2/${date}.json`,
        {
          // In case of network error, we fallback to a random word.
          timeout: 5000,
        },
      )
      return solution.split('')
    } catch (err) {
      // NYTimes is not accessible in China and some other regions,
      // so we fallback to a random word.
      await session.send(session.text('.fallback-to-random'))
      return getRandomWord().split('')
    }
  },
})

export interface NYTimesWordleResponse {
  id: number
  solution: string
  print_date: string
  days_since_launch: number
  editor: string
}
