/**
 * Created by Richboy on 19/06/17.
 */
"use strict";

var array = [1, 2, 3, 4, 5];

jdata{
    a as flow with generator of array;
}

function generator(inputFlow){
    return inputFlow.select((input) => input * 5);
}

console.log(a.reduce(0, (prev, curr) => prev + curr));