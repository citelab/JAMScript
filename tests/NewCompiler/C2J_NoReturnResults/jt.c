jasync localme(int c, char* s) {
    while(1) {
        jsys.sleep(2000000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jasync localyou(int c, char* s) {
    while(1) {
        jsys.sleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        you(s);
    }
}

int main(int argc, char* argv[]) {
    localme(10, "cxxxxyyyy");
    localyou(10, "a-message-for-j");
    return 0;
}
