
jtask* localyou(int c, char *s) {
    int x;
    while(1) {
	xx.read(&x);
        printf("Value read ... %d\n", x);
    }
}

jtask* localme(int c, char *s) {
    int x;
    while(1) {
	jsleep(1000000);
        printf("This is a message: %s\n", s);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "message-to-local-task");
    localme(20, "hi.. this is local");
    return 0;
}
