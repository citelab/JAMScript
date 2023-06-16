jtask* localyou(int c, char* s) {
    struct __zz tt;
    while(1) {
        qq.read(&tt);
        printf("Value read %s\n", tt.u);
        free(tt.u);
    }
}


int main(int argc, char* argv[]) {
    localyou(10, "cxxxxxxxx");
    return 0;
}
