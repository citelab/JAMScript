/**
 * Created by Richboy on 30/06/17.
 */

var devices = 1;    //keep track of the number of devices and use it to generate ids for each connecting device

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

jcond{
    isFog: sys.type == "fog";
    isDevice: sys.type == "device";
}

//function to share the data only at the fog level
jasync {isFog} function shareOnFog(){
    sensingOut.start(); //start sharing on the fog
}

shareOnFog();

function spotFlowFunc(inputFlow){
    return inputFlow;
}


jsync {isDevice} function getAssignedID() {
    return devices++;
}

jsync {isDevice} function getStreamKey(assignedID) {
    //use the assigned id to find the datastream and return the key
    for( var i = 0; i < spot.size(); i++ ){
        var lastValue = spot[i].getLastValue();
        if( lastValue == null )
            continue;
        if( lastValue.assignedID && lastValue.assignedID == assignedID )
            return spot[i].key;
    }
    console.error("Did not find Stream Key");
    return "null";
}

jsync {isDevice} function addBroadcastHook(){
    //since the broadcast at the C is not yet working, for now lets use J->C when we get to the device level
    assignment.addHook(function(pack){
        if( pack.origin === "parent" ){//only pay attention to broadcasts from the fog
            var message = pack.message;
            //since this is a broadcast, check if it concerns this node
            var datastream = null;

            for( var i = 0; i < spot.size(); i++ ){
                if( spot[i].key == message.key ){
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

//no need to use jcond to make this function run only at the fog level because no sharing will be done by the
//allocator at the device level
allocSensorIn.setTerminalFunction(function(data){
    //TODO data received, use J->J to send the data to the level below
    //For now let us use broadcaster to push the data down
    assignment.broadcast(data);   //data should have the structure in the response struct
});

addBroadcastHook();