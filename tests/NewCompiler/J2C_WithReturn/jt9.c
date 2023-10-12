jreuse {
    test(old, new) {
        return old.arg_0 == new.arg_0;
    }
    whatever(old, new) {
        return true;
    }
}


jasync [reuse_history = 2] localyou(int c, char *s) {
    for(;1;) {
        jsys.sleep(1000000);
        printf("... ############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jsync int[30] [reuse = whatever, reuse_history = 5] reuse_array(int q[]) {
    jarray int i[30] = {1, 3, 5, 6};
    return i;
}

jsync int [reuse = test] get_a_value(int x) {
    printf("Value of x %d\n", x);
    return x;
}

int main(int argc, char *argv[]) {
    localyou(10, "cxxxxxxxx");
    return 0;
}
