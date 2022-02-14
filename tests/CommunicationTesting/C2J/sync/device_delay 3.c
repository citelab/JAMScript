int getid();

int q, p;
jasync localme(int c, char *s) {
  while (1) {
    printf("@@@@@@@@@@\n");
    q = getid();
    printf("############-->>> Hello  ME  %d... %s... %d\n", c, s, q);
    //	  jsleep(200000);
  }
}

jasync localyou(int c, char *s) {
  while (1) {
    jsleep(30000);
    printf("############-->>> Hello YOU  %d, %s\n", c, s);
  }
}

jasync localtask() {
  while (1) {
    jsleep(200000);
    printf(">>>>>>> ddddd d\n");
  }
}

int main(int argc, char *argv[]) {
  localme(10, "cxxxxyyyy");
  localyou(10, "cxxxxxxxx");
  localtask();
}
