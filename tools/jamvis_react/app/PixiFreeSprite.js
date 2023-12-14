import { PixiComponent, useApp } from "@pixi/react";
import * as PIXI from "pixi.js";

const PixiFreeSprite = PixiComponent("PixiFreeSprite", {
  create: (props) => {
    const sprite = PIXI.Sprite.from(props.image);
    sprite.x = props.startX;
    sprite.y = props.startY;
    sprite.width = props.width;
    sprite.height = props.height;

    props.app.ticker.add(() => {
      if (props.state.current) {
        console.log("States", props.state.current, props.id)
        if (props.state.current[props.id]) {
          sprite.x = props.state.current[props.id].x;
          sprite.y = props.state.current[props.id].y;
        }
      }
    });

    return sprite;
  },

  applyProps: (instance, oldProps, newProps) => {
    instance.x = newProps.x;
    instance.y = newProps.y;
  },
});
export default PixiFreeSprite;
