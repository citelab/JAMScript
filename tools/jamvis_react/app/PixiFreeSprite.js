import { PixiComponent, useApp } from '@pixi/react'
import * as PIXI from 'pixi.js'

const PixiFreeSprite = PixiComponent('PixiFreeSprite', { 
  create: (props) => {
    const sprite = PIXI.Sprite.from(props.image)
    sprite.x = props.startX
    sprite.y = props.startY
    sprite.width = props.width
    sprite.height = props.height

    // props.app.ticker.add(() => { 
    //   if (props.state.current[props.key]) {
    //     sprite.x = props.state.current[props.key].x
    //     sprite.y = props.state.current[props.key].y
    //   }
    // })

    return sprite

  },

  applyProps: (instance, oldProps, newProps) => {

    instance.x = newProps.x
    instance.y = newProps.y
  }
})
export default PixiFreeSprite
