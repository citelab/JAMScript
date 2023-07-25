int et = 0;

jtask* localyou(int c, char* s) {
    while(1) {
        jsleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jtask int {jcond_enable_task} get_a_value(int x) {
    printf("Value of x %d\n", x);
    return x;
}

jtask int toggle_jcond() {
    et = 1 - et;
    enable_task.write(et);
    return et;
}

int main(int argc, char**argv) {
    localyou(1, ")");
    return 0;
}
