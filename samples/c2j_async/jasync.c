#include <stdio.h>

jactivity_t* pong();



int main() {

  long long btime;
  int i;

  // this is actually bad.. just for testing..
  while (1)
    {
      //  btime = activity_getseconds();
      //      for (i = 0; i < 10000; i++)
	pong();
	//      int elapsed = activity_getseconds() - btime;

	//      printf("Rate: %f per second\n", (1000.0 * 1000000.0)/elapsed);
    }

}
