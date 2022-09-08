/* this contains task sequencer */
#ifndef __SEQUENCER_H_
#define __SEQUENCER_H_

// helper functions for schedule implementation for whomever takes over

struct queue_entry *remove_queue_entry_by_id(struct queue *q, int id);
/**
 * remove_queue_entry_by_id() - Removes first queue entry that matches id
 * @q:  queue to search through
 * @id: id to match
 * 
 * Function will search for queue entry with entry->data->id == @id. If entry is found
 * it will be removed from the queue and returned, otherwise it will return NULL.
 * 
 * Return: NULL        - no queue entry matching @id was found
 *         queue entry - first queue entry from head matching @id
 */


struct queue_entry *remove_queue_entry_by_type(struct queue *q, int type);
/**
 * remove_queue_entry_by_id() - Removes first queue entry that matches id
 * @q:    queue to search through
 * @type: type to match
 * 
 * Function will search for queue entry with entry->data->type == @type. If entry is found
 * it will be removed from the queue and returned, otherwise it will return NULL.
 * 
 * Return: NULL        - no queue entry matching @type was found
 *         queue entry - first queue entry from head matching @type
 */

void handle_msg_recv(tboard_t *t, remote_task_t *rtask);
/**
 * handle_msg_recv() - Handle remote task sitting in msg recieve queue.
 * @t:     tboard_t pointer to task board
 * @rtask: remote_task_t pointer to remote task response
 * 
 * Internal helper function takes remote task, handles status, frees variables
 * and places @rtask->calling_task in appropriate queue where applicable
 * 
 * Context: None, but assumed to be run under @t->msg_mutex lock.
 */

#endif