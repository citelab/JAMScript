import { PixiComponent } from "@pixi/react";
import { Container, Sprite } from "pixi.js";
import { forwardRef } from "react";

const Nodes = PixiComponent("Nodes", {
  create: (props) => {
    const container = new Container();
    props.outlines.map((outline) => {
      const node = new Sprite.from(outline.image);
      node.width = outline.width;
      node.height = outline.height;
      node.x = outline.x;
      node.y = outline.y;
      container.addChild(node);
    });

    return container;
  },
});

const FreeNodes = forwardRef((props, ref) => {
  return <Nodes ref={ref} {...props} />;
});

export default FreeNodes;
