const mqtt = require("mqtt");
const { enums, worldToSblock, randomInt } = require(
  "./utils.js",
);

const imagePaths = [
  "/image/cloud-fog.png",
  "/image/microcontroller.png",
  "/image/fog.png",
  "/image/internet.png",
  "/image/Services.png",
  "/image/scale-modification.png",
  "/image/Cloud.png",
  "/image/planet.png",
  "/image/server.png",
  "/image/computers.png",
];

const createNodes = (hostname, port, amount, images) => {
  let nodes = [];

  for (let key = 0; key < amount; ++key) {
    const node = new MovingNode(
      key,
      randomInt(0)(enums.sbs.WORLD_SIZE),
      randomInt(0)(enums.sbs.WORLD_SIZE),
      hostname,
      port,
      images[key % images.length],
    );
    nodes.push(node);
  }
  return nodes;
};

class MovingNode {
  constructor(key, x, y, hostname, port, image) {
    this.image = image;
    this.x = x;
    this.y = y;
    this.id = key;
    this.direction = {
      x: 1,
      y: 1
    }

    // MQTT
    this.mqttURL = `mqtt://${hostname}:${port}`;
    this.client = mqtt.connect(this.mqttURL, enums.mqtt.OPTIONS);

    this.client.on("connect", () => {
      this.requestBlockSize();
    });

    this.client.on("message", (topic, payload) => {
      const message = payload.toString();
      if (topic === "block-size" && message.startsWith("size:")) {
        const size = message.split(":")[1];
        const sblockId = worldToSblock(size, this.x, this.y);

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
    this.x += this.direction.x * 0.1;
    this.y += this.direction.y * 0.1;

    // Check if the node has moved to a new sblock
    const newSblockId = worldToSblock(
      this.sblock.size,
      this.x,
      this.y,
    );

    // if (newSblockId !== this.sblock.id) {
    //   this.setSblock(newSblockId);
    //   this.publishOutline();
    // }

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
        id: this.id,
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
      },
    });

    this.client.publish(this.topic, nodeState);
  }

  setSblock(sblockID) {
    this.sblock = { size: this.sblock.size, id: sblockID };
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
    };
  }
  getPosition() {
    return { x: this.x, y: this.y };
  }
}

const nodes = createNodes("localhost", 1883, 30, imagePaths);

setInterval(() => {
  nodes.map((node) => {
    node.move();
  });
}, 500)
module.exports = MovingNode;
