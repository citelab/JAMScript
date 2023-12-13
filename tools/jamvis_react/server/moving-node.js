const mqtt = require("mqtt");
const { randomInt, enums, pixelToBlock, sblockCoordsToId } = require(
  "./utils.js",
);

const imagePaths = [
  "/image/cloud-fog.png",
  "/image/Menu.png",
  "/image/fog.png",
  "/image/internet.png",
];
const createNodes = (hostname, port, amount, images) => {
  let nodes = [];

  for (let key = 0; key < amount; ++key) {

    const randomDirection = [{x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}, {x: 1, y: -1}][randomInt(0)(4)];

    const node = new MovingNode(
      key,
      randomInt(0)(3000),
      randomInt(0)(3000),
      hostname,
      port,
      images[key % 4],
      randomDirection
    );
    nodes.push(node);
  }
  return nodes
};

class MovingNode {
  constructor(key, x, y, hostname, port, image, direction) {
    this.image = image;
    this.x = x;
    this.y = y;
    this.id = key;
    this.image = image
    this.direction = direction;
    this.mqttURL = `mqtt://${hostname}:${port}`;
    this.client = mqtt.connect(this.mqttURL, enums.mqtt.OPTIONS);

    this.client.on("connect", () => {
      this.requestBlockSize();
    });

    this.client.on("message", (topic, payload) => {
      const message = payload.toString();
      if (topic === "block-size" && message.startsWith("size:")) {
        const size = message.split(":")[1];
        const sblockCoords = pixelToBlock(this.x, this.y, size);
        const sblockId = sblockCoordsToId(sblockCoords.x, sblockCoords.y, size);

        this.sblock = {
          size: size,
          id: sblockId,
        };

        this.topic = `sblocks/${this.sblock.id}/node-${this.id}`;

        // The s-block server will publish the same size multiple times, but
        // the outline only has to be published once per node.
        if (!this.outline) this.publishOutline();
      }
    });
  }

  move() {
    if (!this.sblock) return;
    this.x += this.direction.x;
    this.y += this.direction.y;


    // Check if the node has moved to a new sblock
    const sblockCoords = pixelToBlock(this.x, this.y, this.sblock.size);
    const newSblockId = sblockCoordsToId(sblockCoords.x, sblockCoords.y, this.sblock.size);
    
    if (newSblockId !== this.sblock.id) {
      this.setSblock(newSblockId);
      this.publishOutline();
    }

    this.publishState();
  }

  requestBlockSize() {
    this.client.subscribe("block-size");
    this.client.publish("block-size", this.id.toString());
  }

  publishOutline() {

    this.outline = {
      type: "outline",
      content: {
        x: this.x,
        y: this.y,
        width: 50,
        height: 50,
        image: this.image,
      },
    };

    this.client.publish(this.topic, JSON.stringify(this.outline));
  }

  publishState() {

    const nodeState = JSON.stringify({
      type: "state",
      content: {
        ...this.getPosition(),
      }
    });

    this.client.publish(this.topic, nodeState);
  }

  setSblock(sblockID) {
    this.sblock = { size: this.sblock.size, id: sblockID}
    this.topic = `sblocks/${this.sblock.id}/node-${this.id}`;
  }

  setImage(url) {
    this.image = url;
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
  getPosition() {
    return { x: this.x, y: this.y };
  }

}

const nodes = createNodes("localhost", 1883, 500, imagePaths);
setInterval(() => {
  for (let node of nodes) {
    node.move();
  }
}, 100);
module.exports = MovingNode;
