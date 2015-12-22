#ifndef __JMSG_H__
#define __JMSG_H__

#define HELLO_TYPE                          100
#define LAN_MSG_TYPE                        101
#define WAN_MSG_TYPE                        102


typedef struct _jmsg_t
{
    unsigned char type;
    unsigned char payload[1];

} jmsg_t;

#endif
