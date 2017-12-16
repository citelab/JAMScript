/**
 * Created by Richboy on 29/06/17.
 */
jdata{
    sensingIn as inflow of app://sensing.sensingOut;
    carRequestIn as inflow of app://car.carRequestOut;

    //sorts of replicates the spot struct in sensor.js
    struct spots{
        char* label;           //parking label
        char* postcode;
        char* address;
        int parkingDuration;
        char* status;             //free, onhold, assigned
        int assignedID;
        char* key;
    } spots as logger;

    freeSpots as flow with freeSpotsFlow of spots;  //available parking spots

    struct alloc{
        char* status;   //assigned, onhold, free
        char* carID;      //The binding car
        int slotID;
        int postcode;
        char* key;
    } alloc as logger; //NOT SURE YET if we may need to restrict this to fog alone

    allocFlow as flow with flowFunc of alloc;
    allocSenseOut as outflow of allocFlow;  //outflow for sensor.js

    struct assign{
        int messageType;    //1=found a slot, 2=no slot found
        char* label;        //The label of the assigned spot
        char* slotID;       //the assigned id of this spot
        char* carID;        //The if for the requesting car would just be passed back with the data
        int isPreferred;    //if this request is same as the preferred area requested
        char* postcode;     //the post code area of the parking spot being sent
        int duration;       //The allowed maximum parking duration
        int timeout;        //For message type 2 or message 1 with isPreferred = 0. This tells when to ask for another slot. (in milliseconds)
    } assign as logger; //NOT SURE YET if we may need to restrict this to fog alone

    assignFlow as flow with flowFunc of assign;
    allocResponseOut as outflow of assignFlow;  //outflow for car.js
}

function flowFunc(inputFlow){
    return inputFlow;
}

//TODO add a functionality where a fog sends a request to the cloud for free spot information on other fogs
//TODO Also, check if this fog manages the postcode that is in the preferred request before assigning one, else ask the cloud to find the fog

//keep track of spots that a car has rejected. So that when they re-request, we won't end up sending same spot to them
var carRejects = {};
var deviceMap = {}; //to optimize finding devices as opposed to looping with arrays when the number of devices grow large

//read the data passed in from the sensing application. This should only work in the Fog
sensingIn.setTerminalFunction(function(data){
    //console.log(data);

    //check that this message has a valid key else skip it.
    if( data.key === "null" )
        return;

    //find device stream
    var datastream = deviceMap[data.key];

    if( !datastream ){   //this stream doesn't yet exist so create a new one
        datastream = spots.addDatastream(data.key);
        deviceMap[data.key] = datastream;
        deviceMap[data.assignedID] = datastream;    //save this reference as well as that of the key's
        new OutFlow("allocatingOut", Flow.from(datastream)).setTransformer(input => {input[jsys.type] = JAMManager.deviceID; return input;}).start();    //create and start an outflow to listen for data
    }

    //log the data on this stream
    datastream.log(data);
});

