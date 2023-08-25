let count = 0;

japp mytest {}

jdata subname {
    int bazinga[40] as dflow;
}

jsync int arrayLength(arr: int[], str: char[]) {
    console.log("---------------- " + str);
    console.log(arr);
    return arr.length;
}

jsync int compyou(str: char[]) {
    count++;
    console.log(count, str);
    return count * 4;
}

let array = [];

setInterval(()=> {
    console.log("writing to dflow...", array);
    array.push(count);
    subname.bazinga.write(array);
}, 2000);
