let count = 0;

japp mytest {}

jdata subname {
    int bazinga[40] as dflow;
}

jsync int compyou(str: char[]) {
    count++;
    console.log(count, str);
    return count * 4;
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 2000);
