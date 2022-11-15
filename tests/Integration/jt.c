void you(char *s);

jtask* localme(int c, char *s) {
    while(1) {
        jsleep(20000);
        printf("############-->>> Hello  ME  %d... %s", c, s);
    }
}

jtask* localyou(int c, char *s) {
    while(1) {
        jsleep(10000);
        printf("############-->>> Hello YOU  %d, %s", c, s);
        you(s);
    }
}

int main(int argc, char *argv[])
{
    localme(10, "cxxxxyyyy");
    localyou(10, "cxxxxxxxx");
    return 0;
}
