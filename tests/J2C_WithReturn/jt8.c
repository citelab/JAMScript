
jasync localyou(int c, char *s) {
    while(1) {
        jsys.sleep(1000000);
        printf("... ############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jsync int get_a_value(int x) {
    printf("Value of x %d\n", x);
    return x;
}

int main(int argc, char *argv[]) {
    localyou(10, "cxxxxxxxx");
    return 0;
}
