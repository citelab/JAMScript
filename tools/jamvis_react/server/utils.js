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

const sblockPosition = (sblockSize) => (worldX, worldY) => {
  // Scale the world coordinates
  const position = {
    column: Math.floor(worldX / sblockSize),
    row: Math.floor(worldY / sblockSize),
  };

  return position;
};

const sblocksInRange = ({startX, startY, endX, endY}, sblockSize, worldSize) => {
  const sblocks = [];
  const dimension = worldSize / sblockSize;

  // Convert the world coordinates to sblock coordinates
  const worldToSblock = sblockPosition(sblockSize);
  const topLeft = worldToSblock(startX, startY);
  const bottomRight = worldToSblock(endX, endY);

  // Get the sblock IDs in the range
  for (let column = topLeft.column; column <= bottomRight.column; column++) {
    for (let row = topLeft.row; row <= bottomRight.row; row++) {
      const id = (row * dimension) + column;
      sblocks.push(id);
    }
  }

  return sblocks;
}

const worldToSblock = (sblockSize, worldX, worldY) => { 
  const position = sblockPosition(sblockSize)(worldX, worldY);
  const dimension = sbs.WORLD_SIZE / sblockSize;
  const id = (position.row * dimension) + position.column;

  return id;
}
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
  shownSblocks: sblocksInRange,
  worldToSblock: worldToSblock,
  enums: {
    sbs: sbs,
    mqtt,
    errors: errmsg,
    numSBlocks: sbs.NUM_S_BLOCKS,
  },
  logError: logError,
  randomInt: randomInt,
  FatalError: FatalError,
  mqttMessage: mqttMessageHandler,
};
