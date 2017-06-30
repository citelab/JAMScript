jasync doubler(int b, jcallback complete) {
    int a = b*2;
    char * b = "done";
    complete(b);
}

