/**
 * Created by Richboy on 29/06/17.
 */
jdata{
    struct spot_struct{
        string label;
        int hgrid;
        int vgrid;
        int isFree;
        int parkingDuration;
    } spots as logger;

    struct bcast_struct{
        string label;
        int hgrid;
        int vgrid;
        int isFree;
        int parkingDuration;
    } bcast as broadcaster;

    available as flow with findFreeSpots of spots;  //available parking spots

    int cars as logger; //
}

//cars can request to have a parking spot. this can place them in a queue for first come basis and instead of a broadcast
//we can send a direct message (jasync) assigning them to a spot

//we can get and visualize statistic that shows the time left for each occupied parking spot and send them to jview or the visualizer
//we can find that out using Flow. We can connect this data to an OutFlow in another app that it's sole purpose is to visualize


function findFreeSpots(inputFlow){
    inputFlow.rootFlow.shouldCache = false; //we do not want the data to cache through the pipe

    return inputFlow.select(source => source.toIterator()).selectFlatten()
        .where(stream => !stream.isEmpty()).select(stream => stream.lastValue()).where(json => json.isFree == 1);
}

var spotsListener = {
    notify: function(key, entry){
        console.log(key + " - " + JSON.stringify(entry));

        //get all parking spots that are available
        //var freeSpots = Flow.from(spots).select(source => source.toIterator()).selectFlatten().where(stream => !stream.isEmpty())
        //    .select(stream => stream.lastValue()).where(json => json.isFree == 1).collect(Flow.toArray);

        var freeSpots = available.collect();

        // broadcast to all cars listening for a free slot.
        //based on jdata limitation of not sending arrays we need to broadcast each one separately
        for( let spotData of freeSpots )
            bcast.broadcast(spotData);
    }
};

var carsListener = function(key, entry){

};

spots.subscribe(spotsListener);

