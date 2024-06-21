

let count = 0;

jcond {
    fogonly(my, your) {
        return my.type === 'fog';
    }
}

jasync {fogonly} callXAB(str: char*) {
    count++;
    console.log(count, str);
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 1000);
