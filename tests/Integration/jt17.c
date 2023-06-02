char *compyou(char *s);

jtask* {typeAonly} localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    //    y = compyou(s);
    //    printf("---->> Value = %s\n", y);
    }
}

jtask int get_a_value(int x) {
    printf("Value of x %d\n", x);
    return x;
}

int main(int argc, char *argv[])
{
 //   localme(10, "cxxxxyyyy");
    localyou(10, "cxxxxxxxx");
    return 0;
}
