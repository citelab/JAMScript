/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/

#ifndef __THREADSEM_H__
#define __THREADSEM_H__

typedef struct _threadsem_t
{
    int fildes[2];

} threadsem_t;


threadsem_t *threadsem_new();
void task_wait(threadsem_t *sem);
void thread_signal(threadsem_t *sem);

#endif
