
#include <archive.h>
#include <archive_entry.h>
#include "jxereader.h"
#include "toml/tparser.h"
#include "toml/files.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <dlfcn.h>

#define CHUNK   16384

/* This extractor was an example from lib archive complete extractor
 * It works surprisingly well and returns 0 for success, any other number for failure
 * All I added to this was to extract to a specific folder
 * The copy data is a subroutine for extract and ought not be used anywhere else
 */
static int
copy_data(struct archive *ar, struct archive *aw)
{
  int r;
  const void *buff;
  size_t size;
  off_t offset;

  for (;;) {
    r = archive_read_data_block(ar, &buff, &size, &offset);
    if (r == ARCHIVE_EOF)
      return (ARCHIVE_OK);
    if (r < ARCHIVE_OK)
      return (r);
    r = archive_write_data_block(aw, buff, size, offset);
    if (r < ARCHIVE_OK) {
      fprintf(stderr, "%s\n", archive_error_string(aw));
      return (r);
    }
  }
}

/* This function will extract the zip file from filename to a filename_jam_run folder
 * Everythig will be handled by this
 */

static int extract(const char *filename, jxe_file * j)
{
  char cwd[1024];
  char path[1024];
  int err = 0;
  struct archive *a;
  struct archive *ext;
  struct archive_entry *entry;
  int flags;
  int r, i = 0;
  int file_index = 0;
  char * currentFile;

  //* make some directory
  if(getcwd(cwd, 1024) == NULL)
    return -1;
  
  /* Select which attributes we want to restore. */
  flags = ARCHIVE_EXTRACT_TIME;
  flags |= ARCHIVE_EXTRACT_PERM;
  flags |= ARCHIVE_EXTRACT_ACL;
  flags |= ARCHIVE_EXTRACT_FFLAGS;

  a = archive_read_new();
  archive_read_support_format_all(a);
  archive_read_support_filter_all(a);
  ext = archive_write_disk_new();
  archive_write_disk_set_options(ext, flags);
  archive_write_disk_set_standard_lookup(ext);
  //We need to decide the folder name
  //We take the filename without the extensions
  for(int i = 0; i < 512; i++){ 
    if(filename[i] == '.'){
        file_index = i;
        break;
    }
  }
  err = snprintf(j->dir_name, 512, "%s", filename);
  if(err != strlen(filename)){
    printf("File name too long 1\n");
    exit(1);
  }

  err = snprintf(j->dir_name + file_index, 512 - file_index, "_jam_run");
   if(err != strlen("_jam_run")){
    printf("File name too long\n");
    exit(1);
  }
  //With this we have our directory name which we will be extracting to

  if ((r = archive_read_open_filename(a, filename, CHUNK)))
    return 1;
  for (;;) {
    r = archive_read_next_header(a, &entry);
    if (r == ARCHIVE_EOF)
      break;
    if (r < ARCHIVE_OK)
      fprintf(stderr, "%s\n", archive_error_string(a));
    if (r < ARCHIVE_WARN)
      return 2;

    currentFile = (char *)archive_entry_pathname(entry);

    if(i == 0){ //So find the inner folder in case
        for(int i = 0; i < 512; i++){
            if(currentFile[i] == '/'){
                 strncpy(j->potential_dir_name, currentFile, i + 1);
                 break;
            }
            else if(currentFile[i] == '\0'){
                 strncpy(j->potential_dir_name, "/", 2);
                 break;
            }
        }
    }

    add_entry_name(j, currentFile); //add the entry to our jxefile to know which files belong to us
    snprintf(path, 1024, "%s/%s/%s", cwd, j->dir_name, currentFile);
    archive_entry_set_pathname(entry, path);
    //Set the path where an entry of the zip file is written to

    r = archive_write_header(ext, entry);
    if (r < ARCHIVE_OK)
      fprintf(stderr, "%s\n", archive_error_string(ext));
    else if (archive_entry_size(entry) > 0) {
      r = copy_data(a, ext);
      if (r < ARCHIVE_OK)
        fprintf(stderr, "%s\n", archive_error_string(ext));
      if (r < ARCHIVE_WARN)
        return 3;
    }
    r = archive_write_finish_entry(ext);
    if (r < ARCHIVE_OK)
      fprintf(stderr, "%s\n", archive_error_string(ext));
    if (r < ARCHIVE_WARN)
      return 4;
    i++;
  }

  archive_read_close(a);
  archive_read_free(a);
  archive_write_close(ext);
  archive_write_free(ext);
  return 0;
}

/* Sets up a jxe_file
 * We assume the directory name is less than 512 characters
 */
