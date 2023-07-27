int compyou(char* s);
int x = 10;

jarray long unsigned long pp[10] = {0, 1, [5] = 2}, qq[10];

jarray char test[100] = "hi guys timothy chen here", b[5] = {'a', 'b', 'c'};

jasync localme(int c, char s[]) {
    while(1) {
        if (x == 0)
            continue;
        jsleep(20000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jasync localyou(int c, char s[]) {
    int x;
    while('1' - '0') {
        jsleep(10000);
        global.printf("############-->>> Hello YOU  %d, %s\n", c, s);
        x = compyou(s);
        printf("---->> Value = %d\n", x);
        printf("---->> Global= %d\n", japp.x);
        if (1)
            2;
        else
            3;
    }
}

int main(int argc, char* argv[]) {
    localme(x, "message-to-c-local-node");
    localyou(japp.x, "message-to-j");
    return 0;
}
