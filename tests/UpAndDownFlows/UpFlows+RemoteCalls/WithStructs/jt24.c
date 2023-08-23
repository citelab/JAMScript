jtask* localyou(int c, char* s) {

    struct _zz tt = {.x = 10, .yy = 1.323, .qq = 14, .ddd = 23.545};

    while(1) {
        jsleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        xx.write(&tt);
        printf("X = %d, YY = %f\n", tt.x, tt.yy);
    }
}

int main(int argc, char* argv[]) {
    localyou(10, "message-to-local-task");
    return 0;
}
