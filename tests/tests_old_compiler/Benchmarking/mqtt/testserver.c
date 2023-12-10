#include <jam.h>

cnode_t *cnode;

void testfunc(int x){
    printf("------------ Value of x %d\n", x);
}
void call_testfunc(context_t ctx){
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    testfunc(t[0].val.ival);
}

void user_setup() {
    tboard_register_func(cnode->tboard, TBOARD_FUNC("testfunc", call_testfunc, "i", "", PRI_BATCH_TASK));
}


int main(int argc, char **argv) {
    cnode = cnode_init(argc, argv);
    user_setup();
    cnode_stop(cnode);
    cnode_destroy(cnode);
}








