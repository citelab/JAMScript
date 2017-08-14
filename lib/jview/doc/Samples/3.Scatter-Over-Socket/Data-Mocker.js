const io = require ('socket.io-client');
const socket = io('http://localhost:3000');

var x = 0;
setInterval(()=>{
    var data = {}
    data.x=x;
    data.y=Math.floor((Math.random() * 30) + 1);
    data.gateIndex = 4;
    x++;
    console.log("pushed data.x: "+data.x+" data.y: "+data.y);
    socket.emit('newDataPoint', data);
    
    data.y=Math.floor((Math.random() * 30) + 1);
    data.gateIndex = 2;
    socket.emit('newDataPoint', data);
}, 500);

