let count = 0;

jsync int compyou(str: char[]) {
    count++;
    console.log(count, str);
    return count * 4;
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 2000);
