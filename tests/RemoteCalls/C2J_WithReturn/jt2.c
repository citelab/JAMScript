int x = 10;

jarray long unsigned long pp[10] = {0, 1, [5] = 2}, qq[10];

jarray char test[100] = "hi guys timothy chen here", b[5] = {'a', 'b', 'c'};

jasync localme(int c, char s[]) {
    printf("HELLO? LOCAL ME?\n");
    while(1) {
        if (x == 0)
            continue;
        jsys.sleep(1300000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s->data);
        x = mytest.compyou(s);
        printf("---->> Value = %d\n", x);
    }
}

jasync localyou(int c, char s[]) {
    printf("HELLO? LOCAL YOU?\n");
    int x;
    jarray int test[40];
    while(1) {
        subname.bazinga.read(&test);
        global.printf("test length... %u\n", test.len);
        jsys.sleep(1000000);
        c = arrayLength(&test, s);
        global.printf("############-->>> Hello YOU  %d, %s\n", c, s->data);
        if (c > 20)
            mytest.x = 0;
    }
}

int main(int argc, char* argv[]) {
    jarray char memessage[30] = "message-to-c-local-node", yumessage[30] = "message-to-j";
    localme(x, &memessage);
    localyou(mytest.x, &yumessage);
    return 0;
}
