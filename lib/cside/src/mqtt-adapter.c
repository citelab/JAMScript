#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <mosquitto.h>
#include <pthread.h>
#include "mqtt-adapter.h"
#include "command.h"
#include "tboard.h"
#include "cnode.h"
#include "utilities.h"

// XXX: Got the message for the task board
void mqtt_message_callback(struct mosquitto *mosq, void *udata, const struct mosquitto_message *msg)
{
    (void)mosq;
    server_t *serv = (server_t *)udata;
    if (msg->payloadlen) {
        command_t *cmd = command_from_data(NULL, msg->payload, msg->payloadlen);
        msg_processor(serv, cmd);
        // command_free(cmd);
    } else {
        printf("%s\n", msg->topic);
    }
}

void mqtt_connect_callback(struct mosquitto *mosq, void *udata, int res)
{
    (void)mosq;
    server_t *serv = (server_t *)udata;

    serv->state = SERVER_REGISTERED;
    if (!res)
        mqtt_do_subscribe(serv->mqtt);
    else
        fprintf(stderr, "Connect failed on interface: \n");
}
void mqtt_disconnect_callback(struct mosquitto *mosq, void *udata, int res)
{
    (void)mosq;
    server_t *serv = (server_t *)udata;

    printf("Disconnect.......%s\n", serv->server_id);
    disconnect_mqtt_adapter(serv->mqtt);

    cnode_t *c = (cnode_t *)serv->cnode;
    if (serv != NULL)
        serv->state = SERVER_NOT_REGISTERED;
    if (res != 0) {
        terminate_error(false, "MQTT disconnect callback gave unexpected res: %d", res);
    }

    mosquitto_loop_stop(serv->mqtt->mosq, true);

    // add stuff maybe for udata
    if (serv->mqtt != NULL)
        destroy_mqtt_adapter(&serv->mqtt);
    serv->state = SERVER_UNUSED;
    c->eservnum--;
}

void mqtt_subscribe_callback(struct mosquitto *mosq, void *udata, int mid, int qcnt, const int *qgv)
{
    for(int i = 1; i < qcnt; i++)
        printf("QoS-given: %d\n", qgv[i]);
}

void mqtt_log_callback(struct mosquitto *mosq, void *udata, int level, const char *str)
{
    (void)mosq;
    (void)udata;
    (void)level;
    (void)str;
}

void mqtt_publish_callback(struct mosquitto *mosq, void *udata, int mid)
{
    (void)mosq;
    server_t *serv = (server_t *)udata;
    struct pub_msg_entry_t *p = NULL;
    HASH_FIND_INT(serv->mqtt->pmsgs, &mid, p);
    if (p != NULL) {
        pthread_mutex_lock(&(serv->mqtt->hlock));
        HASH_DEL(serv->mqtt->pmsgs, p);
        pthread_mutex_unlock(&(serv->mqtt->hlock));
	    command_free((command_t *)p->ptr);
        free(p);
    }
}

struct pub_msg_entry_t *create_pub_msg_entry(int id, void *msg)
{
    struct pub_msg_entry_t *p = (struct pub_msg_entry_t *)calloc(1, sizeof(struct pub_msg_entry_t));
    assert(p != NULL);
    p->id = id;
    p->ptr = msg;
    return p;
}

void destroy_pub_msgs(struct mqtt_adapter *ma)
{
    struct pub_msg_entry_t *pe, *tmp;

    HASH_ITER(hh, ma->pmsgs, pe, tmp) {
        HASH_DEL(ma->pmsgs, pe);
        command_free((command_t *)pe->ptr);
        free(pe);
    }
}

void mqtt_do_subscribe(struct mqtt_adapter *ma)
{
    char **p;
    p = NULL;
    while ((p = (char**)utarray_next(ma->topics, p))) {
        mosquitto_subscribe(ma->mosq, NULL, *p, 0);
    }
}

struct mqtt_adapter *create_mqtt_adapter(enum levels level, void *s)
{
    struct mqtt_adapter *ma = (struct mqtt_adapter *)calloc(1, sizeof(struct mqtt_adapter));
    struct mosquitto *mosq;
    ((server_t *)s)->mqtt = ma;
    mosq = mosquitto_new(NULL, true, s);
    ma->mosq = mosq;
    ma->level = level;
    if (!mosq)
        mosquitto_lib_cleanup();
    assert (mosq != NULL);
    ma->pmsgs = NULL;
    utarray_new(ma->topics, &ut_str_icd);
    pthread_mutex_init(&(ma->hlock), NULL);
    ma->mid = 0;

    return ma;
}

bool connect_mqtt_adapter(struct mqtt_adapter *ma, broker_info_t *bi)
{
    if (mosquitto_connect(ma->mosq, bi->host, bi->port, bi->keep_alive)) {
        fprintf(stderr, "Connection error:\n");
        return false;
    }
    mosquitto_loop_start(ma->mosq);
    return true;
}

struct mqtt_adapter *setup_mqtt_adapter(void *serv, enum levels level, char *host, int port, char *topics[], int ntopics)
{
    // create the adapter
    struct mqtt_adapter *ma = create_mqtt_adapter(level, serv);
    // hookup the callbacks
    mqtt_set_all_cbacks(ma, mqtt_connect_callback, mqtt_disconnect_callback,
            mqtt_message_callback, mqtt_subscribe_callback,
            mqtt_publish_callback, mqtt_log_callback);
    // post the subscriptions
    for (int i = 0; i < ntopics; i++) {
        mqtt_post_subscription(ma, topics[i]);
    }
    // connect the adapter
    broker_info_t b = {.keep_alive = 60};
    strcpy(b.host, host);
    b.port = port;
    if (connect_mqtt_adapter(ma, &b) == false) {
        ((server_t *)serv)->state = SERVER_UNUSED;
        free(ma);
    }
    return ma;
}


void destroy_mqtt_adapter(struct mqtt_adapter **ma)
{
    mosquitto_destroy((*ma)->mosq);
    utarray_free((*ma)->topics);
    free(*ma);
    *ma = NULL;
    mosquitto_lib_cleanup();
}

void disconnect_mqtt_adapter(struct mqtt_adapter *ma)
{
    mosquitto_disconnect(ma->mosq);
}

void mqtt_publish(struct mqtt_adapter *ma, char *topic, void *msg, int msglen, void *udata, int qos)
{
    if (ma != NULL) {
        ma->mid++;
        if (udata != NULL) {
            command_t *p = (command_t *)udata;
            mosquitto_publish(ma->mosq, &(ma->mid), topic, msglen, msg, qos, 0);
            struct pub_msg_entry_t *pentry = create_pub_msg_entry(ma->mid, p);
            pthread_mutex_lock(&(ma->hlock));
            HASH_ADD_INT(ma->pmsgs, id, pentry);
            pthread_mutex_unlock(&(ma->hlock));
        } else
            mosquitto_publish(ma->mosq, &(ma->mid), topic, msglen, msg, qos, 0);
    }
}

void mqtt_post_subscription(struct mqtt_adapter *ma, char *topic)
{
    utarray_push_back(ma->topics, &topic);
}
