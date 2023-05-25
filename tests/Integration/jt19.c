
jtask* localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(10000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "message-to-local-task");
    return 0;
}