jxe_file * create_jxe(){

    jxe_file * ret = calloc(1, sizeof(jxe_file));
    if(ret == NULL){
        printf("Memory Allocation Failure\n");
        return NULL;
    }
    ret->entries = 0;   
    ret->entries_cap = 5;
    ret->entries_name = calloc(5, sizeof(char *));
    if(ret->entries_name == NULL){
        printf("Memory Allocation Failure\n");
        return NULL;
    }
    return ret;
}

/* Frees the jxe_file
 * and subsidiaries
 */
int free_jxe(jxe_file * j){
    for(int i = 0; i < j->entries; i++){
        free(j->entries_name[i]);
    }
    free(j->entries_name);
    t_free_value(j->manifest, 1);
    free(j);
    return 0;
}
/* This function will add a entry name to the jxe_file
 * 
 */
int add_entry_name(jxe_file * j, char * name){
    if(name == NULL)
        return 1;
    //If we need a larger entries array
    if(j->entries >= j->entries_cap){
        j->entries_name = realloc(j->entries_name, j->entries_cap * 2 * sizeof(char *));
        if(j->entries_name == NULL){
            printf("Memory Allocation Failure\n");
            return 1;
        }
        j->entries_cap *= 2;
    }
    //Allocate the name plus one character for null
    j->entries_name[j->entries] = calloc(strlen(name) + 1, sizeof(char));
    if(j->entries_name[j->entries] == NULL){
        printf("Memory Allocation Failure\n");
        return 1;
    }
    strcpy(j->entries_name[j->entries++], name);
    return 0;
}

int is_c_file(char * filename){
    int length = strlen(filename);

    if(length < 3)
        return 0;
    return filename[length - 1] == 'o' && filename[length - 2] == 's'  && filename[length - 3] == '.'; //Im assuming this is acceptable C file
}

/**
 * Open the JAMScript executable file. If not found, print out an error message and quit.
 * If the file is found, validate the file to ensure it contains the appropriate file.
 *
 * Open the file, locate the manifest.tml (TOML file) and read it. A TOML data structure
 * for the manifest.tml is held in memory - pointed to by the jxe_file pointer.
 * 
 * The main thing about this program is that it might overwrite a folder with the same name_jam_run
 * Furthermore, it does not delete the folder after completion so if you want to make sure you are testing properly
 * delete any old jam_run folders you may have.  
 */

jxe_file *open_jam_executable(char *path, int mode)
{
    int eflag, s;
    char cwd[1024];   //path for current working directory
    char * buf;       //buffer for toml
    jxe_file * j = create_jxe();  //create jxe_file

    if(j == NULL)
      return NULL;
    // First we extract the file -> Will halt if cannot be found or extraction error
    if( (eflag = extract(path, j)) != 0 ){  
        printf("Extraction Failure\n");  //if extraction fail, free then return
        free(j);
        return NULL;
    }
    else{
        printf("Extraction Success\n");
    }

    // Next we must find the TOML Manifest file and load it into memory
    if(getcwd(cwd, 1024) == NULL){
        free(j);
        return NULL;
    }
    //len = strlen(cwd);
    snprintf(j->path, 1024, "%s/%s", cwd, j->dir_name); //Set the path of our file, for future uses
    snprintf(cwd, 1024, "%s/MANIFEST.tml", j->path);
    //So first try, we hope the manifest is in this path

    eflag = read_file_to_buffer(cwd, &buf, &s);
    if(eflag != 0){ //So we can't read it{
        //we try second possibility
        printf("Name : %s \n", j->potential_dir_name);
        snprintf(cwd, 1024, "%s/%sMANIFEST.tml", j->path, j->potential_dir_name);
        eflag = read_file_to_buffer(cwd, &buf, &s);
    }

    if (eflag == 0) {  // So after at most two tries we suceed
            t_init_parse(buf);  //Parse the toml
            if (t_parse_doc() != T_VALID_VALUE) {  //If parsing fails, free up and return
                printf("\n\n Parsing error... Exiting.\n");
                free(j); 
                return NULL;
            }
            j->manifest = t_get_value(); //otherwise, store the pointer to the toml value.
    }
    else{
        printf("TOML Manifest File read fail\n");
        free(j);
        return NULL;
    }

    return j;
}

/* Loads up the Manifest C-Node Values
 * Return 0 for Success
 * Return -1 for Failure
 * INCOMPLETE CURRENTLY and so doesn't do anything....
 */
