#include <inttypes.h>
#include <pthread.h>
#include <stdbool.h>
#include <stddef.h>
#include "uthash.h"
#include "mqtt-batch.h"
#include "command.h"
#include <netinet/in.h>

uint32_t get_header_length(uint32_t nb_items) {
    if (nb_items <= 23) {
        return 1;
    } else if (nb_items <= 255) {
        return 2;
    } else if (nb_items <= 65535) {
        return 3;
    } else if (nb_items <= 16777215) {
        return 4;
    } else {
        return 5;
    }
}

void create_header(void *buf, uint32_t nb_items) {
    uint8_t header[5];
    int nb_bytes_to_copy = 0;
    if (nb_items <= 23) {
        nb_bytes_to_copy = 1;
        header[0] = CBOR_ARRAY_SHORT_COUNT | nb_items;
    } else if (nb_items <= 255) {
        nb_bytes_to_copy = 2;
        header[0] = CBOR_ARRAY_ONE_EXTRA_BYTE;
        header[1] = (0x000000FF & nb_items);
    } else if (nb_items <= 65535) {
        nb_bytes_to_copy = 3;
        header[0] = CBOR_ARRAY_TWO_EXTRA_BYTE;
        header[1] = (0x0000FF00 & nb_items) >> 8;
        header[2] = (0x000000FF & nb_items);
    } else if (nb_items <= 16777215) {
        nb_bytes_to_copy = 4;
        header[0] = CBOR_ARRAY_THREE_EXTRA_BYTE;
        header[1] = (0x00FF0000 & nb_items) >> 16;
        header[2] = (0x0000FF00 & nb_items) >> 8;
        header[3] = (0x000000FF & nb_items);
    } else {
        nb_bytes_to_copy = 5;
        header[0] = CBOR_ARRAY_FOUR_EXTRA_BYTE;
        header[1] = (0xFF000000 & nb_items) >> 24;
        header[2] = (0x00FF0000 & nb_items) >> 16;
        header[3] = (0x0000FF00 & nb_items) >> 8;
        header[4] = (0x000000FF & nb_items);
    }
    memcpy(buf, header, nb_bytes_to_copy);
}

mqtt_queue_node_t *create_mqtt_queue_node(char *topic, void *msg, int msglen, void *udata, int qos) {
    mqtt_queue_node_t *node = (mqtt_queue_node_t*) calloc(1, sizeof(mqtt_queue_node_t));
    node->topic = topic;
    node->msg = msg;
    node->msglen = msglen;
    node->udata = udata;
    node->qos = qos;
    node->next = NULL;
    return node;
}

void destroy_mqtt_queue_node(mqtt_queue_node_t *node) {
    command_t *p = (command_t *)node->udata;
    command_free(p);
    free(node);
}

mqtt_topic_batcher_t *create_topic_batcher(char *topic) {
    mqtt_topic_batcher_t *topic_batcher = (mqtt_topic_batcher_t*) calloc(1, sizeof(mqtt_topic_batcher_t));
    topic_batcher->head.next = NULL;
    topic_batcher->tail = &(topic_batcher->head);
    topic_batcher->queue_size = 0;
    topic_batcher->topic = topic;
    pthread_mutex_init(&(topic_batcher->queue_lock), NULL);
    return topic_batcher;
}

void destroy_mqtt_topic_batcher(mqtt_topic_batcher_t *batcher) {
    mqtt_queue_node_t *cur = batcher->head.next;
    while (cur != NULL) {
        destroy_mqtt_queue_node(cur);
    }
    free(batcher);
}

mqtt_batcher_t *create_mqtt_batcher() {
    mqtt_batcher_t *batcher = (mqtt_batcher_t*) calloc(1, sizeof(mqtt_batcher_t));
    batcher->topics = NULL;
    pthread_mutex_init(&(batcher->topics_lock), NULL);
    return batcher;
}

void destroy_mqtt_batcher(mqtt_batcher_t *batcher) {
    struct mqtt_topic_batcher *b, *tmp;
    HASH_ITER(hh, batcher->topics, b, tmp) {
        HASH_DEL(batcher->topics, b);
        destroy_mqtt_topic_batcher(b);
    }
    free(batcher);
}

