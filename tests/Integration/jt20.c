
int count = 10;

jtask* localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
	xx.write(count++);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "message-to-local-task");
    return 0;
}
