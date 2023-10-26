const mqtt = require("mqtt");

const startBroker = (hostname, port, topic) => { 

    const mqttBroker = mqtt.connect(`mqtt://${hostname}:${port}`);

    mqttBroker.on("error", (error) => {
      console.log("Error connecting to MQTT server:", error);
      process.exit(1);
    });
    mqttBroker.on("connect", () => {
      mqttBroker.subscribe(`${topic}`, (error) => {
        if (error) throw error;
      });
    });

    return mqttBroker;
}

const parseTopic = (topic) => {
  const topicItems = topic.split("/");

  if (topicItems[1] === 'local_registry') {
    topicItems[1] = 'fog'
  }
  return {
    nodeType: topicItems[1],
    nodeId: topicItems[2],
    messageType: topicItems[3],
  };
};

const parseMessage = (message) => {
  let messageData
  try {
    messageData = JSON.parse(message.toString())
  } catch (error) {
    console.log("Error: cannot parse message: ", message.toString())
  }

  return messageData
};

module.exports = {
  startBroker: startBroker,
  parseTopic: parseTopic,
  parseMessage: parseMessage
};
