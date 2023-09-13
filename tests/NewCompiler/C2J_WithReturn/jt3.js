let count = 0;

jsync char[60] [reuse = false] compyou(str: char*) {
    count++;
    console.log(count, str);
    return "hello -- " + count + " " + str;
}

setInterval(()=> {
    //console.log("hello.. main loop ");
}, 1000);
