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
    }
};

spot.subscribe(listener);

