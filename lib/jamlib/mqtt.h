
#ifndef __MQTT_H__
#define __MQTT_H__

#include <MQTTClient.h>
#include "command.h"


MQTTClient mqtt_open(char *mhost);
void mqtt_publish(MQTTClient mcl, char *topic, command_t *cmd);
command_t *mqtt_receive(MQTTClient mcl, char *cmdstr, char *topic, int timeout);

#endif