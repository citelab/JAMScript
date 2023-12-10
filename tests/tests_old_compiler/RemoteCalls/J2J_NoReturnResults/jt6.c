
jtask* localyou(int c, char *s) {
    while(1) {
        jsleep(1000000);
        printf("############-->>> Hello YOU -- only local tasks...  %d, %s\n", c, s);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "cxxxxxxxx");
    return 0;
}
