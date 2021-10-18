#pragma once
#include <stdio.h>
#define likely(expr) __builtin_expect(!(!(expr)), 1)
#define unlikely(expr) __builtin_expect(!(!(expr)), 0)

#define jamCall(expr, retErr)                                        \
  if (unlikely(expr)) {                                              \
    printf("Error at %s:%d@%s\n", __FILE__, __LINE__, __FUNCTION__); \
    return retErr;                                                   \
  }

#define jamCallEnablePreemption(expr, retErr)                        \
  if (unlikely(expr)) {                                              \
    printf("Error at %s:%d@%s\n", __FILE__, __LINE__, __FUNCTION__); \
    JAMC_DISABLE_PREEMPTION_END;                                     \
    return retErr;                                                   \
  }

#define JAMC_MQTT_TXMTR_LRU_CACHE_SIZE 16
#define JAMC_MQTT_HOST_IP_SIZE 16
#define JAMC_MQTT_SEND_BUF_SIZE 1024 * 256// 256 * 2
#define JAMC_MQTT_RECV_BUF_SIZE 1024 * 256// 256 * 2
#define JAMC_MQTT_SUBSCRIBER_STACK_SIZE 4096 * 32
#define JAMC_MQTT_REMOTE_HANDLER_STACK_SIZE 4096
#define JAMC_MQTT_TRANSMITTER_STACK_SIZE 4096 * 16
#define JAMC_MQTT_TASK_CHANNEL "/jamc/tsk"
#define JAMC_MQTT_PING_PONG_CHANNEL "/jamc/pip"
#define JAMC_MQTT_SUBSCRIPTION_CHANNEL "/jamc/sub"
#define JAMC_MQTT_SCHEDULE_CHANNEL "/jamc/scd"
#define JAMC_MQTT_DISCONNECT_CHANNEL "/jamc/dsc"
#define JAMC_MQTT_C2J_CHANNEL_PREFIX "/jamc/c2c"//"/jamc/c2j"
#define JAMC_MQTT_J2C_CHANNEL_PREFIX "/jamc/c2c"//"/jamc/j2c"
#define JAMC_MQTT_RES_DATA_CHANNEL_PREFIX "/res/dat"
#define JAMC_MQTT_RES_ACK_CHANNEL_PREFIX "/res/ack"
#define JAMC_MQTT_CALL_ACK_CHANNEL_PREFIX "/cal/ack"

#define JAMC_MQTT_CALL_ACK "calack"
#define JAMC_MQTT_RES_ACK "resack"
#define JAMC_MQTT_RES_DATA "resdat"

#define JAMC_MQTT_RPC_DATA_CHANNEL_SIZE 80
#define JAMC_MQTT_RPC_MAP_ID_SIZE 42
#define JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE 64
#define JAMC_MQTT_QOS MQTT_PUBLISH_QOS_0
#define JAMC_MQTT_NUM_DE_RETRY 3

#define DEFAULT_SHARED_STACK_SIZE 8 * 1024 * 1024
#define JAMC_PREEMPT_SIGNAL SIGALRM
#define STEAL_TRAIL_ROUNDS 5
#define ENFORCE_PREEMPTION 0
#define JAMC_OBJECT_ALIGNMENT 32
#define JAMC_STACK_ALIGNMENT 32
#define JAMC_MAX_CONTROLLER_CONN 16
#define JAMC_SLEEP_IF_NO_TASK (struct timespec) {0, 20000}
#define JAMC_MQTT_POOLER_SLEEP (struct timespec) {0, 40000}
#define JAMC_MQTT_PING_PONG_EXPIRE (struct timespec) {30, 0}
#define JAMC_MQTT_CALL_ACK_TIMEOUT (struct timespec) {9, 0}
#define JAMC_MQTT_RESULT_TIMEOUT (struct timespec) {7, 0}
#define JAMC_MQTT_DATA_ACK_TIMEOUT (struct timespec) {1, 500000000}


#ifdef __amd64__
#define JAMC_FUNCT_POINTER_REG 4
#define JAMC_STACK_POINTER_REG 5
#define JAMC_NUM_DE_REG_EN_QWORD 10
#elif defined(__aarch64__)
#define JAMC_FUNCT_POINTER_REG 14
#define JAMC_STACK_POINTER_REG 15
#define JAMC_NUM_DE_REG_EN_QWORD 24
#else
#error "platform not supported"
#endif
