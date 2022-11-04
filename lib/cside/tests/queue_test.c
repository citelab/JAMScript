#include "queue/queue.h"
#include <pthread.h>

struct queue q;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void *run() {
    for (int i = 0; i < 5000000; i++) {
	  pthread_mutex_lock(&lock);
        struct queue_entry *entry = queue_new_node("hello");
        queue_insert_tail(&q, entry);
        queue_pop_head(&q);
	       pthread_mutex_unlock(&lock);
    }
    return NULL;
}

int main() 
{
    pthread_t t1, t2;
    q = queue_create();
    queue_init(&q);

    pthread_create(&t1, NULL, run, NULL);
    //    pthread_create(&t2, NULL, run, NULL);

    pthread_join(t1, NULL);
    pthread_join(t2, NULL);
}
