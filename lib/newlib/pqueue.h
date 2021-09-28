#pragma once

// https://github.com/davidxia/c_code/blob/master/algos_with_c/ch10/heap.c

typedef struct Heap_ {
    int size;
    int (*compare)(const void *key1, const void *key2);
    void (*destroy)(void *data);
    void **tree;
} Heap;

void heap_init(Heap *heap, int (*compare)(const void *key1, const void *key2),
               void (*destroy)(void *data));
void heap_destroy(Heap *heap);
int heap_insert(Heap *heap, const void *data);
int heap_extract(Heap *heap, void **data);

#define heap_size(heap) ((heap)->size)

typedef Heap PQueue;

#define pqueue_init heap_init
#define pqueue_destroy heap_destroy
#define pqueue_insert heap_insert
#define pqueue_extract heap_extract
#define pqueue_peek ((pqueue)->tree == NULL ? NULL : (pqueue)->tree[0])
#define pqueue_size heap_size