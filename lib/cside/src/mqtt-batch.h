#include <pthread.h>
#include "uthash.h"

#ifndef __MQTT_BATCH_H__
#define __MQTT_BATCH_H__

#define MAX_BATCH_SIZE 32

// first 3 bits: 100 (type 4, array)
// last 5 bits: empty so can OR with batch size
// ex: if batch size is 20, the header would be
// 0b10000000 | 0b00010100 = 0b10010100
#define CBOR_ARRAY_SHORT_COUNT      0b10000000

#define CBOR_ARRAY_ONE_EXTRA_BYTE   0b10011000
#define CBOR_ARRAY_TWO_EXTRA_BYTE   0b10011001
#define CBOR_ARRAY_THREE_EXTRA_BYTE 0b10011010
#define CBOR_ARRAY_FOUR_EXTRA_BYTE  0b10011011

typedef struct mqtt_queue_node {
    char *topic;
    void *msg;
    int msglen;
    void *udata;
    int qos;
    struct mqtt_queue_node *next;
} mqtt_queue_node_t;

typedef struct mqtt_batch {
    char *topic;
    void *msg;
    int msglen;
    int qos;
    mqtt_queue_node_t *batch_source;
} mqtt_batch_t;

typedef struct mqtt_topic_batcher {
    mqtt_queue_node_t head;
    mqtt_queue_node_t *tail;
    pthread_mutex_t queue_lock;
    int queue_size;
    char *topic;
    UT_hash_handle hh;
} mqtt_topic_batcher_t;

typedef struct mqtt_batcher {
    mqtt_topic_batcher_t *topics;
    pthread_mutex_t topics_lock;
} mqtt_batcher_t;

mqtt_queue_node_t *create_mqtt_queue_node(char *topic, void *msg, int msglen, void *udata, int qos);

mqtt_topic_batcher_t *create_topic_batcher(char *topic);

mqtt_batcher_t *create_mqtt_batcher();

void destroy_mqtt_batcher(mqtt_batcher_t *batcher);

mqtt_batch_t *prepare_batch(mqtt_queue_node_t *queue);

void destroy_batch(mqtt_batch_t *batch);

mqtt_queue_node_t *topic_batcher_get_batch(mqtt_topic_batcher_t *batcher);

void topic_batcher_queue_msg(mqtt_topic_batcher_t *batcher, mqtt_queue_node_t *node);

void mqtt_batcher_queue_msg(mqtt_batcher_t *batcher, char *mtopic, void *msg, int msglen, void *udata, int qos);

mqtt_topic_batcher_t *mqtt_batcher_get_topic_batcher(mqtt_batcher_t *batcher, char *p_topic);

#endif