jasync localyou(int c, char *s) {
    jarray char gaming_str[30] = "gaming!";
    struct _zz tt = {.x = 10, .yy = 1.323, .str = gaming_str};

    while(1) {
        jsys.sleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        xx.write(&tt);
        tt.x++;
    }
}

int main(int argc, char *argv[]) {
    localyou(10, "message-to-local-task");
    return 0;
}
