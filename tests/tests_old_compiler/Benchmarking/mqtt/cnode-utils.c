#include "cnode.h"
#include "tboard.h"

void temp_schedule_inject(cnode_t *cn, int type)
{
    tboard_t *tb = cn->tboard;

    switch (type) {
        case 0:
            tb->sched.len = 10000;
            tb->sched.rtslots = 1;
            tb->sched.syslots = 0;
            tb->sched.rtstarts[0] = 2000;
        case 1:
            tb->sched.len = 10000;
            tb->sched.rtslots = 0;
            tb->sched.syslots = 1;
            tb->sched.systarts[0] = 4000;
        case 2:
            tb->sched.len = 10000;
            tb->sched.rtslots = 1;
            tb->sched.syslots = 1;
            tb->sched.rtstarts[0] = 2000;
            tb->sched.systarts[0] = 4000;
        case 3:
            tb->sched.len = 10000;
            tb->sched.rtslots = 2;
            tb->sched.syslots = 1;
            tb->sched.rtstarts[0] = 2000;
            tb->sched.rtstarts[0] = 6000;
            tb->sched.systarts[0] = 4000;
    }
}