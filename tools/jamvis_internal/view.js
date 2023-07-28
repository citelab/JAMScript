function setup() {
  let Application = PIXI.Application;
  let Sprite = PIXI.Sprite;
  let Assets = PIXI.Assets;
  
  const app = new Application();
  document.body.appendChild(app.view);
 
  // This creates a texture from a 'bunny.png' image
  const graphics = new PIXI.Graphics();

  // Rectangle
  graphics.beginFill(0xDE3249);
  graphics.drawRect(50, 50, 100, 100);
  graphics.endFill();

  app.stage.addChild(graphics);
  
  const socket = new WebSocket(`ws://localhost:8681`);
  socket.addEventListener('message', (event) => handleMqtt(event.data));
}

setup();

function handleMqtt(message){
  console.log("Received Message: "+message); 
}
  
function draw() {
  background(220,0,120);
}
