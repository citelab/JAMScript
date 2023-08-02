int value = 10;

struct _ppp {
    int write;
} t;

int count = 0;


jtask* localyou(int c, char *s) {
    while(1) {
        ppp.write(value++);
	count++;
	jsleep(50);
    }
}

jtask* localme(int c, char *s) {
    struct __xx q = {.yy=2, .zz=2.3};
    while(1) {
        jsleep(1000000);
        printf("Sent %d\n", count);
	count = 0;
	fflush(stdout);
    }
}

int main(int argc, char *argv[])
{
    localme(10, "pushing data to qq");
    localyou(10, "pushing data to ppp");
    return 0;
}
