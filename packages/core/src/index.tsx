import { Context, Element } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

export function generateColor(color: WordleCore.BaseColor): Partial<CSSStyleDeclaration> {
  const base = {
    color: '#fff',
    border: '2px solid transparent',
  }
  switch (color) {
    case 'correct': return { ...base, backgroundColor: '#79b851' }
    case 'wrong-place': return { ...base, backgroundColor: '#f3c237' }
    case 'none': return { ...base, backgroundColor: '#a4aec4' }
  }
}

const transformers: WordleCore.Transformers = {
  correct: word => `[${word}]`,
  'wrong-place': word => `(${word})`,
  none: word => ` ${word} `,
}

export abstract class WordleCore {
  constructor(protected ctx: Context, protected config: WordleCore.Config) {
    ctx.i18n.define('zh', require('./locales/zh-CN'))
  }
  abstract getTodayWord(): string
  abstract validateInput(input: string): WordleCore.Validation
  public render(input: string[], validation: WordleCore.Validation[]): Element {
    const textMode = !(this.config.imageMode && this.ctx.puppeteer)
    const elements: Element[] = []
    for (let i = 0; i < input.length; i++) {
      let row = []
      if (textMode) {
        if (!validation[i]) break
        for (let j = 0; j < input[i].length; j++) row.push(transformers[validation[i]?.color[j]]?.(input[i][j]))
      } else {
        for (let j = 0; j < input[i].length; j++) row.push(<span class="cell" style={{ ...generateColor(validation[i]?.color[j]) }}>{ input[i][j] }</span>)
      }
      elements.push(textMode? row : 
        <p class="row">{ row }</p>
      )
    }
  return textMode? 
    <>
      <i18n path="wordle.core.wordle"/>
      {elements}
      <i18n path="wordle.core.text-mode-prompt"/>
    </> : 
    <html>
      <div id="game">{ elements }</div>
      <style>{`
        #game {
          display: flex;
          flex-direction: column;
          align-items: center;
          font-weight: 700;
        }
        
        #game .row {
          display: flex;
          margin: 0;
        }
        
        #game .cell {
          width: 44;
          height: 44;
          font-size: 20;
          border: 2px solid #dee1e9;
          margin: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
        }
      `}</style>
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

  export type Transformer<O = string> = (word: string) => O
  export type Transformers = Record<WordleCore.BaseColor, WordleCore.Transformer>
}
