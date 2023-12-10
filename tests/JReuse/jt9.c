
jreuse {
    test(old, new) {
        return old.arg_0 == new.arg_0;
    }
    whatever(old, new) {
        return true;
    }
}


jcond {
    test(my, your) {
        return true;
    }
}


jasync {test} [reuse_history = 2] localyou(int c, char *s) {
    jarray int q[1] = {1};
    for(;1;) {
        jsys.sleep(1000000);
        reuse_array(&q);
        printf("... ############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jsync int[30] {test} [reuse = whatever, reuse_history = 5] reuse_array(int q[]) {
    printf("whatever\n");
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
