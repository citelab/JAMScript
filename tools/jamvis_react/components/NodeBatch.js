import { Container, PixiComponent, useApp } from "@pixi/react";
import * as PIXI from "pixi.js";
import { forwardRef } from "react";

const IMAGE_NAMES = [
  "cloud-fog.png",
  "Services.png",
  "fog.png",
  "internet.png",
  "Menu.png",
];

const IMAGE_PATHS = IMAGE_NAMES.map((name) => {
  return "/image/" + name;
});

const NodeBatch = PixiComponent("NodeBatch", {
  create: (props) => {
    const containerConfig = [props.nodes.length, {
      scale: true,
      position: true,
      rotation: true,
      uvs: true,
      alpha: true,
    }];

    const container = new PIXI.ParticleContainer(...containerConfig);
    container.eventMode = "static"
    container.on("click", () => {console.log("clicked container")});
    const texture = PIXI.Texture.from(props.texture);

    const indices = [];
    // add nodes that use the texture
    props.nodes.map((node, index) => {
      if (node.image === props.texture) {
        const nodeSprite = PIXI.Sprite.from(texture);
        nodeSprite.width = node.width;
        nodeSprite.height = node.height;
        nodeSprite.x = node.startX;
        nodeSprite.y = node.startY;
        nodeSprite.zIndex = 0;
        nodeSprite.eventMode = "dynamic"
        nodeSprite.on("pointerenter", () => {console.log("added sprite")})
        indices.push(index);
        container.addChild(nodeSprite);
      }
    });

    // change the position of the children
    props.app.ticker.add(() => {
      container.children.map((sprite, index) => {
        if (props.positions?.current) {
          sprite.x = props.positions.current[indices[index]].x;
          sprite.y = props.positions.current[indices[index]].y;
        }
      });
    });

    return container;
  },
  // didMount: (instance, parent) => {
  //   // apply custom logic on mount
  // },
  // willUnmount: (instance, parent) => {
  //   // clean up before removal
  // },
  // applyProps: (instance, oldProps, newProps) => {
  //   // apply props...
  // },
  config: {
    destroy: true,
    destroyChildren: false,
  },
});

const NodeBatchComponent = forwardRef((props, ref) => {
  const app = useApp();
  const textures = IMAGE_PATHS;
  return (
    <>
      {textures.map((value) => {
        return (
          <NodeBatch
            {...props}
            app={app}
            ref={ref}
            texture={value}
            key={value}
          />
        );
      })}
    </>
  );
});

NodeBatchComponent.displayName = "NodeBatchComponent";
export default NodeBatchComponent;
