
int count = 0;

jtask* localyou(int c, char *s) {
    int x;
    while(1) {
	xx.read(&x);
	count++;
    }
}

jtask* localme(int c, char *s) {
    while(1) {
	jsleep(1000000);
        printf("Received: %d\n", count);
	fflush(stdout);
	count = 0;
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "message-to-local-task");
    localme(20, "hi.. this is local");
    return 0;
}
