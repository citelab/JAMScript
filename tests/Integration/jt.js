let count = 0;

jtask* function you(str) {
    count++;
    if ((count % 1000) === 0) {
        console.log(count);
    }
}

//setInterval(()=> {
    //console.log("hello.. main loop ");
//}, 100);
