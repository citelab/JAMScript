//This app should be runnable at the fog and cloud levels
//We will receive the data and use jview to visualize the activities and/or query statistics

var express, socket, alldata = [], clients = {};

jdata{
    allocIn as inflow of app://allocating.allocatingOut;
}

express = (require('express'))();
var server = require('http').createServer(express);
socket = require('socket.io')(server);
socket.on('connection', function(client){
    clients[client.id] = {connected: true, client: client, queue: []};
    console.log("client connected");
    //send all the available data when a client connects
    if( alldata.length > 0 ){
        for( var i in alldata )
            client.emit("state", alldata[i]);
    }

    client.on('all', function(){
        if( alldata.length > 0 ){
            for( var i in alldata )
                client.emit("state", alldata[i]);
        }
    });
    client.on('disconnect', function(){
        console.log("client disconnected");
        clients[client.id].connected = false;
    });
    client.on('reconnect', function(){
        console.log("client reconnected");
        clients[client.id].connected = true;
        var queue = clients[client.id].queue;
        if( queue.length > 0 ){
            for( var i in queue )
                client.emit("state", queue[i]);
            clients[client.id].queue = [];
        }
    });
});
server.listen(JAMManager.port - 0 + 1);    //get the data depot port and add one to it

express.get("/", (req, res) => res.sendFile(__dirname + "/visualizer.html"));
express.get("/*", (req, res) => res.sendFile(__dirname + req.url));


allocIn.setTerminalFunction(function(data){
    console.log("Status is: ", data.status);
    var keys = Object.keys(clients);
    var clientObject;
    for(var i in keys){
        clientObject = clients[keys[i]];
        if( clientObject.connected )
            clientObject.client.emit("state", data);
        else
            clientObject.queue.push(data);
    }
    alldata.push(data);
});