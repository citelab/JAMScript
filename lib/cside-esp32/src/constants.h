#ifndef __CONSTANTS_H__
#define __CONSTANTS_H__

#define CmdNames_REGISTER 1001
#define CmdNames_REGISTER_ACK 1002
#define CmdNames_NEW_REGISTER 1005
#define CmdNames_OLD_REGISTER 1006
#define CmdNames_PING 1020
#define CmdNames_PONG 1021
#define CmdNames_GET_CLOUD_FOG_INFO 1100
#define CmdNames_PUT_CLOUD_FOG_INFO 1101
#define CmdNames_REF_CLOUD_FOG_INFO 1102
#define CmdNames_FOG_ADD_INFO 1150
#define CmdNames_FOG_DEL_INFO 1151
#define CmdNames_CLOUD_ADD_INFO 1152
#define CmdNames_CLOUD_DEL_INFO 1153
#define CmdNames_WHERE_IS_CTRL 1550
#define CmdNames_HERE_IS_CTRL 1551
#define CmdNames_PROBE 2020
#define CmdNames_PROBE_ACK 2110
#define CmdNames_GET_SCHEDULE 3010
#define CmdNames_PUT_SCHEDULE 3020
#define CmdNames_REXEC 5010
#define CmdNames_REXEC_NAK 5020
#define CmdNames_REXEC_ACK 5030
#define CmdNames_REXEC_RES 5040
#define CmdNames_REXEC_ERR 5045
#define CmdNames_REXEC_SYN 5050
#define CmdNames_GET_REXEC_RES 5060
#define CmdNames_COND_FALSE 5810
#define CmdNames_FUNC_NOT_FOUND 5820
#define CmdNames_SET_JSYS 6000
#define CmdNames_CLOSE_PORT 6200


#define CmdNames_STOP 7000


#define Multicast_PREFIX "224.1.1"
#define Multicast_SENDPORT  16000
#define Multicast_RECVPORT  16500

#define Multicast_SENDPORTBUS  16001
#define Multicast_RECVPORTBUS  16501

#define  globals_Timeout_REXEC_ACK_TIMEOUT 100

// Must be included after FreeRTOS 
#ifdef INC_FREERTOS_H
#define MAX_SEMAPHORE_WAIT 1000 * portTICK_PERIOD_MS
#endif


#define RTASK_ACK_BITS (0x01 << 0)
#define RTASK_RES_BITS (0x01 << 1)

// THIS IS TEMPORARY 
#define STACK_SIZE 1024*2

#define MAX_COMMAND_SIZE 256


#define PRECONFIG_WIFI_SSID "jamscript_test_network"

#define SNTP_SERVER "ca.pool.ntp.org"
#define WIFI_CONNECTION_NOTIFICATION 0x01

// Currently set to toronto time
#define TIMEZONE "EST5EDT,M3.2.0,M11.1.0" 


#endif
