char *compyou(char *s);


jtask* localyou(int c, char *s) {
    while(1) {
        jsleep(10000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jtask* testfunc(int x) {
    printf("------------ Value of x %d\n", x);
}


int main(int argc, char *argv[])
{
    localyou(10, "local-message...");
    return 0;
}
