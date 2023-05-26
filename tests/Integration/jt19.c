
jtask* localyou(int c, char *s) {
    int x;
    while(1) {
	xx.read(&x);
        printf("Value read ... %d\n", x);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "message-to-local-task");
    return 0;
}
