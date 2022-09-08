#include <stdio.h>
#include "MQTT.h"


void start_mqtt(MQTT_t *serv) {
    // dummy start
    printf("Connected to MQTT server %d\n", *((int *)(serv->null)));
}

void destroy_mqtt(MQTT_t *serv) {
    // dummy destroy
    if(serv == NULL)
        return;
    
    if(serv->null != NULL) {
        free(serv->null);
    }
    free(serv);
}


MQTT_t *connect_mqtt(MQTT_info_t *servinfo) {
    MQTT_t *serv = (MQTT_t *)malloc(sizeof(MQTT_t));
    printf("$ sshpass -p '%s' ssh %s\n",servinfo->authentication, servinfo->connection);

    // arbitrarily create server object that has no meaning
    serv->null = (void *)malloc(sizeof(int));
    int number = 1;
    memcpy(serv->null, &number, sizeof(int));

    return serv;
}