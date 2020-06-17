/**
 * @file        mqtt-adapter.h 
 * @brief       MQTT Adapter Implementation
 * @details     interfaces with the MQTT broker to write or read data from the broker asynchronously, this is built 
 *              using the PAHO Async C library 
 * @remarks     the async event loop is inside the PAHO Async C library
 * @author      Muthucumaru Maheswaran, Yuxiang Ma
 * @copyright 
 *              Copyright 2020 Muthucumaru Maheswaran, Yuxiang Ma
 * 
 *              Licensed under the Apache License, Version 2.0 (the "License");
 *              you may not use this file except in compliance with the License.
 *              You may obtain a copy of the License at
 * 
 *                  http://www.apache.org/licenses/LICENSE-2.0
 * 
 *              Unless required by applicable law or agreed to in writing, software
 *              distributed under the License is distributed on an "AS IS" BASIS,
 *              WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *              See the License for the specific language governing permissions and
 *              limitations under the License.
 */
#ifndef MQTT_ADAPTER_H
#define MQTT_ADAPTER_H
#ifdef __cplusplus
extern "C" {
#endif

#include <MQTTAsync.h>
#include <stdbool.h>
#include "nvoid.h"

typedef enum
{
    MQTT_NOTCONNECTED = 0,
    MQTT_CONNECTED,
    MQTT_DISCONNECTING,
    MQTT_ERROR
} mqtt_state_t;

#define MQTT_SENDBUF_SIZE                       8
#define APP_ID_LEN                              64
#define MQTT_HOST_LEN                           128
#define MAX_SUBSCRIPTIONS                       1024
#define MQTT_TIMEOUT                            200

/**
 * @struct mqtt_adapter_t 
 * @brief  MQTT adapter
 * @details returned by the mqtt_adapter_create(), holds all the relevant state
 */
typedef struct mqtt_adapter_t 
{
    mqtt_state_t state;
    MQTTAsync mqttserv;                                                 /// MQTTAsync handle for the MQTT broker
    char mqtthost[MQTT_HOST_LEN];                                       /// the URL for the MQTT host 
    char *subscriptions[MAX_SUBSCRIPTIONS];                             /// subscriptions that are already pushed for the MQTT Adapter
    char app_id[APP_ID_LEN];
    void (*onconnect)(void *);
    void *args;
} mqtt_adapter_t;

mqtt_adapter_t *mqtt_createserver(char *url, int indx, char *appid, char *devid, void (*onc)(void *), void *args);
void mqtt_deleteserver(mqtt_adapter_t *mq);
void mqtt_connect(mqtt_adapter_t *mq);
bool mqtt_disconnect(mqtt_adapter_t *mq, int state);
void mqtt_reconnect(mqtt_adapter_t *mq);
void mqtt_default_conn_lost(void *ctx, char *cause);
void mqtt_set_subscription(mqtt_adapter_t *mq, char *topic);
void mqtt_subscribe(mqtt_adapter_t *mq, char *topic);
bool mqtt_publish(mqtt_adapter_t *mq, char *topic, nvoid_t *nv);
void mqtt_buffer_messsage(mqtt_adapter_t *mq, char *topic, nvoid_t *nv);
void mqtt_flush_buffer_out(mqtt_adapter_t *mq);
void mqtt_setmsgarrived(mqtt_adapter_t *mq, void *ctx, MQTTAsync_messageArrived *ma);
void mqtt_setconnlost(mqtt_adapter_t *mq, void *ctx, MQTTAsync_connectionLost *cl);


#ifdef __cplusplus
}
#endif
#endif
