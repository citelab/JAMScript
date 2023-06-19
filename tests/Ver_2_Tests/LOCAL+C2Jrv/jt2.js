let count = 0;

// @FOG @DEVICE 


jtask function this_should_run(numer) {

    coverage();
    assert();

    console.log(TEST_KEY);

}

jtask function compyou(str) {
    count++;
    console.log(count, str);
    return count * 400;
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 1000);
