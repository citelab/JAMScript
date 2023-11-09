import { Graphics } from '@pixi/react'

const Grid = (props) => {

  const drawGrid = (g) => {
    g.clear();
    g.lineStyle(1 / props.level, 0x000000, 0.5);
    g.moveTo(0, 0);
    for (let i = 0; i <= props.width; i += props.width / (props.depth * props.level)) {
      g.moveTo(i, 0);
      g.lineTo(i, props.height);
    }
    for (let i = 0; i <= props.height; i += props.height / (props.depth * props.level)) {
      g.moveTo(0, i);
      g.lineTo(props.width, i);
    }
  }

  return (
    <Graphics draw={drawGrid}/>
  )
}

export default Grid
