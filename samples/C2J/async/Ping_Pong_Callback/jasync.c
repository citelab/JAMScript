#include <stdio.h>

jactivity_t *ping(char*, jcallback);

void pong(char* abc) {
  printf("Received pong with message: %s\n", abc);
  ping("message from C", pong);
}


void start_ping() {
  printf("Sent a ping\n");
  ping("message from C", pong);
}

int main() {

  printf("Start pings..\n");
  start_ping();
  return 0;
}
