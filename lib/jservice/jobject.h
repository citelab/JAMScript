#ifndef __JOBJECT_H__
#define __JOBJECT_H__


#define MAX_DESC_LEN                64
#define MAX_VALUE_LEN               64
#define MAX_KEY_LEN                 20              // limited to a SHA-1 hash

#define MAX_JOBJECTS                100


// This is the object that we want to disseminate in JAMService. This record has
// resource registrations. Resource type, location (IP, port), description,
// time of current registration, time of first registration, etc..
//

typedef struct _jobject_t
{
    int16_t type;
    int32_t ipaddr;
    int16_t port;
    unsigned char key[MAX_KEY_LEN];
    unsigned char value[MAX_VALUE_LEN];
    char description[MAX_DESC_LEN];
    int64_t curr_reg_time;
    int64_t orig_reg_time;

} jobject_t;


void jobjmanager_main(zsock_t *pipe, void *args);

#endif
