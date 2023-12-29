let count = 10;

jtask function compyou(str) {
    count++;
    console.log(count, str);
    return "hello -- ";
}

setInterval(()=> {
    console.log("hello.. main loop.. calling the C function testfunc..  ");
    testfunc(count);
}, 100);
