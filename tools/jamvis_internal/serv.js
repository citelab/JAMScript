#!/usr/bin/env node

const express = require('express'),
      child_process = require('child_process'),
      fs = require('fs'),
      ws = require('ws'),
      process = require('process'),
      merc = require('mercator-projection'),
      cbor = require('cbor-x'),
      mqtt = require('mqtt');

const app = express();

const port = 8580;
var app_name = 'jt1';
var batch = false;

/////////////////////
// MQTT Management //
/////////////////////

/// Try to conenct to local host 
const global_broker = connect_global_broker();

///var brokers = [];
var node_map = new Map();

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
    mqtt_message_handler(topic, message);
  });
  
  return global_broker;
}

function connect_broker(url, port) {
  const broker = mqtt.connect(`mqtt://${url}:${port}`);
  
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
  console.log("Tracking New Node: "+node_id);
  let internal_mach_type = mach_type;
  let local_registry = false;

  console.log(mach_type);
  if(mach_type == 'local_registry') {
    internal_mach_type = 'fog';
    local_registry = true;
  }
  
  let entry = {
    broker: connect_broker(online_message.ip, online_message.port),
    node_id: String(node_id),
    loc: online_message.loc,
    mach_type: internal_mach_type,
    local_registry: local_registry,
    connections: []
  };
  
  node_map.set(node_id, entry);
  update_node_view(entry);
}

function handle_message_transport(message_data) {
  let data = cbor.decode(message_data);
  // receiver/sender is not consistently correct at the moment.

  update_transport_view({
    receiver: String(data.nodeid),
    sender: String(data.oldid),
    task_id: String(data.taskid)
  });
}

function mqtt_message_handler(topic, message_text) {
  let topic_levels = topic.split('/');
  let mach_type    = topic_levels[1];
  let node_id      = topic_levels[2];
  let message_type = topic_levels[3];

  // For now...
  if(topic.charAt(0) == '/') {
    handle_message_transport(message_text);
    return;
  }
  
  if(message_text == "")
    return;
  
  try {
    
    var message = JSON.parse(message_text);
  } catch(e) {
    console.log("Failed to parse message...");
    return;
  }

  // TODO: handle local registry unhost
  if(message_type == 'status') {
    if(message.payload == 'offline') {
      if(mach_type == 'local_registry') {
	let node = node_map.get(node_id);
	if(!node)
	  return;
	node.local_registry = false;
      } else {
	node_map.delete(node_id);
      }

    } else if (!node_map.has(node_id)) {
      register_broker(message.payload, node_id, mach_type);
    }
  } else if (message_type == 'curLoc') {
    let node = node_map.get(node_id);
    if(node == undefined)
      return;
    node.loc['long'] = message.payload['long'];
    node.loc['lat'] = message.payload['lat'];
    update_node_view(node);
  } else if (message_type == '_debug_selfHost') { // TODO: this seems useless now
    let node = node_map.get(node_id);
    if(node == undefined)
      return;
    
    node.local_registry = message.payload;
    
  } else if (message_type == '_debug_conns') {
    let node = node_map.get(node_id);
    if(node == undefined)
      return;
    node.connections = message.payload;
    update_node_view(node);
  }
}

function transform_coords(loc) {
  let xy = merc.fromLatLngToPoint({lat: loc['lat'], lng: loc['long']});
  let adjusted_xy = {x: xy.x/256.0, y: (xy.y/256.0)+0.5};
  return adjusted_xy;
}

function update_node_view(node) {
  let xy = merc.fromLatLngToPoint({lat: node.loc['lat'], lng: node.loc['long']});
  let adjusted_xy = {x: xy.x/256.0, y: (xy.y/256.0)+0.5};

  let relevant_info = {
    node_id: node.node_id,
    loc_proj: adjusted_xy,
    loc: node.loc,
    mach_type: node.mach_type,
    local_registry: node.local_registry,
    connections: node.connections
  };

  let pack = {
    type: 'state',
    data: relevant_info
  };
  websocketSend(JSON.stringify(pack));
}

var transport_update_queue = []

// for now, TODO: add more information from here
function update_transport_view(event_data) {
  let pack = {
    type: 'event',
    data: event_data
  };
  if(batch) {
    transport_update_queue.push(event_data);
  } else {
    websocketSend(JSON.stringify(pack));
  }
}

function dump_transport_view_batch() {
  let pack = {
    type: 'event-batch',
    data: transport_update_queue
  }
  websocketSend(JSON.stringify(pack));
  transport_update_queue = []
}

//////////////////////////
// Websocket Management //
//////////////////////////

const websocket_server = new ws.WebSocketServer({port:8681 });

var websockets = [];

function location_average() {

  var acc = {x: 0, y: 0};
  for(var node_entry of node_map) {
    var node = node_entry[1];
    var pos = transform_coords(node.loc);
    acc = {
      x: acc.x + pos.x,
      y: acc.y + pos.y
    };
  }
  return {x: acc.x/node_map.size,
	  y: acc.y/node_map.size};
}

function websocketSend(message) {
  for(var websocket of websockets) {
    websocket.send(message);
  }
}

websocket_server.on('error', (err)=>{console.error("WS: "); console.error(err)});
websocket_server.on('connection', function(websocket) {
  console.log("Someone Connected to the websocket.");
  websockets.push(websocket);

  let pack = {
    type: 'viewport',
    data: location_average()
  };
  websocket.send(JSON.stringify(pack));
  
  // Bring websocket up to date
  for(var node_entry of node_map) {
    var node = node_entry[1];
    update_node_view(node);
  }
});


////////////////////
// Initialization //
////////////////////

let args = process.argv.slice(2);
app_name = args[0];
batch    = args[1] == 'true';
if(batch) {
  console.log("Sending Batched Message Transport Packets.");
  setInterval(()=>{dump_transport_view_batch()}, 500)
}


/////////////////////
// Website Hosting //
/////////////////////

const raw_html = `<html><head>
<script src="https://cdn.jsdelivr.net/npm/pixi.js@7.x/dist/pixi.min.js"></script>
<script src="sketch.js" defer></script>
</head><body style="margin: 0"></body></html>`;

app.get('/', (req, res) => {
  res.send(raw_html);
});

app.get('/sketch.js', (req, res) => {
  let sketch = fs.readFileSync(`${__dirname}/view.js`,  {encoding: 'utf8', flag: 'r' });
  res.send(sketch);
});

app.listen(port, () => {
  console.log(`JAMVis Webserver listening on port ${port}`);
});
