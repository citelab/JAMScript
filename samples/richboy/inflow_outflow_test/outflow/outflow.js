/**
 * Created by Richboy on 14/07/17.
 */

jdata{
    int x as logger;
    q as flow with flowGen of x;
    p as outflow of q;
}

p.start();


function flowGen(inputFlow){
    return inputFlow.where(obj => +obj.data % 2 == 0);    //only pass even numbers
}