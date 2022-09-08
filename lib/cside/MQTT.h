#ifndef MQTT_H
#define MQTT_H

typedef struct MQTT_t {
    void *null;
} MQTT_t;

typedef struct MQTT_info_t {
    char connection[255]; // arbitrary limit for connection string
    char authentication[32]; // arbitrary limit for password length
} MQTT_info_t;

void start_mqtt(MQTT_t *serv);
void destroy_mqtt(MQTT_t *serv);

// subscribe_mqtt() present in CNODE.h

MQTT_t *connect_mqtt(MQTT_info_t *servinfo);



#endif