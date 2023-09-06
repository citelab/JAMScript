let count = 0;

jsync char[20] [reuse = false] compyou(str: char*) {
    count++;
    console.log(count, str);
    return "hello -- " + count;
}

setInterval(()=> {
    //console.log("hello.. main loop ");
}, 1000);
