import { Sprite } from '@pixi/react';

const Fog = (props) => {
  return (
    <Sprite 
      image='/image/cloud-fog.png'
      scale={{ x: 0.2 * props.scale, y: 0.2 * props.scale}}
      x={props.x}
      y={props.y}
      pointerdown={props.onClick}
    />
  )
}

export { Fog }
