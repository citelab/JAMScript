
jtask* localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(800000);
        printf("\t##-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jtask* answerme(char *s, char *t) {
    printf("\tSource : %s... -- %s\n", s, t);
}


int main(int argc, char *argv[])
{
    localyou(10, "cxxxxxxxx");
    return 0;
}
