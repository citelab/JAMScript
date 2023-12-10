#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/queue.h>
#include "queue.h"

inline struct queue queue_create() {
    struct queue q = STAILQ_HEAD_INITIALIZER(q);
    return q;
}

inline void queue_init(struct queue *q) {
    STAILQ_INIT(q);
}

inline void queue_error() {
    fprintf(stderr, "Fatal error in queue operations\n");
    exit(1);
}

inline struct queue_entry *queue_new_node(void *data) {
    struct queue_entry *entry = (struct queue_entry*) malloc(sizeof(struct queue_entry));
    if(!entry) {
        queue_error();
    }
    entry->data = data;
    return entry;
}

inline void queue_insert_head(struct queue *q, struct queue_entry *e) {
    STAILQ_INSERT_HEAD(q, e, entries);
}

inline void queue_insert_tail(struct queue *q, struct queue_entry *e) {
    STAILQ_INSERT_TAIL(q, e, entries);
}

inline struct queue_entry *queue_peek_front(struct queue *q) {
    return STAILQ_FIRST(q);
}

inline struct queue_entry *queue_pop_head(struct queue *q) {
    struct queue_entry *elem = queue_peek_front(q);
    if(elem) {
        STAILQ_REMOVE_HEAD(q, entries);
    }
    return elem;
}
