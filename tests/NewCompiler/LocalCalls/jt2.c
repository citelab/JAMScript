jasync localme(int c, char *s) {
    while(1) {
        jsys.sleep(2000000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jsync void localme2(int c, char* s) {
    jsys.sleep(200000000);
    printf("############-->>> Hello ME2  %d... %s\n", c, s);
}

jasync localyou(int c, char *s) {
    while(1) {
        jsys.sleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jsync int[2] localyou2(int c, char s[]) {
    jarray int bb[2] = {c, c};
    printf("############-->>> Hello YOU2 %d... %s\n", c, s->data);
    return bb;
}

void testcallgraph() {
    printf("hi...\n");
}


int main(int argc, char *argv[]) {
    localme(10, "cxxxxyyyy");
    localme2(10, "dxxxxyyyy");
    localyou(10, "a-message-for-j");
    jarray char qq[30] = "b-message-for-j";
    localyou2(10, &qq);
    testcallgraph();
    return 0;
}
