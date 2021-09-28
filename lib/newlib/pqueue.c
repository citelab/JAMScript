#include <stdlib.h>
#include <string.h>
#include "pqueue.h"


/* Define private macros used by heap implementation */
#define heap_parent(npos) ((int) (((npos) -1) / 2))
#define heap_left(npos) (((npos) * 2) + 1)
#define heap_right(npos) (((npos) * 2) + 2)


void heap_init(Heap *heap, int (*compare)(const void *key1, const void *key2),
               void (*destroy)(void *data)) {
    heap->size = 0;
    heap->compare = compare;
    heap->destroy = destroy;
    heap->tree = NULL;
    return;
}


void heap_destroy(Heap *heap) {
    int i;

    /* Remove all the nodes form heap */
    if (heap->destroy != NULL) {
        for (i = 0; i < heap_size(heap); i++) {
            heap->destroy(heap->tree[i]);
        }
    }

    /* Free storage allocated for the heap */
    free(heap->tree);
    memset(heap, 0, sizeof(Heap));
    return;
}


int heap_insert(Heap *heap, const void *data) {
    void *temp;
    int ipos, ppos;

    /* Allocate storage for node */
    if ((temp = (void **) realloc(heap->tree, (heap_size(heap) + 1) * sizeof(void *))) == NULL)
        return -1;

    heap->tree = temp;

    /* Insert node after last node */
    heap->tree[heap_size(heap)] = (void *) data;

    /* Heapify tree by pushing contents of new node upward */
    ipos = heap_size(heap);
    ppos = heap_parent(ipos);
    while (ipos > 0 && heap->compare(heap->tree[ppos], heap->tree[ipos]) < 1) {
        /* Swap contents of current node and parent */
        temp = heap->tree[ppos];
        heap->tree[ppos] = heap->tree[ipos];
        heap->tree[ipos] = temp;

        /* Move up one level in tree to continue heapifying */
        ipos = ppos;
        ppos = heap_parent(ipos);
    }

    /* Adjust size of heap to account for inserted node */
    heap->size++;
    return 0;
}


int heap_extract(Heap *heap, void **data) {
    void *save, *temp;
    int ipos, lpos, rpos, mpos;

    /* Don't allow extraction from empty heap */
    if (heap_size(heap) == 0)
        return -1;

    /* Extract node at top of heap */
    *data = heap->tree[0];

    /* Adjust storage used by heap */
    save = heap->tree[heap_size(heap) - 1];
    if (heap_size(heap) - 1 > 0) {
        if ((temp = (void **) realloc(heap->tree, (heap_size(heap) - 1) * sizeof(void *))) == NULL) {
            return -1;
        }
        heap->tree = temp;
        heap->size--;
    } else {
        /* Manage the heap when extracting last node */
        free(heap->tree);
        heap->tree = NULL;
        heap->size = 0;
        return 0;
    }

    /* Copy the last node to the top */
    heap->tree[0] = save;
    /* Heapify the tree by pushing contents of the new top downward */
    ipos = 0;

    while (1) {
        /* Select child to swap with current node */
        lpos = heap_left(ipos);
        rpos = heap_right(ipos);

        if (lpos < heap_size(heap) && heap->compare(heap->tree[lpos], heap->tree[ipos]) > 0)
            mpos = lpos;
        else
            mpos = ipos;

        if (rpos < heap_size(heap) && heap->compare(heap->tree[rpos], heap->tree[mpos]) > 0)
            mpos = rpos;

        /* When mpos is ipos, the heap property has been restored */
        if (mpos == ipos)
            break;
        else {
            /* Swap contents of current node and select child */
            temp = heap->tree[mpos];
            heap->tree[mpos] = heap->tree[ipos];
            heap->tree[ipos] = temp;
            /* Move down one level in the tree to continue heapifying */
            ipos = mpos;
        }
    }

    return 0;
}