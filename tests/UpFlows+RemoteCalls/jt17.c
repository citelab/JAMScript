
int value = 10;

jasync localyou(int c, char* s) {
    while(1) {
        jsys.sleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        ppp.write(value++);
    }
}

jasync localme(int c, char* s) {
    jarray char qqqqwriter[40] = "!eeeeeeeeee!";
    while(1) {
        jsys.sleep(100000);
        printf("############-->>> Hello ME  %d, %s\n", c, s);
        qqqq.write(&qqqqwriter);
    }
}

int main(int argc, char* argv[]) {
    localme(10, "pushing data to qq");
    localyou(10, "pushing data to ppp");
    return 0;
}
