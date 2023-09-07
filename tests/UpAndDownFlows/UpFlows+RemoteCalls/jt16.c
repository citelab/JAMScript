int value = 10;

jasync localyou(int c, char* s) {
    while(1) {
        jsys.sleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        ppp.write(value++);
    }
}

jasync localme(int c, char* s) {
    struct _ppp {
        int write;
    } ppp = {.write = 4};
    printf("%d\n", ppp.write);
    jarray char qqqqwritor[40] = "!eeeeeeeeee!";
    while(1) {
        jsys.sleep(100000);
        printf("############-->>> Hello ME  %d, %s\n", c, s);
        qqqq.write(&qqqqwritor);
    }
}

int main(int argc, char* argv[]) {
    localme(10, "pushing data to qq");
    localyou(10, "pushing data to ppp");
    return 0;
}
