
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

var remote_calls_last_sec = 0;
var remote_calls_this_sec = 0;

var bounding_boxes = [];
var selected_node = undefined;

var hide_text = false;
var show_lr_conn = false;
var show_conn = true;
var show_trails = false;
var trail_mode = 0;


const DEFAULT_LINE_COLOUR = {r:100, g:50, b:50};
const SIGNAL_LINE_COLOUR = {r:255, g:50, b:50};
const SELECTED_LINE_COLOUR = {r: 150, g: 150, b: 150};
const SELECTED_SIGNAL_LINE_COLOUR = {r: 255, g: 255, b: 255};
const LR_LINE_COLOUR = {r: 50, g: 100, b: 70};
const LR_SIGNAL_LINE_COLOUR = {r: 50, g: 255, b: 255};

const FOG_COLOUR = {r: 14,g:149,b:148};
const DEVICE_COLOUR = {r: 245,g:84,b:45};
const LR_COLOUR = {r: 255,g:255,b:255};

const TRAIL_COLOUR = {r: 150,g:150,b:150};

const TRAIL_MAX = 40;

const TRAIL_LEN1 = 5;
const TRAIL_LEN2 = 15;


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

function scalarAddition(vec2, scale) {
  return {x: vec2.x+scale, y: vec2.y+scale};
}

var ui_cache = new Map();
function render_text(app, desc, text_content, offset) {
  let text = undefined;
  if(ui_cache.has(desc)) {
    text = ui_cache.get(desc);
  } else {
    text = new PIXI.Text(text_content, style_medium);
    text.should_visible = true;
    ui_cache.set(desc,text);
    text.x = 40;
    app.stage.addChild(text);
  }
  
  if(hide_text) {
    text.visible = false;
  } else {
    text.visible = text.should_visible;
  }
  
  if(!text.visible)
    return offset;
  
  text.text = text_content;
  text.y = offset;
  
  return offset + 35;
}

function text_visible(app, desc, state) {
  if(!ui_cache.has(desc)) {
    console.log("Couldn't find text with descriptor: "+desc);
    return;
  }
  var text = ui_cache.get(desc);
  text.should_visible = state;
  if(hide_text) {
    text.visible = false;
  } else {
    text.visible = text.should_visible;
  }
}

function init_ui(app) {

  var y = 40;
  
  var text = new PIXI.Text("JAMVis", style_large);
  text.x = 40;
  text.y = y;

  app.stage.addChild(text);
}


