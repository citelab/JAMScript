
#ifndef __JAMRUN_H__
#define __JAMRUN_H__

typedef struct _runner_config
{
	char *mach_name;
	char *file_name;
    char *key_value;
	int  c_mode;
	int  js_mode;
	int  s_mode;
	int proc_count;
} runner_config;


typedef struct _jam_service
{
	int port;
	int timestamp;
	// TODO: fill this up
} jam_service;

/**
 * Function prototypes..
 */

void setup_program(int ac, char *av[]);
jam_service *open_jam_service();
void print_config(runner_config *c);

#endif
