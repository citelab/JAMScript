
jasync localme(int c, char *s) {
    while(1) {
        jsys.sleep(200000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jasync localyou(int c, char *s) {
    while(1) {
        jsys.sleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        callXAB(s);
    }
}

int main(int argc, char *argv[]) {
    localme(10, "message-from-local-c");
    localyou(10, "message-to-j");
    return 0;
}
