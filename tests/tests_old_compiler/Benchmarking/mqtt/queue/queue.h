#ifndef __QUEUE_H__
#define __QUEUE_H__

#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/queue.h>

struct queue_entry {
    void *data;
    STAILQ_ENTRY(queue_entry) entries;
};

STAILQ_HEAD(queue, queue_entry);

struct queue queue_create();

void queue_init(struct queue *q);

void queue_error();

struct queue_entry *queue_new_node(void *data);
void queue_insert_head(struct queue *q, struct queue_entry *e);

void queue_insert_tail(struct queue *q, struct queue_entry *e);

struct queue_entry *queue_peek_front(struct queue *q) ;

struct queue_entry *queue_pop_head(struct queue *q);

#endif
