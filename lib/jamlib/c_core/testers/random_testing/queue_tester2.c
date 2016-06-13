#include "simplequeue.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <pthread.h>

#include "nvoid.h"
#include "command.h"

/*
 * Simple tester for the simplequeue..
 */

void *read_queue(void *arg)
{
    simplequeue_t *q = (simplequeue_t *)arg;
    int len;

    while(1) {
        nvoid_t *s = queue_deq_timeout(q, 2000);
        if (s == NULL)
            printf("Timeout.. \n");
        else
            printf("Read %s.. length %d\n", s->data, s->len);
    }

    return NULL;
}

char buf[64];


int main(void)
{
	simplequeue_t *q = queue_new(true);
    command_t *t = command_new("REXEC", "DEVICE", "activity1", "testactivity_Id", "testAttribute", "");
    
    command_print(t);

    printf("Size of t %d\n", sizeof(command_t));

    queue_enq(q, t, sizeof(command_t));
    nvoid_t *nv = queue_deq(q);
    
    printf("Value len %d\n", nv->len);
    command_t *s = (command_t *)nv->data;
    command_print(s);
    
    if (command_equal(t, s))
        printf("Commands are equal\n");
    else
        printf("COmmands are NOT equal\n");

    queue_delete(q);
}
