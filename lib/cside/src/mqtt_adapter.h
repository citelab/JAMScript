/*
 * MQTT Adapter
 * The header file
 * December 2021
 */

#include <mosquitto.h>
#include <pthread.h>
#include "uthash.h"
#include "utarray.h"

#ifndef __MQTT_ADAPTER_H__
#define __MQTT_ADAPTER_H__

enum levels {
    ALL_LEVELS = 0x0,
    DEVICE_LEVEL = 0x001,
    EDGE_LEVEL = 0x010,
    CLOUD_LEVEL = 0x100
};

struct pub_msg_entry_t {
    int id;
    void *ptr;
    UT_hash_handle hh;
};

typedef struct broker_info {
    char host[64];
    int port;
    int keep_alive;
} broker_info_t;

typedef struct mqtt_adapter {
    int mid;
    enum levels level;
    struct mosquitto *mosq;
    struct pub_msg_entry_t *pmsgs;
    pthread_mutex_t hlock;
    UT_array *topics;
} mqtt_adapter_t;

#define mqtt_lib_init() do {                        \
    mosquitto_lib_init();                           \
} while(0)

#define mqtt_log_cback_set(m, cb)  do {             \
    mosquitto_log_callback_set(m->mosq, cb);        \
} while (0)

#define mqtt_connect_cback_set(m, cb)  do {         \
    mosquitto_connect_callback_set(m->mosq, cb);    \
} while (0)

#define mqtt_disconnect_cback_set(m, cb)  do {         \
    mosquitto_disconnect_callback_set(m->mosq, cb);    \
} while (0)

#define mqtt_message_cback_set(m, cb)  do {         \
    mosquitto_message_callback_set(m->mosq, cb);    \
} while (0)

#define mqtt_subscribe_cback_set(m, cb)  do {       \
    mosquitto_subscribe_callback_set(m->mosq, cb);  \
} while (0)

#define mqtt_publish_cback_set(m, cb)  do {         \
    mosquitto_publish_callback_set(m->mosq, cb);    \
} while (0)

#define mqtt_set_all_cbacks(m, connectcb, disconnectcb, msgcb, subscb, pubcb, logcb) do {     \
    mosquitto_connect_callback_set(m->mosq, connectcb);                         \
    mosquitto_disconnect_callback_set(m->mosq, disconnectcb);                   \
    mosquitto_message_callback_set(m->mosq, msgcb);                             \
    mosquitto_subscribe_callback_set(m->mosq, subscb);                          \
    mosquitto_publish_callback_set(m->mosq, pubcb);                             \
    mosquitto_log_callback_set(m->mosq, logcb);                                 \
} while (0)

void mqtt_connect_callback(struct mosquitto *mosq, void *udata, int res);
void mqtt_disconnect_callback(struct mosquitto *mosq, void *udata, int res);

void mqtt_message_callback(struct mosquitto *mosq, void *userdata, const struct mosquitto_message *msg);
void mqtt_subscribe_callback(struct mosquitto *mosq, void *userdata, int mid, int qcnt, const int *qgv);
void mqtt_log_callback(struct mosquitto *mosq, void *userdata, int level, const char *str);
void mqtt_publish_callback(struct mosquitto *mosq, void *udata, int mid);


void mqtt_do_subscribe(struct mqtt_adapter *ma);

struct mqtt_adapter *create_mqtt_adapter(enum levels level, void *serv);
bool connect_mqtt_adapter(struct mqtt_adapter *ma, broker_info_t *bi);
struct mqtt_adapter *setup_mqtt_adapter(void *serv, enum levels level, char *host, int port, char *topics[], int ntopics);
void destroy_mqtt_adapter(struct mqtt_adapter **ma);
void disconnect_mqtt_adapter(struct mqtt_adapter *ma);
void mqtt_publish(struct mqtt_adapter *ma, char *topic, void *msg, int msglen, void *udata, int qos);
void mqtt_post_subscription(struct mqtt_adapter *ma, char *topic);

#endif
