let count = 0;

function you(str) {
    count++;
    console.log("String.. ", str, " count ", count);
}

while (1) {
    await jsys.sleep(1000);
    console.log("                             hello.. main loop ");
    you("hello..");
}

