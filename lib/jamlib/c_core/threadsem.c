/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/
#include <assert.h>
#include <unistd.h>
#include <stdlib.h>

#include "task.h"

#include "threadsem.h"

threadsem_t *threadsem_new()
{
    threadsem_t *t = (threadsem_t *)calloc(1, sizeof(threadsem_t));
    assert(t != NULL);
    
    int res = pipe(t->fildes);
    assert(res == 0);
    
    return t;
}


void task_wait(threadsem_t *sem)
{
    char buf[2];
    
    fdwait(sem->fildes[0], 'r');
    fdread(sem->fildes[0], buf, 1);
}


void thread_signal(threadsem_t *sem)
{
    char *str = "1";
    int res = write(sem->fildes[1], str, 1);
    assert(res == 1);         
}


