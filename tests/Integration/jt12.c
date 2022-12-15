
jtask* localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(800000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jtask* {typeAonly} answerme(char *s, char *t) {
    printf("Source : %s... -- %s\n", s, t);
}


int main(int argc, char *argv[])
{
    localyou(10, "cxxxxxxxx");
    return 0;
}
