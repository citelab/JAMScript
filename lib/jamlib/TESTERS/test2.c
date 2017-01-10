#include <stdio.h>

#include <sys/time.h>

double activity_getseconds()
{
  struct timeval tp;
  if (gettimeofday(&tp, NULL) < 0)
    {
      printf("ERROR!! Getting system time..");
      return 0;
    }

  return tp.tv_sec + tp.tv_usec * 1E-6;
}


int main(int argc, char *argv[])
{
  printf("Time in seconds %f\n", activity_getseconds());
}
