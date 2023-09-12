import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { expect } from 'chai'
import { App } from 'koishi'

describe('wordle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)

  before(() => app.start())
  after(() => app.stop())

  it('should pass test', async () => {
    expect(1).to.equal(1)
  })
})
