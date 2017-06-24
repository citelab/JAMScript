

jasync function doubler(b, complete) {
    var a = b*2;
    complete("hey from doubler");
}