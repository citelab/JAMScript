const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://127.0.0.1:1883");

let count = 0;
function sendMessage(t, m) {
    client.publish(t, m);
    client.publish(t, m);
    client.publish(t, m);
    client.publish(t, m);
    client.publish(t, m);
   setImmediate(sendMessage, t, m);
}
client.on("connect", () => {
  client.subscribe("p", (err) => {
      if (!err) {
//	  sendMessage("p", "Hello mqtt dfdf dsf dsfsdf dsfsdf sdfsdf dsf dfshfsdf hsdf dsfhdsf sdhf sdfhsdf sdhfds ffsdhfhsdf sdfhsdfhsdfhsdf sdfsjdf sdfhsdjf sdjf sdjf sdfhsdf hsdjfhsdjfh sdf sdfjds fsdf sdfsd fhsdf sdfhsdj fsdfh sdkjf hdskjfhsdufhsdkjfhsdkjf sdjkfh sdjfhsdjuhf kdjsfhsdkjfhkjsdfhkjdsfh kjsdfhsd fjhsdfkjdhsfh");
	  sendMessage("p", "t");
      }
  });
});

function recvMsg() {
    count++;
}

client.on("message", (topic, message) => {
    // message is Buffer
    setImmediate(recvMsg);
    setImmediate(recvMsg);
    setImmediate(recvMsg);
    setImmediate(recvMsg);
    setImmediate(recvMsg);
    

//    console.log(message.toString());
});

setInterval(()=> {
    console.log("Count: ", count);
    count = 0;
}, 1000);
