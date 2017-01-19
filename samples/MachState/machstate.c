                                                                                                 
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static void
sigHandler(int sig)
{
  printf("Hey! Caught signal %d\n", sig);
}


int  main()
{

  if (signal(SIGINT, sigHandler) == SIG_ERR)
    {
    printf("ERROR! Could not bind the signal hander\n");
  exit(1);
    }

  while(1) {
    printf("......");
    sleep(1);
    printf("\n");
  }
}

