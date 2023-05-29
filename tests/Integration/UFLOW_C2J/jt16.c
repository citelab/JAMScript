int value = 10;

struct _ppp {
    int write;
} t;


jtask* localyou(int c, char *s) {
    while(1) {
        jsleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
	ppp.write(value);
    }
}

jtask* localme(int c, char *s) {
    while(1) {
        jsleep(100000);
        printf("############-->>> Hello ME  %d, %s\n", c, s);
	zzz.write(value);
    }
}

int main(int argc, char *argv[])
{
    localme(10, "pushing data to qq");
    localyou(10, "pushing data to ppp");
    return 0;
}
