int value = 10;

jasync localyou(int c, char* s) {
    while(1) {
        jsys.sleep(10000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        ppp.write(c * 100000 + value++);
    }
}

int main(int argc, char* argv[]) {
    localyou(jsys.serial, "pushing data to qq");
    return 0;
}