mqtt_batch_t *prepare_batch(mqtt_queue_node_t *queue) {
    uint32_t batch_length = 0; // already count the header

    mqtt_queue_node_t *cur = queue;
    uint8_t nb_msg = 0;
    while (cur != NULL) {
        batch_length += cur->msglen;
        cur = cur->next;
        nb_msg++;
    }
    if (nb_msg == 0) {
        return NULL;
    }
    uint32_t header_length = get_header_length(nb_msg);
    batch_length += header_length;

    void *batch_msg = calloc(1, batch_length);
    void *batch_pos = batch_msg;

    create_header(batch_pos, nb_msg);
    batch_pos += header_length;

    cur = queue;
    for (int i = 0; i < nb_msg; i++) {
        memcpy(batch_pos, cur->msg, cur->msglen);
        batch_pos += cur->msglen;
        cur = cur->next;
    }
    mqtt_batch_t *batch = calloc(1, sizeof(mqtt_batch_t));
    batch->topic = queue->topic;
    batch->msg = batch_msg;
    batch->msglen = batch_length;
    batch->qos = queue->qos;
    batch->batch_source = queue;
    return batch;
}

void destroy_batch(mqtt_batch_t *batch) {
    mqtt_queue_node_t *cur = batch->batch_source;
    while (cur != NULL) {
        mqtt_queue_node_t *tmp = cur;
        cur = cur->next;
        destroy_mqtt_queue_node(tmp);
    }
    free(batch->msg);
    free(batch);
}

mqtt_queue_node_t *topic_batcher_get_batch(mqtt_topic_batcher_t *batcher) {
    pthread_mutex_lock(&(batcher->queue_lock));
    if (batcher->head.next == NULL) {
        pthread_mutex_unlock(&(batcher->queue_lock));
        return NULL;
    }
    mqtt_queue_node_t *sending_queue = batcher->head.next;
    mqtt_queue_node_t *sending_queue_tail = NULL;
    mqtt_queue_node_t *cur = batcher->head.next;
    int count = 0;
    while (cur != NULL && count < MAX_BATCH_SIZE) {
        sending_queue_tail = cur;
        cur = cur->next;
        count++;
    }
    sending_queue_tail->next = NULL;
    batcher->head.next = cur;
    if (cur == NULL) {
        batcher->tail = &(batcher->head);
    }
    batcher->queue_size -= count;
    pthread_mutex_unlock(&(batcher->queue_lock));
    return sending_queue;
}

void topic_batcher_queue_msg(mqtt_topic_batcher_t *batcher, mqtt_queue_node_t *node) {
    pthread_mutex_lock(&(batcher->queue_lock));
    batcher->tail->next = node;
    batcher->tail = node;
    batcher->queue_size++;
    pthread_mutex_unlock(&(batcher->queue_lock));
}

void mqtt_batcher_queue_msg(mqtt_batcher_t *batcher, char *mtopic, void *msg, int msglen, void *udata, int qos) {
    if (!batcher) {
        return;
    }
    mqtt_queue_node_t *node = create_mqtt_queue_node(mtopic, msg, msglen, udata, qos);
    pthread_mutex_lock(&(batcher->topics_lock));
    mqtt_topic_batcher_t *topic_batcher = NULL;
    HASH_FIND_STR(batcher->topics, mtopic, topic_batcher);
    if (topic_batcher == NULL) {
        topic_batcher = create_topic_batcher(mtopic);
        HASH_ADD_STR(batcher->topics, topic, topic_batcher);
    }
    topic_batcher_queue_msg(topic_batcher, node);
    pthread_mutex_unlock(&(batcher->topics_lock));
}

mqtt_topic_batcher_t *mqtt_batcher_get_topic_batcher(mqtt_batcher_t *batcher, char *p_topic) {
    mqtt_topic_batcher_t *topic_batcher = NULL;
    pthread_mutex_lock(&(batcher->topics_lock));
    HASH_FIND_STR(batcher->topics, p_topic, topic_batcher);
    pthread_mutex_unlock(&(batcher->topics_lock));
    return topic_batcher;
}