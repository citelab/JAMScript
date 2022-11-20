let count = 10;

jtask function compyou(str) {
    count++;
    console.log(count, str);
    return "hello -- ";
}

setInterval(()=> {
    console.log("hello.. main loop.. calling the C function testfunc..  ");
    let x = get_a_value(count++);
    x.then((y)=> {
        console.log("Sdsdasdasdasdsd ", y);
    })
    console.log("Return value ", x);
}, 100);
