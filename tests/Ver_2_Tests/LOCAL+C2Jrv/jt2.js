let count = 0;

jtask function compyou(str) {
    count++;
    console.log(count, str);
    return count * 4;
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 2000);
