
let node_map = new Map();
let fogs = [];
let devices = [];
var view_scale = 750;
var viewport_pos = {x:0,y:0};
var view_offset = {x:0,y:0};

let app, graphics;

let dragging = false;
let drag_start = {x:0,y:0};
var view_offset_drag_start = {x:0,y:0};

var remote_calls_observed = 0;
var remote_calls_observed_text = undefined;
var devices_text = undefined;
var fogs_text = undefined;

var bounding_boxes = [];

function scalarAddition(vec2, scale) {
  return {x: vec2.x+scale, y: vec2.y+scale};
}

function init_ui(app) {

  var y = 40;
  const style_large = new PIXI.TextStyle({
    fontFamily: 'Times New Roman',
    fontSize: 36,
    fill: "White"
  });
  
  const style_medium = new PIXI.TextStyle({
    fontFamily: 'Times New Roman',
    fontSize: 24,
    fill: "White"
  });
  
  var text = new PIXI.Text("JAMVis", style_large);
  text.x = 40;
  text.y = y;
  
  y += 50;
  app.stage.addChild(text);


  remote_calls_observed_text = new PIXI.Text(`Commands Observed: ${remote_calls_observed}`, style_medium);
  remote_calls_observed_text.x = 40;
  remote_calls_observed_text.y = y;

  y += 35;
  app.stage.addChild(remote_calls_observed_text);
  
  
  devices_text = new PIXI.Text(`Devices: ${devices.length}`, style_medium);
  devices_text.x = 40;
  devices_text.y = y;

  y += 35;
  app.stage.addChild(devices_text);

  
  fogs_text = new PIXI.Text(`Fogs: ${fogs.length}`, style_medium);
  fogs_text.x = 40;
  fogs_text.y = y;

  y += 35;
  app.stage.addChild(fogs_text);

}


function update_ui() {
  remote_calls_observed_text.text = `Calls Observed: ${remote_calls_observed}`;
  devices_text.text = `Devices: ${devices.length}`;
  fogs_text.text = `Fogs: ${fogs.length}`;
}

function setup() {
  let Application = PIXI.Application;
  let Sprite = PIXI.Sprite;
  let Assets = PIXI.Assets;
  let Ticker = PIXI.Ticker;
  
  app = new Application({width: window.innerWidth,
			 height: window.innerHeight,
			 resolution: 1,
			 antialias:true});
  document.body.appendChild(app.view);
  graphics = new PIXI.Graphics();
  app.stage.addChild(graphics);

  init_ui(app);
  
  const socket = new WebSocket(`ws://localhost:8681`);
  socket.addEventListener('message', (event) => websocket_receive(event));

  // Event Handlers
  window.addEventListener("resize", function() {
    resize(app);
  });

  // final = view_scale*orig
  // width = view_scale*virtual_canvas
  // virtual_width = width/view_scale

  // diff_real = (width/view_scale - width/dview_scale)*view_scale
  
  // find difference in virtual canvas and convert into real size
  

  document.addEventListener("wheel", (event) => {
    let delta = event.deltaY/8*view_scale*0.001;
    view_scale -= delta;
  });
  
  document.addEventListener("mousedown", (event) => {
    if(handle_click(event)) {
      dragging = true;
      drag_start = {x: event.screenX, y: event.screenY};
      view_offset_drag_start = viewport_pos;
    }
  });

  document.addEventListener("mouseup", (event) => {
    dragging = false;
  });
  
  document.addEventListener("mouseleave", (event) => {
    dragging = false;
  });
  
  document.addEventListener("mousemove", (event) => {
    if(!dragging)
      return;

    let current_delta = {x: drag_start.x - event.screenX,
			 y: drag_start.y - event.screenY};
    
    viewport_pos = {x: view_offset_drag_start.x + current_delta.x/view_scale,
		    y: view_offset_drag_start.y + current_delta.y/view_scale};
  });
  
  let shared_ticker = Ticker.shared;
  shared_ticker.add((delta) => update(delta));
}


// returns true if its a drag event
function handle_click(event) {
  for(var box of bounding_boxes) {
    if(box.left < event.clientX &&
       event.clientX < box.right &&
       box.top < event.clientY &&
       event.clientY < box.bottom) {
      console.log("GOOD SHIT!!!" );
      console.log(event);
      console.log(box);
      return false;
    }
  }

  return true;
}

let resizeTimer = undefined;
function resize(app) {
  if(resizeTimer) {
    clearTimeout(resizeTimer);
  }
  resizeTimer = setTimeout(()=>{
    app.renderer.resize(window.innerWidth, window.innerHeight);
    resizeTimer = undefined;
  },100);
}

function websocket_receive(event) {
  let pack = JSON.parse(event.data);
  if (pack.type === 'event') {
    handle_transport_event(pack.data);
  } else if (pack.type === 'event-batch') {
    for(var item of pack.data) {
      handle_transport_event(item);
    }
  }  else if (pack.type === 'state') {
    handle_mqtt(pack.data);
  } else if (pack.type === 'viewport') {
    handle_viewport_update(pack.data);
  }
}

function handle_viewport_update(data) {
  console.log(data);
  viewport_pos = data;
}

