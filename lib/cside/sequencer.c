#include "tboard.h"
#include "sequencer.h"
#include "queue/queue.h"
#include <assert.h>

void task_sequencer(tboard_t *tboard)
{
    // check if any remote tasks have returned
    struct queue_entry *entry = queue_peek_front(&(tboard->msg_recv));
    if (entry != NULL) { // we have found a remote task
        pthread_mutex_lock(&(tboard->msg_mutex));
        // check if queue still has an element in it. It might not due to race condition as several
        // threads run this function
        entry = queue_peek_front(&(tboard->msg_recv));
        if (entry != NULL) { // queue still has element in it!
            // enclose action so it is easier to add more sequencer functionality before
            queue_pop_head(&(tboard->msg_recv));
            // handle remote task response
            handle_msg_recv(tboard, (remote_task_t *)(entry->data));
            // free remote_task_t after handling
            free(entry->data);
            // free queue entry
            free(entry);
        }
        pthread_mutex_unlock(&(tboard->msg_mutex));
    }

}

void handle_msg_recv(tboard_t *t, remote_task_t *rtask)
{
    if(rtask == NULL)
        return;
    if (rtask->blocking) {
        // if task is blocking, push copy of rtask to parent task storage
        assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
        // place parent task back to appropriate queue
        task_place(t, rtask->calling_task);
    } else {
        // non-blocking so we can destroy response/arguments
        if (rtask->data_size > 0 && rtask->data != NULL)
            free(rtask->data);
    }
}

/**
 * Utility functions for searching through queue relatively fast for scheduling
 * 
 * I wrote this code early on when I thought I was going to have to implement
 * scheduling and timer functionality. I will leave it here incase the person who
 * continues this project afterwards may find it useful
 */
// the following function removes a specific queue entry by id recursively and returns it
struct queue_entry *remove_queue_entry_by_id(struct queue *q, int id)
{
    struct queue_entry *head = queue_pop_head(q); // pop head
    if (head == NULL) { // if NULL, then we reached end of queue without finding it
        return NULL;
    }
    // if using uuid4 instead, function must call strcmp(task->id, id) == 0
    if (((task_t *)(head->data))->id == id) { // if head matches id, return it without inserting it back
        return head;
    } else { // if head does not match id
        struct queue_entry *ret = remove_queue_entry_by_id(q, id); // recursively run function to get matching entry
        queue_insert_head(q, head); // reinsert non-matching head back into queue at the head
        return ret; // return matching entry
    }
}

// the following function removes a specific queue entry by type recursively and returns it
struct queue_entry *remove_queue_entry_by_type(struct queue *q, int type)
{
    struct queue_entry *head = queue_pop_head(q); // pop head
    if (head == NULL) { // if NULL, then we reached end of queue without finding it
        return NULL;
    }
    if (((task_t *)(head->data))->type == type) { // if head matches id, return it without inserting it back
        return head;
    } else { // if head does not match id
        struct queue_entry *ret = remove_queue_entry_by_type(q, type); // recursively run function to get matching entry
        queue_insert_head(q, head); // reinsert non-matching head back into queue at the head
        return ret; // return matching entry
    }
}