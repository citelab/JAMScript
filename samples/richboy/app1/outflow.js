/**
 * Created by Richboy on 21/06/17.
 */
"use strict";


var gen = {
    next: function(){
        return {done: false, value: Math.random() * 100};
    }
};

jdata{
    q as flow with flowGen of gen;
    p as outflow of q;
}

p.start();


function flowGen(flow){
    return flow.where(function(obj){return +obj.data % 2 == 0;});
}