function handle_transport_event(data) {
  remote_calls_observed++;
  
  let task_id = data.task_id;

  var device = undefined;
  var other = undefined
  let sender = node_map.get(data.sender);
  let receiver = node_map.get(data.receiver);
  
  if(sender == undefined || receiver == undefined) {
    return;
  }
  
  if(sender.data.mach_type == 'device') {
    device = sender;
    other = receiver
  }

  if(receiver.data.mach_type == 'device') {
    if(device) {
      console.log("Invalid Thing????!?!?!?!");
      return;
    }
    device = receiver;
    other = sender;
  }
  
  if(device == undefined)
    return;
  
  device.graphics.signals[other.data.node_id] = 1;
}

function handle_mqtt(message) {

  if(!node_map.has(message.node_id)) {
    switch(message.mach_type) {
    case 'device':
      devices.push(message.node_id);
      break;
    case 'fog':
      fogs.push(message.node_id);
      break;      
    }
      node_map.set(message.node_id, {
	graphics: {
	  pos: {
	    x: message.loc_proj.x,
	    y: message.loc_proj.y
	  },
	  signals: {}
	},
	data: message
      });
  }
  
  let node = node_map.get(message.node_id);
  node.data = message;
}

function transform_pos(pos) {
  return {x: (pos.x - viewport_pos.x)*view_scale + window.innerWidth/2,
	  y: (pos.y - viewport_pos.y)*view_scale + window.innerHeight/2};
//  return {x: pos.x*view_scale+view_offset.x,
//	  y: pos.y*view_scale+view_offset.y};
}

function corner_from_center(pos, size) {
  return {x: pos.x - size/2,
	  y: pos.y - size/2};
}

function center_of_square(pos, size) {
  return {x: pos.x + size/2,
	  y: pos.y + size/2};
}

function lerp(v0, v1, a) {
  return v0 + a * (v1 - v0);
}

function lerp_colour(col1, col2, a) {
  return {r: lerp(col1.r, col2.r, a),
	  g: lerp(col1.g, col2.g, a),
	  b: lerp(col1.b, col2.b, a)};
}

const rect_size = 20

function render(delta) {
  graphics.clear();
  
  let default_line_colour = {r: 150, g: 0, b: 0};
  let default_line_style = {
    width: 2,
    color: default_line_colour
  };

  let signal_line_colour = {r: 255, g: 255, b: 255};
  
  graphics.lineStyle(default_line_style);
  
  // Connection Pass
  for(var device of devices) {
    var node = node_map.get(device);
    var pos = transform_pos(node.graphics.pos);
    
    for(var node_id of node.data.connections) {
      var conn_node = node_map.get(node_id);
      if(conn_node == undefined)
	continue;
      
      if(conn_node.data.local_registry)
	continue;

      let signal = node.graphics.signals[node_id];
      if(signal) {
	graphics.lineStyle({
	  width: 2,
	  color: lerp_colour(default_line_colour, signal_line_colour, Math.pow(signal, 0.5))
	})
      }
      
      var conn_pos = transform_pos(conn_node.graphics.pos);
      
      graphics.moveTo(pos.x, pos.y);
      graphics.lineTo(conn_pos.x, conn_pos.y);

      if(signal) {
	graphics.lineStyle(default_line_style);
      }
    }
  }

  graphics.lineStyle({
    width: 0,
    color: 0
  });
  
  // Device Pass
  graphics.beginFill(0xDE3249);
  for(var device of devices) {
    var node = node_map.get(device);
    
    let pos = corner_from_center(transform_pos(node.graphics.pos), rect_size);
    
    graphics.drawRect(pos.x, pos.y, rect_size, rect_size);
  }
  graphics.endFill();


  // Local Registry Pass
  graphics.beginFill(0xF044F0);
  for(var fog of fogs) {
    var node = node_map.get(fog);
    if(!node.data.local_registry) {
      continue;
    }
    
    let pos = corner_from_center(transform_pos(node.graphics.pos), rect_size);
    
    graphics.drawRect(pos.x-2, pos.y-2, rect_size+4, rect_size+4);
  }
  graphics.endFill();
  
  // Fog Pass
  graphics.beginFill(0x00ff00);
  for(var fog of fogs) {
    var node = node_map.get(fog);
    
    let pos = corner_from_center(transform_pos(node.graphics.pos), rect_size);
    
    graphics.drawRect(pos.x, pos.y, rect_size, rect_size);
  }
  graphics.endFill();
}

function update(delta) {

  var new_bounding_boxes = [];

  // Animate Location Changes
  for(var node_entry of node_map) {
    var node = node_entry[1];

    var dx = node.data.loc_proj.x - node.graphics.pos.x;
    var dy = node.data.loc_proj.y - node.graphics.pos.y;

    node.graphics.pos.x += dx * 0.25 * delta;
    node.graphics.pos.y += dy * 0.25 * delta;

    var screen_pos = transform_pos(node.graphics.pos);
    
    new_bounding_boxes.push({
      node: node,
      top: screen_pos.y-10,
      bottom: screen_pos.y+10,
      left: screen_pos.x-10,
      right: screen_pos.x+10,
    });

    for(var signal_node_id in node.graphics.signals) {
      node.graphics.signals[signal_node_id] -= 0.05 * delta;
      if(node.graphics.signals[signal_node_id] <= 0) {
	delete(node.graphics.signals[signal_node_id]);
      }
    }
  }
  bounding_boxes = new_bounding_boxes;
//  console.log(bounding_boxes);
  
  update_ui();
  render();
}

setup();
