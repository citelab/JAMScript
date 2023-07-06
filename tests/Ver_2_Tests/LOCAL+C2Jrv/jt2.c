int compyou(char *s);

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
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        x = compyou(x = s * 1 + !!0);
        printf("---->> Value = %d\n", x);
        if (1)
            2;
        else
            3;
    }
}

int main(int argc, char *argv[])
{
    localme(10, "message-to-c-local-node");
    localyou(10, "message-to-j");
    return 0;
}
