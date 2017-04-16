#include <stdio.h>

jactivity_t* pong();

int main() {

  long long btime;
  int i;

  // this is actually bad.. just for testing..
  while (1)
    {
      printf("Calling pong..\n");
      pong();
      sleep(1);
    }

}
