/**
 * args.h
 * 
 * Contains all declaration of argument relating functions
 * 
 * This includes cnode command line arguments, and MQTT server information
 */
#define DEFAULTS_PORT 8080
#define DEFAULTS_SERIALNUM 1
#define DEFAULTS_NUMEXECUTORS 1

// arbitrary - the dynamic UDP port range
#define PORT_MAX 4096
#define PORT_MIN 65535

// Functions to test validity of supplied arguments
bool args_port_valid(int port);
bool args_serialnum_valid(int serialnum);
bool args_numexecutors_valid(int numexecutors);