#!/usr/bin/env node

const express = require('express'),
      child_process = require('child_process'),
      fs = require('fs'),
      ws = require('ws'),
      process = require('process'),
      mqtt = require('mqtt');

const app = express();

const port = 8580;
const app_name = 'jt1';

/////////////////////
// MQTT Management //
/////////////////////

/// Try to conenct to local host 
const global_broker = connect_global_broker();

var brokers = [];
var broker_nodeid

function connect_global_broker() {
  const global_broker = mqtt.connect("mqtt://127.0.0.1:18830");

  global_broker.on('error', (error) => {
    if (error.code == 'ECONNREFUSED') {
      console.log("Couldn't establish a connection to the global registry.");
      global_broker.end();
      process.exit();
    } else {
      console.log(error);
    }
  });

  global_broker.on("connect", () => {
    global_broker.subscribe(`${app_name}/local_registry/#`, (error) => {
      if(error) {
	console.log("Error doing Subscription for global registry: "+error.toString());
      }
    });
  });

  global_broker.on("message", (topic, message) => {
    console.log(topic.toString())
    console.log(message.toString());
    mqtt_message_handler(topic, message);
  });
  
  return global_broker;
}

function connect_broker(url, port) {
  const broker = mqtt.connect(`mqtt://${url}:${port}`);
  console.log("BRUH: "+ `mqtt://${url}:${port}`);
  broker.on('error', (error) => {
    console.log(error);
  });

  broker.on('connect', () => {
     // EVERYTHING!!!!
    broker.subscribe(`#`, (error) => {
      if(error) {
	console.log("Error doing Subscription for global registry: "+error.toString());
      }
    });
  });

  broker.on('message', mqtt_message_handler);
  return broker;
}

function register_broker(online_message, node_id, mach_type) {

  let internal_mach_type = mach_type;
  let local_registry = false;
  if(mach_type == 'local_registry') {
    internal_mach_type = 'fog';
    local_registry = true;
  }
  
  let entry = {
    broker: connect_broker(online_message.ip, online_message.port),
    node_id: node_id,
    loc: online_message.loc,
    mach_type: internal_mach_type,
    local_registry: local_registry
  };
  
  brokers.push(entry);
}

function mqtt_message_handler(topic, message_text) {
  let topic_levels = topic.split('/');
  let mach_type    = topic_levels[1];
  let node_id      = topic_levels[2];
  let message_type = topic_levels[3];

  if(topic.charAt(0) == '/') {
//    console.log("meep");
    return;
  }
  
  if(message_text == "")
    return;
  
  let message = JSON.parse(message_text);
  
  if(message_type == 'status') {
    if(message.payload == 'offline') {
      var to_remove = undefined;
      let index = 0;
      for(let broker in brokers) {
	if(broker.node_id == node_id) {
	  to_remove = broker;
	  break;
	}
	index++;
      }
      brokers.splice(index, 1);
    }
  }
}


//////////////////////////
// Websocket Management //
//////////////////////////

const websocket_server = new ws.WebSocketServer({port:8681 });

var websockets = [];

function websocketSend(message) {
  for(var websocket of websockets) {
    websocket.send(message);
  }
}

websocket_server.on('error', (err)=>{console.error("WS: "); console.error(err)});
websocket_server.on('connection', function(websocket) {
  console.log("Someone Connected to the websocket.");
  websockets.push(websocket);
});

/////////////////////
// Website Hosting //
/////////////////////

const raw_html = `<html><head>
<script src="https://cdn.jsdelivr.net/npm/pixi.js@7.x/dist/pixi.min.js"></script>
<script src="sketch.js" defer></script>
</head><body><h1>Hello PixiJS</h1></body></html>`;

app.get('/', (req, res) => {
  res.send(raw_html);
});

app.get('/sketch.js', (req, res) => {
  let sketch = fs.readFileSync(`${__dirname}/view.js`,  {encoding: 'utf8', flag: 'r' });

  res.send(sketch);
  setInterval(()=>{websocketSend("BVASDLKJASLDKJASLD!!!")},1000);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  // TODO: do this later once we know we have a good context...
  //child_process.execSync(`open "http://localhost:${port}"`, {stdio:'ignore'});
});