int load_names(jxe_file * j, char ** names, int * num){
    int pcount = 0;
    char filename[64];
    TOMLValue *file;
    TOMLValue * cfile = t_find_property_with_str(j->manifest->val.oval, "cfile");
    if(cfile->type == 0 || cfile->type != T_OBJECT){
      printf("Failed to find the C Mode TOML values of jxe... \n Exiting ... \n");
      return -1;
    }
    
    TOMLValue * portions = t_find_property_with_str(cfile->val.oval, "portions");

    if(portions->type == 0 || cfile->type != T_OBJECT){
      printf("Failed to find the portion value of jxe....\n Exiting....\n");
      return -1;
    }
    pcount = portions->val.ival;
    printf("Testing: %d, %d\n", pcount, cfile->type);    
    
    for(int i = 0; i < pcount; i++){
     snprintf(filename, 64, "%d", i + 1); //So we would have things like 1, 2, 3.....
     file = t_find_property_with_str(cfile->val.oval, filename);
     if(file->type == 0 || file->type != T_OBJECT){
        fprintf(stderr, "Failed to find %s ... Continuing\n", filename);
        pcount--;
        i--;
     }
     else{
        file = t_find_property_with_str(file->val.oval, "file");
        if(file->type == 0 || file->type != T_STRING){
          fprintf(stderr, "Failed to find %s ... Continuing\n", filename);
          pcount--;
          i--;
        }
        else{
          names[i] = file->val.sval; //Get the pointer for that. We must be careful since it is not a copy
        }
     }

    }
  return pcount;
}


/**
 * Load the C program. It has two main functions: user_main() and user_setup().
 * These two portions are located in two .o files. So we load them one after the other and
 * start their execution. We use the dynamic library loading facility to get them going.
 * Return number of libraries successfully loaded
 */
int load_jxe_cprog(jxe_file *j)
{
    char ** clibs = calloc(j->entries, sizeof(char *));
    int clibs_num;
    int ret = 0;

    if( (clibs_num = load_names(j, clibs, &clibs_num)) == 0){
      free(clibs);
      return 0;
    }
    
    for(int i = 0; i < clibs_num; i++){
        if(is_c_file(clibs[i])){
            if(load_jxe_activity(j, clibs[i]) != 0){
                printf("Load failed for file %s ..\n", clibs[i]);
              }
              else{
              ret++;
            }
        }
    }
    free(clibs);
    return ret;
}

/**
 * Only C activities are loaded.
 * From the archive, load the activity with the given name. If the activity is not present
 * then return an error code (-1). On success return an error code (0). The activity is loaded
 * using the dynamic library loading facility.
 */

int load_jxe_activity(jxe_file *j, char *actname)
{   
    char dll[512]; //path for the lib file
    void (*user_main)() = NULL; 
    void (*user_setup)() = NULL;
    void (*user_finish)() = NULL;
    void * handle = NULL; 
    //These above are pointers for the methods and library
    snprintf(dll, 512 ,"%s/%s%s", j->path, j->potential_dir_name ,actname);
    printf("Path: %s\n", dll);
    handle = dlopen(dll, RTLD_LAZY);  //open lib, return -1 if fails
    if(handle == NULL){
        printf("Library Loading Error: %s\n",dlerror());
        return -1;
    }
    user_main = dlsym(handle, "user_main");
    user_setup = dlsym(handle, "user_setup"); //Get the methods pointers
    user_finish = dlsym(handle, "user_finish"); //Get the methods pointers

    if(user_main != NULL && user_setup != NULL && user_finish != NULL){ //If successful, we execute them in the following order
        printf("Executing Functions... \n");
        user_setup();
        user_main();
        user_finish();
    }
    else{
        printf("Methods Loading Error: %s\n",dlerror());
        return -1;
    }
    dlclose(handle);
    return 0;
}


/**
 * Load activities that have certain attributes or tags from the JXE file.
 * On success returns the number of activities loaded and -1 on error. Return value of 0
 * indicates no activities matching the tags were found.
 * Additionally, same comment as the above one apply here too.
 */
int load_jxe_activities(jxe_file *j, char *tags[])
{
    return 0;
}

/**
 * Load the JS portion. We directly load the file into the remote node's disk. This is
 * accomplished through a FTP service built into the JS node. We ask it to save the transported
 * file into the disk storage at the remote location. We can later ask the servlet to load it
 * as part of it.
 *
 * One argument is the JS node. We assume the JS node could be in a different machine. So file
 * should be sent through the JS node.
 */
 
int jxe_load_js_file(jxe_file *j)
{
    char * filename = "file";
    char execute[512];
    TOMLValue *file;
    TOMLValue * jsfile = t_find_property_with_str(j->manifest->val.oval, "jsfile");
    if(jsfile->type == 0 || jsfile->type != T_OBJECT){
      printf("Failed to find the jsfile TOML values of jxe... \n Exiting ... \n");
      return -1;
    }
    file = t_find_property_with_str(jsfile->val.oval, filename);
    if(file->type == 0 || file->type != T_STRING){
      printf("Failed to find the file name TOML values of jxe... \n Exiting ... \n");
      return -1;
    }
    snprintf(execute, 512, "nodejs %s/%s%s\n", j->path, j->potential_dir_name, file->val.sval);
    printf("Executing jsfile: %s...\n", file->val.sval);
    system(execute);
    return 0;
}

