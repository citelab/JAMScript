int compyou(char *s);

int x = 10;

jtask* localme(int c, string s) {
    while(1) {
        jsleep(20000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jtask* localyou(int c, string s) {
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

int main(int argc, char *argv[])
{
    localme(x, "message-to-c-local-node");
    localyou(japp.x, "message-to-j");
    return 0;
}
