//This app should be runnable at the fog and cloud levels
//We will receive the data and use jview to visualize the activities and/or query statistics

const io = require ('socket.io-client');
const socket = io('http://localhost:3000');

jdata{
    x as inflow of app://sensing.pack
}

