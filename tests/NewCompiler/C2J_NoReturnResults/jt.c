jasync localme(int c, char* s) {
    while(1) {
        jsys.sleep(2000000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jasync localyou(int c, char* s) {
    jarray int num[5] = {1, 2, 3, 4, 5};
    while(1) {
        jsys.sleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        you(s, &num);
    }
}

int main(int argc, char* argv[]) {
    localme(10, "cxxxxyyyy");
    localyou(10, "a-message-for-j");
    return 0;
}
