/**
 * Created by Richboy on 27/06/17.
 */
jdata{
    int x as logger;
}

function waitForData(){
    if( x.size() == 0 )
        setTimeout(waitForData, 1000);
    else
        setInterval(readData, 1000);
}

function readData(){
    for(var i = 0; i < x.size(); i++){
        console.log(x[i].dev_id + ": " + x[i].lastValue());
    }
}

waitForData();