

jtask* localyou(int c, char *s) {
//    struct zz = {.x = 10, .yy = 2.56};

    while(1) {
        jsleep(1000000);
        printf("############-->>> Hello YOU  %d, %s\n", c, s);
	xx.write(&zz);
    }
}

int main(int argc, char *argv[])
{
    localyou(10, "message-to-local-task");
    return 0;
}