function update_ui() {
  y = 90
  if(selected_node) {
    y = render_text(app, 'selected_node', `Selected Node: ${selected_node.data.node_id}`, y);
    y = render_text(app, 'selected_node_lat', `Latitude: ${selected_node.data.loc['lat']}`, y);
    y = render_text(app, 'selected_node_long', `Longitude: ${selected_node.data.loc['long']}`, y);
  }
  y = render_text(app, 'remote_commands_ps', `Commands Per Second: ${remote_calls_last_sec}`, y);
  y = render_text(app, 'remote_commands', `Total Commands: ${remote_calls_observed}`, y);
  y = render_text(app, 'devices', `Devices: ${devices.length}`, y);
  y = render_text(app, 'fogs', `Fogs: ${fogs.length}`, y);
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
  
  document.addEventListener("wheel", (event) => {
    let delta = event.deltaY/8*view_scale*0.001;
    view_scale -= delta;
  });


  document.addEventListener("keydown", (event) => {
    handle_key(event);
  });
  
  
  document.addEventListener("mousedown", (event) => {
    if(handle_click(app, event)) {
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

function handle_key(event) {
  console.log(event);
  if(event.key == 'h') {
    hide_text = !hide_text;
  } else if(event.key == 'l') {
    show_lr_conn = !show_lr_conn;
  } else if(event.key == 'c') {
    show_conn = !show_conn;
  } else if(event.key == 't') {
    trail_mode++;
    trail_mode = trail_mode % 4;
  }
}


// returns true if its a drag event
function handle_click(app, event) {
  for(var box of bounding_boxes) {
    if(box.left < event.clientX &&
       event.clientX < box.right &&
       box.top < event.clientY &&
       event.clientY < box.bottom) {

      selected_node = box.node;
      text_visible(app, 'selected_node', true);
      text_visible(app, 'selected_node_long', true);
      text_visible(app, 'selected_node_lat', true);
      
      return false;
    }
  }
  if(selected_node) {
    text_visible(app, 'selected_node', false);
    text_visible(app, 'selected_node_long', false);
    text_visible(app, 'selected_node_lat', false);
    console.log("bro");
  }
  selected_node = undefined;

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
  remote_calls_this_sec++;
  
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
	locs: new Array(TRAIL_MAX),
	loc_off: 0,
	signals: {}
      },
      data: message
    });
  }

  let node = node_map.get(message.node_id);
  
  // Unfortunate hack for now...
  if(node.data.loc_proj.x !== message.loc_proj.x ||
     node.data.loc_proj.y !== message.loc_proj.y){
    node.graphics.locs[node.graphics.loc_off % TRAIL_MAX] = node.data.loc_proj;
    node.graphics.loc_off++;
  }
  
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

function get_past_loc(node, index) {
  return node.graphics.locs[(node.graphics.loc_off+index) % TRAIL_MAX];
}

const rect_size = 20

function render_trace() {
  // Trace Pass

  
  let default_line_style = {
    width: 5,
    color: TRAIL_COLOUR
  };
  let len = 0;
  switch(trail_mode) {
  case 1:
    len = TRAIL_LEN1;
    break;
  case 2:
    len = TRAIL_LEN2;
    break;
  case 3:
    len = TRAIL_MAX;
    break;
  }

  
  graphics.lineStyle(default_line_style);

//  let diff = TRAIL_MAX-len;

  for(var device of devices) {
    var node = node_map.get(device);
    for(var i = 0; i < len; i++) {
      var loc = get_past_loc(node,i-len); // a bit of a hack

      if(i!=(len-1)) {
	var next_loc = get_past_loc(node,i-len+1);
      } else {
	var next_loc = node.data.loc_proj;
      }
      
      if(loc === undefined || next_loc === undefined)
	continue;

      var pos = transform_pos(loc);
      var next_pos = transform_pos(next_loc);
      
      graphics.moveTo(pos.x, pos.y);
      graphics.lineTo(next_pos.x, next_pos.y);
      
    }
    
  }
}

function render(delta) {
  graphics.clear();
  
  let default_line_colour = DEFAULT_LINE_COLOUR;
  let default_line_style = {
    width: 2,
    color: default_line_colour
  };

  let signal_line_colour = SIGNAL_LINE_COLOUR;
  
  graphics.lineStyle(default_line_style);
  var width = 2;

  // Connection Pass
  for(var device of devices) {
    var node = node_map.get(device);
    var pos = transform_pos(node.graphics.pos);
    
    for(var node_id of node.data.connections) {
      var conn_node = node_map.get(node_id);
      if(conn_node == undefined)
	continue;

      if(conn_node.data.local_registry) {
	if(show_lr_conn) {
	  var reset = true;
	  default_line_colour = LR_LINE_COLOUR
	  signal_line_colour = LR_SIGNAL_LINE_COLOUR
	  graphics.lineStyle({
	    width: 2,
	    color: default_line_colour
	  });
	} else {
	  continue;
	}
      } else if(!show_conn) {
	// This might be a little weird as the reset never gets hit.

	// Im thinking that it shouldn't matter though
	continue;
      }
            
      if(conn_node == selected_node ||
	 node == selected_node) {
	var reset = true;
	default_line_colour = SELECTED_LINE_COLOUR
	signal_line_colour = SELECTED_SIGNAL_LINE_COLOUR
	width = 3;
	graphics.lineStyle({
	  width: width,
	  color: default_line_colour
	})
      }

      let signal = node.graphics.signals[node_id];
      if(signal) {
	var reset = true;
	graphics.lineStyle({
	  width: width,

	  color: lerp_colour(default_line_colour, signal_line_colour, Math.pow(signal, 0.5))
	})
      }
      
      var conn_pos = transform_pos(conn_node.graphics.pos);
      
      graphics.moveTo(pos.x, pos.y);
      graphics.lineTo(conn_pos.x, conn_pos.y);

      if(reset) {
	default_line_colour = DEFAULT_LINE_COLOUR;
	signal_line_colour = SIGNAL_LINE_COLOUR;
	graphics.lineStyle(default_line_style);
	width = 2;

      }
    }
  }


  if(trail_mode)
    render_trace();
  
  graphics.lineStyle({
    width: 0,
    color: 0
  });
  

  // Local Registry Pass
  graphics.beginFill(LR_COLOUR);

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
  graphics.beginFill(FOG_COLOUR);
  for(var fog of fogs) {
    var node = node_map.get(fog);
    
    let pos = corner_from_center(transform_pos(node.graphics.pos), rect_size);
    
    graphics.drawRect(pos.x, pos.y, rect_size, rect_size);
  }
  graphics.endFill();
  
  // Device Pass
  graphics.beginFill(DEVICE_COLOUR);
  for(var device of devices) {
    var node = node_map.get(device);
    
    let pos = corner_from_center(transform_pos(node.graphics.pos), rect_size);
    
    graphics.drawRect(pos.x, pos.y, rect_size, rect_size);
  }
  graphics.endFill();

}

var last_sec = Date.now();

function update(delta) {

  if(last_sec + 1000 <= Date.now()) {
    last_sec = Date.now();
    remote_calls_last_sec = remote_calls_this_sec;
    remote_calls_this_sec = 0;
  }
  
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
