let count = 10;

jtask* function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
}

setInterval(()=> {
    console.log("Calling compyou.. ");
    compyou(" String = " + count++);
}, 1000);
