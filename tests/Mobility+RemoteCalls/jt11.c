
jtask* localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

jtask* answerme(char *s) {
    printf("Value string %s\n", s);
}


int main(int argc, char *argv[])
{
    localyou(10, "cxxxxxxxx");
    return 0;
}
