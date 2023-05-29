char *compyou(char *s);

jtask* localme(int c, char *s) {
    while(1) {
        jsleep(200000);
        printf("############-->>> Hello  ME  %d... %s\n", c, s);
    }
}

jtask* localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        y = compyou(s);
        printf("---->> Value = %s\n", y);
        free(y);
    }
}

int main(int argc, char *argv[])
{
    localme(10, "message-from-local-c");
    localyou(10, "message-to-j");
    return 0;
}
