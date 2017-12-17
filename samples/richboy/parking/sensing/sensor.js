/**
 * Created by Richboy on 30/06/17.
 */

var devices = 1;    //keep track of the number of devices and use it to generate ids for each connecting device
var labels = ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5", "Slot 6", "Slot 7", "Slot 8"];
var postcodes = ["H1N", "H1N", "H1N", "H1N", "H1N", "H1N", "H1N", "H1N"];
var addresses = ["No 1 parking zone, Montreal"];

jdata{
    struct spot{
        char* label;           //parking label
        char* postcode;
        char* address;
        int parkingDuration;
        char* status;             //free, onhold, assigned
        int assignedID;         //this is the assigned ID by the JNode
        char* key;         //this is the datastream key for the node
    } spot as logger(fog);      //This logger does not go beyond the fog

    spotFlow as flow with spotFlowFunc of spot;
    sensingOut as outflow of spotFlow;
    allocSensorIn as inflow of app://allocating.allocSenseOut;

    struct assignment{
        char* status;   //assigned, onhold, free
        char* carID;      //The binding car
        int slotID;
        int postcode;
        char* key;
    } assignment as broadcaster;
}

// //Since we are having a lil issue with getting the device JNode to send back data using C->J, lets transform
// //the data before it is sent to the fog and onwards
// if( jsys.type == "device" ){
//     spot.setTransformer((input, datastream) => {
//         input.key = datastream.getDeviceId();
//         input.postcode = postcodes[input.assignedID - 1];
//         input.label = labels[input.assignedID - 1];
//         input.address = addresses[0];
//         return input;
//     });
// }

jcond{
    isFog: sys.type == "fog";
    isDevice: sys.type == "device";
}

//function to share the data only at the fog level
if( JAMManager.isFog ){
    sensingOut.setExtractDataTransformer().start(); //start sharing on the fog
}


function spotFlowFunc(inputFlow){
    return inputFlow;
}

jsync {isFog} function isFogRunning(){
    return 1;
}


jsync {isDevice} function getAssignedID() {
    console.log("IN GET ASSIGNED ID");
    return devices++;
}

jsync {isDevice} function getLabel(assignedID) {
    return labels[assignedID - 1];
}

jsync {isDevice} function getPostcode(assignedID) {
    return postcodes[assignedID - 1];
}

jsync {isDevice} function getAddress(assignedID) {
    return addresses[0];
}

jsync {isDevice} function getStreamKey(assignedID) {//
    //use the assigned id to find the datastream and return the key
    for( var i = 0; i < spot.size(); i++ ){
        var lastValue = spot[i].getLastValue();
        if( lastValue == null )
            continue;
        if( lastValue.assignedID && lastValue.assignedID == assignedID ) {
            console.error("Found Stream Key");
            return spot[i].getDeviceId();
        }
    }
    console.error("Did not find Stream Key");
    return "null";
}

jasync {isDevice} function addBroadcastHook(){
    //since the broadcast at the C is not yet working, for now lets use J->C when we get to the device level
    assignment.addHook(function(pack){
        if( pack.origin === "parent" ){//only pay attention to broadcasts from the fog
            var message = pack.message;
            //since this is a broadcast, check if it concerns this node
            var datastream = null;

            for( var i = 0; i < spot.size(); i++ ){
                if( spot[i].getDeviceId() == message.key ){
                    datastream = spot[i];
                    break;
                }
            }
            if( datastream == null )
                return;

            //inform the c-side of the state change
            changeState(message.status, message.slotID, message.key);
        }
    });
}

spot.findAllStreams();  //get all the streams from Redis which may not yet be loaded in memory

//subscribe to when parent comes online and then push the last data from all the streams, but only one that is not null
var subObj = {
    func: function(info, redis, parentLevel){
        if( parentLevel == "fog" ){ //this will execute only on the device
            JAMManager.removeParentUpSub(subObj);   //only do this on first connection

            //setup the device to only push values having the required key to the fog
            for(var i = 0; i < spot.size(); i++){
                (function(dSpot){
                    var poll = function(s){
                        if( s.getLastValue() == null ||  s.getLastValue().key == "null" )
                            setTimeout(() => poll(s), 100);
                        else
                            JAMManager.simpleLog(s.key, s.getLastValue(), null, JAMManager.getParentRedisLogger());
                    };
                    poll(dSpot);
                })(spot[i]);
            }
        }
    },
    context: null
};

JAMManager.addParentUpSub(subObj);

//no need to use jcond to make this function run only at the fog level because no sharing will be done by the
//allocator at the device level
allocSensorIn.setTerminalFunction(function(data){
    if( typeof data === "string" ){
        console.log("allocSensorIn input data in sensor.js is string");
        data = JSON.parse(data);
    }
    //TODO data received, use J->J to send the data to the level below
    //For now let us use broadcaster to push the data down
    assignment.broadcast(data);   //data should have the structure in the response struct
});

addBroadcastHook();