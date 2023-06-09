#include "dpanel.h"
#include <unistd.h>

int main(int argc, char *argv[])
{
    dpanel_t *dp = dpanel_create("127.0.0.1", 6379, "testid...ddd");
    dpanel_start(dp);
    uftable_entry_t *uf = dp_create_uflow(dp, "test", "i");
    int x = 10;
    for (int i = 0; i < 100000; i++) {
        ufwrite(uf, i);
        x++;
        //int i = 100;
        //printf("Written... iteration %d\n", i);
        //usleep(100);
    }
    printf("Completed...100000 writes\n");
    dpanel_shutdown(dp);

}

//  dftable_entry+t *df = dp_create_dflow()
//  

// dfread(df, variable) 
// read the dflow into the variable - what is type matching?
// push the broadcast_task object onto the 

// task that is waiting on a variable goes to sleep there in the entry
// there can be many tasks sleeping at the same time... but they should be 
// at different variables - no two tasks can wait on the same variable at the same time.
// we can detect that at runtime - however, the compiler is responsible for preventing it.
// how ... still to be figured out!

// broadcaster - send/recv synchronization... how is it done??
// what should happen to old sends?? should we buffer them??s that are waiting on a variable should go to sleep in the
// variable's queue. 
// So, we expect more than one task to wait -- in a FIFO manner??
// 
// 


//
// CHALLENGE: how do we get to know the width?? This is number of writers?
// Each writer would not know the instantaneous group size.... in libraries like 
// MPI this is known... what do we do? 
// We can set the width to 0 - this is dynamic figure out by the data store... writer does not have clue 
// 

//
// MILESTONES - these are inserted by the compiler based on scopes of the programs
// 
// milestone_set() function operates on cnode...  there we maintain the jamclock as well
// jamclock_set() and jamclock_get() functions operates on cnode ..
// we have max_number of milestones already known... 
// so.. we maintain an iteration number and this number is bumped at to ensure 
// that jamclock increases monotonically... 
// 

// jamclock = iteration_count * number_of_milestones + milestone_number
// any jamclock / number_of_milestones --> iteration_count
// jamclock % number_of_milestones --> milestone_number

// we are ignoring the jamclock wraparound issues for now...
