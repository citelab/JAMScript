"use client";
import { Container, Text, ParticleContainer, Sprite } from "@pixi/react";
import { useMemo, useContext } from "react";
import { WebsocketContext } from "@/context/WebsocketContext";


const IMAGE_NAMES = [
  "cloud-fog.png",
  "Services.png",
  "fog.png",
  "internet.png",
  "menu.svg",
];
const IMAGE_PATHS = IMAGE_NAMES.map((name) => {
  return "/image/" + name;
});

const Nodes = ({nodes}) => {
  const positions = useContext(WebsocketContext);
  const initialSprites = (() => {
    const nodeImages = new Map();
    for (let path of IMAGE_PATHS) {
      nodeImages.set(path, []);
    }
    nodes.map((node, index) => {
      const nodeSprite = (
        <Node
          key={index}
          width={node.width}
          height={node.height}
          x={positions.current ? positions.current[index].x : node.startX}
          y={positions.current ? positions.current[index].y : node.startY}
          image={node.image}
        />
      );
      const oldNodeImages = nodeImages.get(node.image);
      nodeImages.set(
        node.image,
        oldNodeImages.concat([nodeSprite]),
      );
    });
    return nodeImages;
  })()

  return (
    <ParticleContainer>
      {initialSprites.get(IMAGE_PATHS[0])}
    </ParticleContainer>
  );
};

const Node = ({ width, height, x, y, image }) => {
  return (
    <Sprite
      width={width}
      height={height}
      x={x}
      y={y}
      image={image}
    />
  );
};

Node.displayName = "Node";

export default Nodes;