carRequestIn.setTerminalFunction(function(data){
    switch(data.messageType - 0){
        case 1: //request
            //first check for the preferred location
            var objects = freeSpots.getCustomResult();  //computed free slots
            var keys = Object.keys(objects);
            var spot = Flow.from(keys)
                .select(key => computedFree[key])
                .where(obj => obj.postcode == data.postcode)
                .findFirst();

            if( !spot ) { //we could not find any spot
                //so we check for a spot that is nearby if the user has indicated that option
                if( data.openToNearbyLocation == 1 ){
                    spot = Flow.from(keys)
                        .select(key => computedFree[key])
                        .where(obj => { //ignore all those the car has rejected
                            if( carRejects[data.carID] )
                                return !carRejects[data.carID][obj.postcode];
                            return true;
                        })
                        .where(() => true)  //TODO add an implementation that gets the closest area to the requesting car
                        .findFirst();

                    if( spot != null ){
                        assign.getMyDataStream().log({
                            messageType: 1,
                            label: spot.label,
                            slotID: spot.assignedID,
                            carID: data.carID,
                            isPreferred: 0,
                            postcode: spot.postcode,
                            duration: spot.parkingDuration,
                            timeout: 0
                        });

                        var datastream = deviceMap[spot.assignedID];    //find the datastream
                        //log the changes so it can also be shared on the outflow channel
                        var log = datastream.getLastValue();
                        log.status = "onhold";
                        datastream.log(log);
                        //share this on the channel that sensing is listening on
                        alloc.getMyDataStream().log({
                            status: "onhold",
                            carID: data.carID,
                            slotID: spot.assignedID,
                            postcode: spot.postcode,
                            key: datastream.getDeviceId()
                        });

                        return;
                    }
                }

                //inform car that no spot was found
                assign.getMyDataStream().log({
                    messageType: 2,
                    label: null,
                    slotID: -1,
                    carID: data.carID,
                    isPreferred: 1,             //that's what the user wanted
                    postcode: data.postcode,    //same as the request
                    duration: 0,
                    timeout: 60 * 1000  //just put a minute. Ideally this could be a predictive implementation time
                });
            }
            else{//We found a free spot. send spot to car
                assign.getMyDataStream().log({
                    messageType: 1,
                    label: spot.label,
                    slotID: spot.assignedID,
                    carID: data.carID,
                    isPreferred: 1,
                    postcode: spot.postcode,
                    duration: spot.parkingDuration,
                    timeout: 0
                });

                var datastream = deviceMap[spot.assignedID];    //find the datastream
                //log the changes so it can also be shared on the outflow channel
                var log = datastream.getLastValue();
                log.status = "occupied";
                datastream.log(log);
                //share this on the channel that sensing is listening on
                alloc.getMyDataStream().log({
                    status: "occupied",
                    carID: data.carID,
                    slotID: spot.assignedID,
                    postcode: spot.postcode,
                    key: datastream.getDeviceId()
                });
            }

            break;
        case 2: //accept
            var datastream = deviceMap[data.slotID];    //find the datastream
            //log the changes so it can also be shared on the outflow channel
            var log = datastream.getLastValue();
            log.status = "occupied";
            datastream.log(log);
            //share this on the channel that sensing is listening on
            alloc.getMyDataStream().log({
                status: "occupied",
                carID: data.carID,
                slotID: data.slotID,
                postcode: data.postcode,
                key: datastream.getDeviceId()
            });
            break;
        case 3: //reject
            //add to rejects for this car so that when this car requests again, we will not serve this spot
            //we are adding the entire area as being rejected by this car. Area here is just a parking lot
            var rejects;
            if( carRejects[data.carID] )
                rejects = carRejects[data.carID];
            else
                rejects = {};

            rejects[data.postcode] = true;
            carRejects[data.carID] = rejects;

            //this slot is now free, so update state and inform sensor
            var datastream = deviceMap[data.slotID];    //find the datastream
            //log the changes so it can also be shared on the outflow channel
            var log = datastream.getLastValue();
            log.status = "free";
            datastream.log(log);
            //share this on the channel that sensing is listening on
            alloc.getMyDataStream().log({
                status: "free",
                carID: data.carID,
                slotID: data.slotID,
                postcode: data.postcode,
                key: datastream.getDeviceId()
            });
            break;
        case 4: //leave
            //this slot is now free, so update state and inform sensor
            var datastream = deviceMap[data.slotID];    //find the datastream
            //log the changes so it can also be shared on the outflow channel
            var log = datastream.getLastValue();
            log.status = "free";
            datastream.log(log);
            //share this on the channel that sensing is listening on
            alloc.getMyDataStream().log({
                status: "free",
                carID: data.carID,
                slotID: data.slotID,
                postcode: data.postcode,
                key: datastream.getDeviceId()
            });

            //clear rejected list for this car
            delete carRejects[data.carID];
            break;
    }
});


function freeSpotsFlow(inputFlow){
    inputFlow.rootFlow.shouldCache = false; //we do not want the data to cache through the pipe

    return inputFlow.select("data").runningReduce({custom: (cv, nv) => {
        if( cv == null )
            return {};
        //check if the input (which is nv) is free or occupied
        if( nv.status == "free" )   //add to the object which is the current value
            cv[nv.key] = nv;
        else
            delete cv[nv.key]; //remove this property
        return cv;
    }});

    // return inputFlow.select(source => source.toIterator()).selectFlatten()
    //     .where(stream => !stream.isEmpty()).select(stream => stream.lastValue()).where(json => json.status == "free");
}

allocSenseOut.start();
allocResponseOut.start();