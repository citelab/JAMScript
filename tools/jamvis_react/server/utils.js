// Description: Utility functions for the project
// Author: Philippe Latour
//
// Note: this file also contains various enum-like objects
// for separation of constants

const sbs = {
  WORLD_SIZE: 10000,
  S_BLOCK_SIZE: 100,
  S_BLOCK_COUNT: 100,
  NUM_S_BLOCKS: 100,
  INITIAL_TOPICS: ["sblocks/#", "block-size"],
};

const mqtt = {
  OPTIONS: {
    port: 1883,
    protocolVersion: 5,
    keepalive: 60,
    properties: {
      requestResponseInformation: true,
      requestProblemInformation: true,
    },
  },
};

const errmsg = {
  SUB: "Could not subscribe to:",
  PUB: "Could not publish to:",
  CONN: "Could not connect to:",
};

const logError = (errorMessage) => (topic) => (err) => {
  if (err) {
    console.error(`Error - ${errorMessage} ${topic}\n`);
    console.error(err);
  }
};

class DefaultNode {
  constructor(id, sblockId) {
    this.id = id;
    this.sblockId = sblockId;
    this.x = randomInt(0)(100);
    this.y = randomInt(0)(100);
    this.height = randomInt(50)(100);
    this.width = randomInt(50)(100);
    this.image = "/image/NoState.png";
    this.state = { x: 0, y: 0 };
    this.outline = { x: 0, y: 0, width: 10, height: 10, image: "/image/NoState.png" };
  }

  getOutline() {
    return this.outline;
  }

  getPosition() {
    return {
      x: this.x,
      y: this.y,
    }
  }
  getImage() {
    return this.image;
  }
  getSize() {
    return {
      height: this.height,
      width: this.width,
    }
  }

  getState() {
    return this.state;
  }
}

const mqttMessageHandler =
  (nodes, mqttClient, sblockContents, frontendPipe) => (topic, payload) => {
    const message = payload.toString();

    if (topic === "block-size" && !message.startsWith("size:")) {

      mqttClient.publish("block-size", "size:" + sbs.S_BLOCK_SIZE);

    } else if (topic.startsWith("sblocks/")) {
      // All messages in the sblocks/ topic are in JSON format
      // They each must contain a type and a content field
      const data = JSON.parse(message);
      const type = data.type;

      // By convention, the topic is in the format sblocks/<sblockId>/node-<nodeId>
      const topics = topic.split("/");
      const id = topics[2].split("-")[1];
      const sblockId = topics[1];

      if (!nodes.has(id)) {
        const node = new DefaultNode(id, sblockId);
        nodes.set(node.id, node);
      }

      // Update the node
      const node = nodes.get(id);
      node[type] = data.content;

      // Add the node to its current sblock
      if (!sblockContents.has(sblockId)) {
        sblockContents.set(sblockId, []);
      }
      sblockContents.get(sblockId).push(node);

      // Notify the frontend that the node has been updated
      frontendPipe.emit(type);
    }
  };

const createArray = (length) => {
  let array = new Array(length || 0);
  let counter = length;

  if (arguments.length > 1) {
    const args = Array.prototype.slice.call(arguments, 1);
    while (counter--) {
      array[length - 1 - counter] = createArray.apply(this, args);
    }
  }

  return array;
};

const pixelToBlock = (x, y, sblockSize) => {
  const blockX = Math.floor(x / sblockSize);
  const blockY = Math.floor(y / sblockSize);

  return { x: blockX, y: blockY };
};

const blockId = (x, y, numBlocks) => {
  const xVal = (x % numBlocks) * x;
  const yVal = (y % numBlocks) * y;
  return xVal + yVal;
};

const randomInt = (min) => (max) => {
  return Math.floor(Math.random() * (max - min) + min);
};

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
}

module.exports = {
  createArray: createArray,
  pixelToBlock: pixelToBlock,
  enums: {
    sbs: sbs,
    mqtt,
    errors: errmsg,
    numSBlocks: sbs.NUM_S_BLOCKS,
  },
  logError: logError,
  randomInt: randomInt,
  FatalError: FatalError,
  sblockCoordsToId: blockId,
  mqttMessage: mqttMessageHandler,
  DefaultNode: DefaultNode,
};
