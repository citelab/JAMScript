int value = 10;

jtask*  localyou(int c, char *s) {
    char *y;
    while(1) {
        jsleep(100);
	qq.write(value++);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
    }
}


int main(int argc, char *argv[])
{
    localyou(10, "cxxxxxxxx");
    return 0;
}
