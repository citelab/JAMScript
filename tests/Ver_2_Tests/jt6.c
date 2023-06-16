
jtask* localyou(int c, char *s) {
    while(1) {
        jsleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "cxxxxxxxx");
    return 0;
}
