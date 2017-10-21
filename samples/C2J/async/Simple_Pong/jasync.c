#include <stdio.h>

jactivity_t* pong();

int main(int argc, char **argv) {

  long long btime;
  int i;

  for (i = 0; i < argc; i++)
    printf("Argv[%d] = %s\n", i, argv[i]);
  
  while (1)
    {
      printf("Calling pong..\n");
      pong();
	printf("After pong \n");
      usleep(1000);
    }

}
