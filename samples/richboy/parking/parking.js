/**
 * Created by Richboy on 29/06/17.
 */
jdata{
    struct spot{
        char* label;
        float longitude;
        float latitude;
        int isFree;
        int parkingDuration;
        int accessibility;
    } spot as logger;
}


var listener = {
    notify: function(key, entry){
        console.log(key + " - " + JSON.stringify(entry));

        //get all parking spots that are available
        var freeSpots = Flow.from(spot).select((source) => source.toIterator()).selectFlatten()
            .select((stream) => stream.lastValue().log).where((json) => json.isFree == 1).collect(Flow.toArray);

        //TODO
        // broadcast to all cars listening for a free slot. Alternatively, we could broadcast to the Fogs who will
        // further filter the data to areas within their scope and send them to connected devices.
        JManager.broadcastMessage("domain:freeSpots", freeSpots);
    }
};

spot.subscribe(listener);

