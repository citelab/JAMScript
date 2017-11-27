#include <stdio.h>
int perank;
int count = 0;

jactivity_t *ping(int);

jactivity_t *regme(char *, jcallback);

void regcallback(char *msg) {
  if (msg != NULL)
    perank = atoi(msg);
  else
    perank = -1;

  printf("Perank %d\n", perank);

  ping(perank);
}

int counter = 1;

jasync pong() {
  //  usleep(50000);
    printf("pong received... %d\n", counter++);
    ping(perank);
}

int main() {
  printf("Registering...");
  regme("hello", regcallback);
  return 0;
}
