#include "simplequeue.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <pthread.h>

#include "nvoid.h"

#include <nanomsg/nn.h>
#include <nanomsg/pubsub.h>
#include <assert.h>

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
    int i, s, rc;
    simplequeue_t *q;
    for (i = 0; i < 1000; i++) 
    {
	               q = queue_new(true);
        queue_delete(q);
//    printf("Value of s %d\n", s);
    }
}
