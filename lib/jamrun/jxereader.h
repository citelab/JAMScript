
#ifndef __JXE_READER_H__
#define __JXE_READER_H__
#include "toml/TOML.h"

typedef struct _jxe_file
{
	int entries;
	int entries_cap;
	char ** entries_name;
	char dir_name[512];
	char potential_dir_name[512];
	char path[1024];
	TOMLValue * manifest;

} jxe_file;

jxe_file *open_jam_executable(char * path, int mode);
int load_jxe_cprog(jxe_file *j);
int load_jxe_activity(jxe_file *j, char *actname);
int load_jxe_activities(jxe_file *j, char *tags[]);
int load_names_c(jxe_file * j, char ** names, int * num);
jxe_file * create_jxe();
int free_jxe(jxe_file * j);
int add_entry_name(jxe_file * j, char * name);
int jxe_load_js_file(jxe_file *j);

#endif
