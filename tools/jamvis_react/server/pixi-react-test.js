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

const createNodeArray = (num) => {
  const nodes = [];
  for (let i = 0; i < num; ++i) {
    const node = createNode(i)(100)({ x: 2500, y: 1200 })(IMAGE_PATHS)(50);
    nodes.push(node);
  }

  return nodes;
};
const createNode =
  (id) => (maxSize) => (maxPosition) => (images) => (maxSpeed) => {
    const randomSize = () => {
      return getRandomInt(maxSize / 2)(maxSize);
    };
    const randomPosition = getRandomInt(0);
    const randomSpeed = getRandomInt(maxSpeed / 3);
    const size = {
      width: randomSize(),
      height: randomSize(),
    };

    const position = {
      x: randomPosition(maxPosition.x),
      y: randomPosition(maxPosition.y),
    };

    const image = images[getRandomInt(0)(images.length - 1)];

    const speed = {
      x: randomSpeed(maxSpeed) / 100,
      y: randomSpeed(maxSpeed) / 100,
    };

    return {
      id: id,
      size: size,
      position: position,
      speed: speed,
      image: image,
    };
  };

const getRandomInt = (min) => (max) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const getNewPositions = (range) => (templates) => {
  const positions = templates.map((node) => {
    const randomChange = getRandomInt(range.min);
    const change = {
      x: randomChange(range.max) * node.speed.x,
      y: randomChange(range.max) * node.speed.y,
    };

    return change;
  });

  return positions;
};
const createDataMessage = (newPositions) => {
  return JSON.stringify({ type: "data", content: newPositions });
};

const createTemplateMessage = (nodeArray) => {
  const simpleNodesInfo = nodeArray.map((node) => {
    return {
      width: node.size.width,
      height: node.size.height,
      startX: node.position.x,
      startY: node.position.y,
      image: node.image,
    };
  });
  return JSON.stringify({
    type: "template",
    content: simpleNodesInfo,
  });
};

module.exports = {
  templateMessage: createTemplateMessage,
  dataMessage: createDataMessage,
  newTemplates: createNodeArray,
  newData: getNewPositions
}
