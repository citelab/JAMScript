jtask* {tagAOnly} localme(int c, char *s) {
    while(1) {
        jsleep(2000);
        printf("############-->>> Hello  ME  %d... %s", c, s);
    }
}

jtask* localyou(int c, char *s) {
	  while(1) {
	      jsleep(1000);
	      printf("############-->>> Hello YOU  %d, %s", c, s);
				you(s);
	  }
}

int main(int argc, char *argv[])
{
	  localme(10, "cxxxxyyyy");
	  localyou(10, "cxxxxxxxx");
}
