//This App is available up to the fog so it can use data sharing
//when a car need to make a request, it will send the query through the fog using logging

var express, socket, clientSocket, carID;

jdata{
    struct request{
        int messageType;            //1=request, 2=accept, 3=reject, 4=leave (this should be detectable by the sensor ideally)
        char* carID;                //The id of the car sending the request
        char* postcode;             //preferred postcode for parking. Could be location. If message is not 1, it is the rejected or accepted area
        int openToNearbyLocation;   //if this car is open to nearby location
        int slotID;                 //This for messageType 2 and 3
    } request as logger(fog);      //This logger does not go beyond the fog

    carRequestOut as outflow of request;
    allocCarAssignIn as inflow of app://allocating.allocResponseOut;  //inflow from the allocation app reporting slot information
    struct resp{
        int messageType;    //1=found a slot, 2=no slot found
        char* label;        //The label of the assigned spot
        char* slotID;       //the assigned id of this spot
        char* carID;        //The if for the requesting car would just be passed back with the data
        int isPreferred;    //if this request is same as the preferred area requested
        char* postcode;     //the post code area of the parking spot being sent
        int duration;       //The allowed maximum parking duration
        int timeout;        //For message type 2 or message 1 with isPreferred = 0. This tells when to ask for another slot. (in milliseconds)
    } resp as broadcaster;
}

var currentSpot, tempSpot;

jcond{
    isDevice: sys.type == "device";
    isFog: sys.type == "fog";
}

jsync {isDevice} function getCarID() {
    if( !carID )
        carID = ("car" + new Date().getTime() + Math.random()).replace(/\./g, "");
    return carID;
}

jasync {isDevice} function launch(){ //this method is only available at the device level
    console.log("\n\n --------------- GOT INSIDE HERE  ---------- \n\n");
    //generate car id
    if( !carID )
        carID = ("car" + new Date().getTime() + Math.random()).replace(/\./g, "");

    express = (require('express'))();
    var server = require('http').createServer(express);
    socket = require('socket.io')(server);
    socket.on('connection', function(client){
        clientSocket = client;
        console.log("client connected");
        client.emit("id", {carID: carID, currentSpot: currentSpot});
        client.on('reconnect', function(){
            console.log("client reconnected");
            client.emit("id", {carID: carID, currentSpot: currentSpot});
        });
        client.on('disconnect', function(){
            console.log("client disconnected");
            client.emit("id", {carID: carID, currentSpot: currentSpot});
        });
        client.on('request', function(data){//request for parking spot
            request.log(data);
        });
        client.on('accept', function(data){//accept parking spot
            currentSpot = tempSpot;
            park(currentSpot.postcode, currentSpot.label);
            request.log(data);
        });
        client.on('reject', function(data){//reject parking spot
            tempSpot = null;
            request.log(data);
        });
        client.on('leave', function(data){//leave parking spot. Ideally this should not be the case
            currentSpot = null;
            request.log(data);
        });
    });
    server.listen(JAMManager.port - 0 + 1);    //get the data depot port and add one to it

    express.get("/", (req, res) => res.sendFile(__dirname + "/car.html"));
    express.get("/*", (req, res) => res.sendFile(__dirname + req.url));


    //since the broadcast at the C is not yet working, for now lets use J->C when we get to the device level
    resp.addHook(function(pack){
        if( pack.origin === "parent" ){//only pay attention to broadcasts from the fog
            var message = pack.message;
            //since this is a broadcast, check if it concerns this node
            if( message.carID != carID )
                return;



            //check if the allocator found a spot for us
            if( message.messageType == 2 ){ //no spot was found
                //send to visualizer to process
                clientSocket.emit("response", message);
                return;
            }

            //determine if the found spot is the preferred. If it is, then do the parking
            //else check if the postcode of the new area is close to where we want. If it is, we accept else we reject

            if( message.isPreferred == 1 ){//this is our preferred area
                currentSpot = message;  //save as current spot
                park(message.postcode, message.label);  //send to the C-side
                //send to visualizer to process
                clientSocket.emit("response", message);
            }
            else{//this is not our preferred location
                //save the temporary spot in case the user accepts it
                tempSpot = message;
                //send to visualizer to process
                clientSocket.emit("response", message);
            }
        }
    });
}

launch();    //begin running code at the device level
carRequestOut.start();  //start the outflow to listen and send data out to allocator


//no need to use jcond to make this function run only at the fog level because no sharing will be done by the
//allocator at the device level
allocCarAssignIn.setTerminalFunction(function(data){
    //TODO data received, use J->J to send the data to the level below
    //For now let us use broadcaster to push the data down
    resp.broadcast(data);   //data should have the structure in the resp struct
});
