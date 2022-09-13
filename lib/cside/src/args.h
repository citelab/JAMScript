/**
 * args.h
 * 
 * Contains all declaration of argument relating functions
 *
 */
#define DEFAULTS_PORT 1883
#define DEFAULTS_SERIALNUM 1
#define DEFAULTS_NUMEXECUTORS 1

// arbitrary - the dynamic UDP port range
#define PORT_MIN 1024
#define PORT_MAX 65535

// Functions to test validity of supplied arguments
bool args_appid_valid(char *appid);
bool args_port_valid(int port);
bool args_serialnum_valid(int serialnum);
bool args_numexecutors_valid(int numexecutors);