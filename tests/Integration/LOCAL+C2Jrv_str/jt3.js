let count = 0;

jtask function compyou(str) {
    count++;
    console.log(count, str);
    return "hello -- " + count;
}

setInterval(()=> {
    //console.log("hello.. main loop ");
}, 1000);
