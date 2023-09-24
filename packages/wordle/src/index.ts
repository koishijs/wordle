import { defineVariation } from '@koishijs/wordle'

export default defineVariation({
  name: 'koishi-plugin-wordle',
  command: 'wordle',
  init(command, ctx) {},
  async getCurrentWord(session, ctx) {
    const date = new Date().toISOString().slice(0, 10)
    const { solution } = await ctx.http.get<NYTimesWordleResponse>(`https://www.nytimes.com/svc/wordle/v2/${date}.json`)
    return solution.split('')
  },
  async onGameStart(session, ctx) {
    session.send('game started')
  },
})

export interface NYTimesWordleResponse {
  id: number
  solution: string
  print_date: string
  days_since_launch: number
  editor: string
}
