int value = 10;

struct _ppp {
    int write;
} t;


jtask* localyou(int c, char *s) {
    coverage();
    while(1){ 
        jsleep(100000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
        ppp.write(value++);
    }
}

jtask* localme(int c, char *s) {
    struct __xx q = {.yy=2, .zz=2.3};
    coverage();
    while(1){ 
        jsleep(100000);
        printf("############-->>> Hello ME  %d, %s\n", c, s);
	//	zzz.write(&q);
    }
}

int main(int argc, char *argv[])
{
    localme(10, "pushing data to qq");
    localyou(10, "pushing data to ppp");
    return 0;
}
