char *compyou(char *s);

jtask* localme(int c, char *s) {
    while(1) {
        //jsleep(2000);
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
    }
}

int main(int argc, char *argv[])
{
 //   localme(10, "cxxxxyyyy");
    localyou(10, "cxxxxxxxx");
    return 0;
}
