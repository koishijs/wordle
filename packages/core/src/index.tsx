import { Context, Element } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

export function generateColor(color: WordleCore.BaseColor) {
  const base = {
    color: '#fff',
    border: '2px solid transparent',
  }
  switch (color) {
    case 'correct': return { ...base, 'background-color': '#79b851' }
    case 'wrong-place': return { ...base, 'background-color': '#f3c237' }
    case 'none': return { ...base, 'background-color': '#a4aec4' }
  }
}

export abstract class WordleCore {
  constructor(protected ctx: Context, protected config: WordleCore.Config) {
    ctx.i18n.define('zh', require('./locales/zh-CN.yml'))
  }
  abstract getTodayWord(): string
  abstract validateInput(input: string): WordleCore.Validation
  public render(input: string[], validation: WordleCore.Validation[]): Element {
    const elements: Element[] = []
    if (!(this.config.imageMode && this.ctx.puppeteer)) {
      for (let i = 0; i < input.length; i++) {
        let row = ''
        if (!validation[i]) break
        for (let j = 0; j < input[i].length; j++) {
          switch (validation[i]?.color[j]) {
            case 'correct': 
              row += `[${input[i][j]}]`
              break
            case 'wrong-place': 
              row += `(${input[i][j]})`
              break
            case 'none': 
              row += ` ${input[i][j]} `
              break
          }
        }
        elements.push(<p>{ row }</p>)
      }
      return <>
        <p><i18n path="commands.wordle-core.messages.wordle"></i18n></p>
        { elements }
        <i18n path="commands.wordle-core.messages.text-mode-prompt"></i18n>
      </>
    }
      for (let i = 0; i < input.length; i++) {
        const row = []
        for (let j = 0; j < input[i].length; j++) {
          row.push(<span style={{
            width: 44,
            height: 44,
            'font-size': 20,
            border: '2px solid #dee1e9',
            margin: 3,
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            'justify-content': 'center',
            'border-radius': '5px',
            ...generateColor(validation[i]?.color[j]),
          }}>{ input[i][j] }</span>)
        }
        elements.push(<p style={{
          display: 'flex',
          margin: 0
        }}>{ row }</p>)
      }
      return <html>
        <div style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'font-weight': 700
        }}>{ elements }</div>
      </html>
  }
}

export namespace WordleCore {
  export type BaseColor = 'none' | 'wrong-place' | 'correct'
  export interface Validation<Color = WordleCore.BaseColor> {
    isValid: boolean
    color: Color[]
  }

  export interface Config {
    imageMode: boolean
  }
}
