jasync localyou(int c, char* s) {
    jarray int asdf[3] = {1, 3};

    struct _zz tt = {.x = 10, .yy = 1.323, .qq = asdf, .ddd = 23.545};

    while(1) {
        jsys.sleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        xx.write(&tt);
        printf("X = %d, YY = %f\n", tt.x, tt.yy);
        tt.x++;
    }
}

int main(int argc, char* argv[]) {
    localyou(10, "message-to-local-task");
    return 0;
}
